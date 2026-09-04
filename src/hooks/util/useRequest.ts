import type { UseFetchOptions, UseFetchReturn } from '@vueuse/core'
import type { MaybeRef } from 'vue'
import type { LocationQueryRaw } from 'vue-router'

import { Message } from '@arco-design/web-vue'
import {
  createFetch,
  isObject,

} from '@vueuse/core'
import NProgress from 'nprogress'
import { computed, unref } from 'vue'
import { stringifyQuery } from 'vue-router'

import { ErrorFlag } from '@/api/apis'
import { useToken } from '@/hooks'
import { useSetupI18n } from '@/i18n'
import { router } from '@/router'
import { useUserStore } from '@/stores'

const baseUrl = import.meta.env.VITE_API_BASE_URL
const RequestTimeout = 1000 * 60 * 10

/**
 * 业务错误（HTTP 200 但响应体 `code` 非 200）。
 *
 * `afterFetch` 抛出它，让 vueuse 的 `.catch` 接手 —— 这是**唯一**能把 `error.value`
 * 置上的途径，见下方 `afterFetch` 的注释。
 */
export class BizError extends Error {
  constructor(
    /** 后端响应体里的 code（401 / 403 / 500 …） */
    readonly code: number,
    message: string,
  ) {
    super(message)
    this.name = 'BizError'
  }
}

