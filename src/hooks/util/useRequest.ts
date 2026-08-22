import NProgress from 'nprogress'
import { computed, unref } from 'vue'
import { type LocationQueryRaw, stringifyQuery } from 'vue-router'

import { Message } from '@arco-design/web-vue'
import type { MaybeRef } from 'vue'
import {
  type UseFetchOptions,
  type UseFetchReturn,
  createFetch,
  isObject,
} from '@vueuse/core'

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
      } else if (status === 401) {
        // JWT未授权（token 缺失/失效/过期），跳转登录页
        await log_out()
      } else if (status === 403) {
        // 接口无权限：仅提示，不跳转、不登出。
        // 页面里的次要请求（如导航栏拉角色列表）没权限时不应影响整个会话
        no_permission(response?.url)
        data = ErrorFlag
      } else {
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
      } else if (response?.status === 403) {
        no_permission(response?.url)
      } else if (data?.msg) {
        // 后端返回了 JSON 格式的错误信息
        Message.error(data.msg)
      } else if (error) {
        Message.error('网络请求失败，请检查网络连接')
      } else {
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
