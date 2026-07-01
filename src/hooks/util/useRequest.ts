import NProgress from 'nprogress'
import { computed, unref } from 'vue'
import { type LocationQueryRaw, stringifyQuery } from 'vue-router'

import { Message } from '@arco-design/web-vue'
import {
  type MaybeRef,
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
        // JWT未授权，跳转登录页
        await log_out()
      } else if (status === 403) {
        // API未授权，跳转到403页面
        await go_to_403()
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
      // 网络层错误（无响应）或后端返回非JSON错误体
      if (response?.status === 401) {
        await log_out()
      } else if (response?.status === 403) {
        await go_to_403()
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

async function go_to_403() {
  setTimeout(() => {
    router.push({ name: '403' })
  }, 500)
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
 * 封装 get 请求
 * @param url 请求地址
 * @param query 请求参数
 * @param options 请求选项
 */
export function useGet<T = unknown>(
  url: MaybeRef<string>,
  query?: MaybeRef<unknown>,
  options?: UseFetchOptions,
): UseFetchReturn<T> {
  return useRequest<T>(getQueryUrl(url, query), { ...options }).json()
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