export const useRequest = createFetch({
  baseUrl,
  options: {
    immediate: false,
    timeout: RequestTimeout,
    // 失败路径也要允许写 data ——vueuse 的 catch 分支里是
    // `if (options.updateDataOnError) data.value = responseData`，
    // 不开这个开关，`onFetchError` 返回的 ErrorFlag 哨兵就进不到 data.value，
    // 依赖哨兵判定的 postAction/isRequestFailed 会全部失效。
    updateDataOnError: true,
    beforeFetch({ options }) {
      NProgress.start()
      //  添加token
      const { token } = useToken()
      options.headers = Object.assign(options.headers || {}, {
        Authorization: token,
      })
      return { options }
    },
    /**
     * 业务成功时解包 `data.data`；业务失败时**抛异常**。
     *
     * ## 为什么必须抛
     * `afterFetch` 的签名只允许返回 `{ data, response }`，**没有办法设置 `error`**。
     * 原实现在这里把 `data` 换成 `ErrorFlag` 哨兵就返回，于是 `error.value` 永远为空，
     * 而全站 26 个页面共 77 处用 `if (error.value)` 判成败 —— 那段分支永不进入，
     * 后端明确拒绝时页面照样弹「保存成功」，把拦截器这条真实原因盖掉。
     * （已逐页改用 postAction/isRequestFailed 哨兵判定，但那只是治标：
     *  下一个人照旧会写出 `if (error.value)`，而它看起来完全合理。）
     *
     * vueuse 的 useFetch 实现（v14.3.0 dist/index.js）是这样的：
     * ```js
     * .then(async (fetchResponse) => {
     *   if (options.afterFetch) ({ data: responseData } = await options.afterFetch({...}))
     *   data.value = responseData
     * }).catch(async (fetchError) => {
     *   let errorData = fetchError.message || fetchError.name
     *   if (options.onFetchError) ({ error: errorData, data: responseData } = await options.onFetchError({...}))
     *   error.value = errorData                                    // ← 只有这条路能设 error
     *   if (options.updateDataOnError) data.value = responseData
     *   if (throwOnFailed) throw fetchError                        // throwOnFailed 默认 false
     * })
     * ```
     * 所以 `afterFetch` 里 throw 会走进 `.catch` → 调用 `onFetchError` → 设置 `error.value`；
     * 且 `throwOnFailed` 默认 false，`await execute()` **不会 reject**，
     * 调用方不需要 try/catch，也不会产生 unhandled rejection。
     *
     * 结论：改造后两种判定**同时成立** ——
     *   · `error.value` 有值（新代码可以放心用）
     *   · `data.value === ErrorFlag`（既有 postAction/isRequestFailed 继续有效）
     */
    async afterFetch({ data, response }) {
      const { isExpiredSoon } = useToken()
      const status = data?.code || 200

      // token 快过期时刷新。放在分支之前，保证失败响应也会触发（与改造前一致）。
      if (isExpiredSoon)
        useUserStore().freshToken()

      if (status === 200) {
        NProgress.done()
        // 刻意用 `|| {}` 而不是 `?? {}`：全站 26 个页面的 `if (!res) return` 都依赖
        // 「成功一定拿到真值」这个不变量。若后端某个接口把 data 返回成 `false` / `0`
        // / `''`，`??` 会让它原样透出，调用点就会把成功当失败。
        // 代价是这类落地值被抹成 `{}` —— 但目前没有接口靠裸布尔/裸数字传递结果，
        // 而破坏不变量的后果是静默误判，两者不对等。
        return { data: data.data || {}, response }
      }

      // ── 以下均为业务失败：先做副作用，再抛出让 error.value 生效 ──
      if (status === 401) {
        // JWT未授权（token 缺失/失效/过期），跳转登录页
        await log_out()
      }
      else if (status === 403) {
        // 接口无权限：仅提示，不跳转、不登出。
        // 页面里的次要请求（如导航栏拉角色列表）没权限时不应影响整个会话
        no_permission(response?.url)
      }
      else {
        // 400/500/其他错误码：显示后端错误信息
        Message.error(data?.msg || `请求失败 (${status})`)
      }
      throw new BizError(status, data?.msg || `请求失败 (${status})`)
    },
    async onFetchError({ data, response, error }) {
      // NProgress 必须在这里收尾：afterFetch 抛出后它那侧的 done() 不会执行。
      NProgress.done()

      // 请求被中止（如重复请求时前一个被取消）不是失败。
      // 刻意保持 error 为空：中止是我们自己发起的，不该让页面弹错或走失败分支的提示；
      // data 仍给 ErrorFlag，让 postAction 返回 null，从而不弹「成功」。
      if (error?.name === 'AbortError')
        return { data: ErrorFlag, error: undefined }

      // afterFetch 抛出的业务错误：提示已经弹过了，这里只负责把 error 传出去
      if (error instanceof BizError)
        return { data: ErrorFlag, error }

      // ── 以下是真正的网络层错误（无响应）或后端返回非 JSON 错误体 ──
      if (response?.status === 401) {
        await log_out()
      }
      else if (response?.status === 403) {
        no_permission(response?.url)
      }
      else if (data?.msg) {
        // 后端返回了 JSON 格式的错误信息
        Message.error(data.msg)
      }
      else if (error) {
        Message.error('网络请求失败，请检查网络连接')
      }
      else {
        Message.error(`请求失败 (${response?.status || '未知错误'})`)
      }
      // 网络层错误同样要把 error 传出去（原实现固定 undefined，是 error.value
      // 永远为空的另一半原因）。data 仍是 ErrorFlag，两种判定都成立。
      return { data: ErrorFlag, error: error ?? new Error(`请求失败 (${response?.status ?? '未知错误'})`) }
    },
  },
})

async function log_out() {
  const { i18n } = useSetupI18n()
  const { t } = i18n.global
  Message.warning(t('sys.loginExpired'))
  await useUserStore().frontEndLogout()
  setTimeout(() => {
    router.push('/login')
  }, 500)
}

/**
 * 接口无权限（HTTP 403）处理：只提示，不登出、不跳转。
 *
 * 之前后端把"无权限"也返回 401，前端 401 分支会清 token 并跳登录页，
 * 结果任意一个次要请求（例如导航栏拉角色列表）缺权限就把用户踢下线。
 * 现在后端区分 401（登录态失效）与 403（无权限），这里只弹一次提示。
 * 同一路径 3 秒内不重复提示，避免页面并发多个无权限请求时刷屏。
 */
const noPermissionTips = new Map<string, number>()
function no_permission(url?: string) {
  const key = (url || '').split('?')[0]
  const now = Date.now()
  const last = noPermissionTips.get(key) || 0
  if (now - last < 3000)
    return
  noPermissionTips.set(key, now)
  Message.error(key ? `无权访问该功能（${key.replace(/^.*\/api\//, '')}）` : '无权访问该功能')
}

