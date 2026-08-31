import { Message } from '@arco-design/web-vue'

import { useToken } from '../app'

/**
 * 把已经在前端手里的文本直接存成文件，不发请求。
 *
 * 适用于内容随列表接口一起返回的场景（如候选的 ai_detail_report）——
 * 再向后端要一次纯属浪费，而且后端并没有单独的报告下载接口。
 *
 * 文件名会做安全处理：换掉 Windows/Linux 都不允许的字符，并限制长度，
 * 避免用文件路径当文件名时（如 `kd/tmc/Foo.java`）浏览器静默拒绝保存。
 */
export function downloadText(content: string, filename: string, mime = 'text/markdown;charset=utf-8') {
  const safe = filename
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180) || 'download.md'
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = safe
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // 立刻 revoke 在部分浏览器会导致下载中断，放到下一帧
  requestAnimationFrame(() => URL.revokeObjectURL(url))
}

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
