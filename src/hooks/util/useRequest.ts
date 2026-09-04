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

export const useRequest = createFetch({
  baseUrl,
  options: {
    immediate: false,
    timeout: RequestTimeout,
    beforeFetch({ options }) {
      NProgress.start()
      //  添加token
      const { token } = useToken()
      options.headers = Object.assign(options.headers || {}, {
        Authorization: token,
      })
      return { options }
    },
    async afterFetch({ data, response }) {
      const { isExpiredSoon } = useToken()
      const status = data?.code || 200
      if (status === 200) {
        data = data.data || {}
      }
      else if (status === 401) {
        // JWT未授权（token 缺失/失效/过期），跳转登录页
        await log_out()
      }
      else if (status === 403) {
        // 接口无权限：仅提示，不跳转、不登出。
        // 页面里的次要请求（如导航栏拉角色列表）没权限时不应影响整个会话
        no_permission(response?.url)
        data = ErrorFlag
      }
      else {
        // 400/500/其他错误码：显示后端错误信息
        Message.error(data?.msg || `请求失败 (${status})`)
        data = ErrorFlag
      }
      if (isExpiredSoon) {
        // 最后验证本地token效期,快过期时,刷新token
        useUserStore().freshToken()
      }
      NProgress.done()
      return { data, response }
    },
    async onFetchError({ data, response, error }) {
      // 忽略请求被中止的错误（如重复请求时前一个被取消）
      if (error?.name === 'AbortError') {
        NProgress.done()
        return { data: ErrorFlag, error: undefined }
      }
      // 网络层错误（无响应）或后端返回非JSON错误体
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
      NProgress.done()
      return { data: ErrorFlag, error: undefined }
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
 * ## 为什么不能用 `error.value`
 * `useFetch` 的 `afterFetch` 钩子**只能返回 `{ data, response }`**，没法设置 `error`。
 * 所以拦截器对后端业务错误（code 非 200）的处理是「弹一次 Message + 把 data 换成
 * `ErrorFlag` 哨兵」，`onFetchError` 里也显式 `return { error: undefined }`。
 * 结论：**`error.value` 永远是空的**，用它判断成败必然判成「成功」。
 *
 * 踩过的实例：代码仓库新增/编辑用 `if (error.value)` 判断，后端明确拒绝了
 * （唯一约束冲突等），前端却接着弹「绑定成功」把拦截器的红色提示覆盖掉，
 * 弹窗关闭、列表刷新，用户看到成功而库里没有数据。
 */
export function isRequestFailed(data: unknown): boolean {
  return data === ErrorFlag || data === null || data === undefined
}

/**
 * POST 并返回业务数据；失败返回 `null`（拦截器已经弹过错误提示，无需重复提示）。
 *
 * 各页面此前各自实现了一份同名的 `postAction`（results / defects / runs /
 * waivers / campaigns / approvals / dispositions 七处），这里收敛成共享实现，
 * 新代码一律用它，避免又写出 `if (error.value)` 那种判不出失败的写法。
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