/**
 * 获取get请求Url地址
 * @param url 请求地址
 * @param query 请求参数
 */
export function getQueryUrl(url: MaybeRef<string>, query?: MaybeRef<unknown>) {
  return computed(() => {
    const _url = unref(url)
    const _query = unref(query)
    const queryString = isObject(_query)
      ? stringifyQuery(_query as LocationQueryRaw)
      : _query || ''
    return `${_url}${queryString ? '?' : ''}${queryString}`
  })
}

/**
 * 扩展 UseFetchOptions，支持 onSuccess 回调
 * 注意: @vueuse/core v14 的 useFetch 原生不支持 onSuccess，
 * 这里通过 onFetchResponse 在请求成功后读取 data 来实现
 */
export type UseFetchOptionsWithSuccess<T> = UseFetchOptions & {
  onSuccess?: (data: T) => void
}

/**
 * 为 useFetch 返回值挂载 onSuccess 回调
 * onFetchResponse 在 afterFetch 处理完、data 已赋值后触发
 */
function withOnSuccess<T>(result: UseFetchReturn<T>, onSuccess?: (data: T) => void): UseFetchReturn<T> {
  if (onSuccess) {
    result.onFetchResponse(() => {
      onSuccess(result.data.value as T)
    })
  }
  return result
}

/**
 * 封装 get 请求
 * @param url 请求地址
 * @param query 请求参数
 * @param options 请求选项（支持 onSuccess 回调）
 */
export function useGet<T = unknown>(
  url: MaybeRef<string>,
  query?: MaybeRef<unknown>,
  options?: UseFetchOptionsWithSuccess<T>,
): UseFetchReturn<T> {
  const { onSuccess, ...restOptions } = options || {}
  return withOnSuccess(useRequest<T>(getQueryUrl(url, query), { ...restOptions }).json(), onSuccess)
}

/**
 * 封装 post 请求
 * @param url 请求地址
 * @param payload 请求参数
 * @param options 请求选项
 */
export function usePost<T = unknown>(
  url: MaybeRef<string>,
  payload?: MaybeRef<unknown>,
  options?: UseFetchOptions,
): UseFetchReturn<T> {
  return useRequest<T>(url, { ...options })
    .post(payload, 'json')
    .json()
}

/**
 * 封装 put 请求
 * @param url 请求地址
 * @param payload 请求参数
 * @param options 请求选项
 */
export function usePut<T = unknown>(
  url: MaybeRef<string>,
  payload?: MaybeRef<unknown>,
  options?: UseFetchOptions,
) {
  return useRequest<T>(url, { ...options })
    .put(payload, 'json')
    .json()
}

/**
 * 封装 delete 请求
 * @param url 请求地址
 * @param payload 请求参数
 * @param options 请求选项
 */
export function useDelete<T = unknown>(
  url: MaybeRef<string>,
  payload?: MaybeRef<unknown>,
  options?: UseFetchOptions,
): UseFetchReturn<T> {
  return useRequest<T>(url, { ...options })
    .delete(payload, 'json')
    .json()
}

/**
 * 判定一次请求是否失败（业务错误 / 网络错误）。
 *
 * ## 与 `error.value` 的关系
 * 拦截器改造后（见 `afterFetch` 的长注释），业务失败会 **throw** 让 vueuse 走
 * `.catch` → `onFetchError`，所以现在 **`error.value` 和 `data === ErrorFlag`
 * 两种判定同时成立**，写哪种都对。
 *
 * 保留这个哨兵判定的理由：
 * 1. 请求被中止（AbortError）时 `error` 刻意为空（中止是我们自己发起的，不该弹错），
 *    但 `data` 仍是 ErrorFlag —— 此时"没拿到数据"是真的，不该继续弹「成功」。
 *    只看 `error.value` 会把被中止的请求当成功。
 * 2. `postAction` 这套 helper 顺手把「失败」表达成 `null` 返回值，调用点一行
 *    `if (!res) return` 就够，比解构 `{ data, execute, error }` 再各自判更难写错。
 *
 * ## 历史（别再犯）
 * 改造前 `afterFetch` 只能返回 `{ data, response }`、设置不了 `error`，于是
 * `error.value` 永远为空，而全站 26 个页面 77 处用 `if (error.value)` 判成败 ——
 * 后端明确拒绝了，页面照样弹「保存成功」把真实原因盖掉。代码仓库新增/编辑、
 * 平台配置管理保存、批量绑定的失败计数全中招。
 */
