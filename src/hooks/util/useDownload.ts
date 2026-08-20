import { Message } from '@arco-design/web-vue'

import { useToken } from '../app'

/**
 * 带鉴权的二进制文件下载。
 *
 * 注意：token 由 pinia（持久化到 localStorage 的 `userInfo` 键）管理，
 * 不存在 `localStorage.token`。直接读 `localStorage.getItem('token')` 会拿到空串，
 * 请求头变成 `Authorization: Bearer `，后端返回 401 导致"下载失败"。
 * 所有手写 fetch 的下载都必须通过本 hook 取 token。
 */
export function useDownload() {
  const download = async (path: string, filename: string) => {
    const { token } = useToken()
    const base = import.meta.env.VITE_API_BASE_URL || '/api'
    const response = await fetch(`${base}${path}`, { headers: { Authorization: token } })
    if (!response.ok || (response.headers.get('content-type') || '').includes('application/json'))
      throw new Error(`下载失败：HTTP ${response.status}`)

    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(objectUrl)
  }

  /** 下载失败时统一提示，返回是否成功 */
  const downloadWithTip = async (path: string, filename: string, errorTip: string) => {
    try {
      await download(path, filename)
      return true
    }
    catch {
      Message.error(errorTip)
      return false
    }
  }

  return { download, downloadWithTip }
}