export function isRequestFailed(data: unknown): boolean {
  return data === ErrorFlag || data === null || data === undefined
}

/**
 * POST 并返回业务数据；失败返回 `null`（拦截器已经弹过错误提示，无需重复提示）。
 *
 * 各页面此前各自实现了一份同名的 `postAction`（results / defects / runs /
 * waivers / campaigns / approvals / dispositions 七处），这里收敛成共享实现。
 */
export async function postAction<T = unknown>(
  url: string,
  // 与 usePost 的签名对齐（MaybeRef<unknown>）：请求体可能是数组、也可能是带 null
  // 的接口类型，收窄成 Record<string, unknown> 只会逼调用点写
  // `as unknown as Record<string, unknown>`，除了噪音没有任何收益。
  payload?: unknown,
): Promise<T | null> {
  const request = usePost<T>(url, payload, { immediate: false })
  await request.execute()
  return isRequestFailed(request.data.value) ? null : (request.data.value as T)
}

/** PUT 并返回业务数据；失败返回 `null`。语义同 [`postAction`]。 */
export async function putAction<T = unknown>(
  url: string,
  payload?: unknown,
): Promise<T | null> {
  const request = usePut<T>(url, payload, { immediate: false })
  await request.execute()
  return isRequestFailed(request.data.value) ? null : (request.data.value as T)
}

/** DELETE 并返回业务数据；失败返回 `null`。语义同 [`postAction`]。 */
export async function deleteAction<T = unknown>(
  url: string,
  payload?: unknown,
): Promise<T | null> {
  const request = useDelete<T>(url, payload, { immediate: false })
  await request.execute()
  return isRequestFailed(request.data.value) ? null : (request.data.value as T)
}

/**
 * GET 并返回业务数据；失败返回 `null`。语义同 [`postAction`]。
 *
 * 列表页的常驻查询仍应直接用 [`useGet`]（要 `isFetching` / 响应式 `data`）；
 * 这个只用于「取一次、按结果决定下一步」的命令式场景。
 */
export async function getAction<T = unknown>(
  url: string,
  query?: unknown,
): Promise<T | null> {
  const request = useGet<T>(url, query, { immediate: false })
  await request.execute()
  return isRequestFailed(request.data.value) ? null : (request.data.value as T)
}

/**
 * 生成幂等键（UUID v4）。
 *
 * **不能直接用 `crypto.randomUUID()`**：它只在**安全上下文**（https 或 localhost）
 * 可用。内网通过 `http://<IP>:8003` 访问时 `crypto.randomUUID` 是 `undefined`，
 * 调用直接抛 `TypeError`，而调用点常在 `try/finally`（无 catch）里，异常冒到
 * Arco 的 `@ok` 后弹窗既不关闭也不提示 —— 表现为「点保存没反应」，
 * 且**请求根本没发出**。代码仓库页的新增/编辑/验证/快照四个按钮全中招，
 * 只有不用它的「克隆/拉取」是好的。
 *
 * 这里优先用原生实现，不可用时退回 `getRandomValues`，再退回 `Math.random`。
 */
export function newIdempotencyKey(): string {
  const c = globalThis.crypto as Crypto | undefined
  if (typeof c?.randomUUID === 'function')
    return c.randomUUID()
  // getRandomValues 在非安全上下文同样可用（它不是 secure-context-only）
  if (typeof c?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    c.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0F) | 0x40 // version 4
    bytes[8] = (bytes[8] & 0x3F) | 0x80 // variant 10
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
  // 最后兜底：幂等键只要求「本次请求唯一」，不做安全用途，随机性足够
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    const v = ch === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * 封装获取Blob进行下载
 * @param url 请求地址
 * @param options 请求选项
 */
export function useBlob(
  url: MaybeRef<string>,
  options?: UseFetchOptions,
): UseFetchReturn<Blob> {
  return useRequest(url, { ...options }).blob()
}
