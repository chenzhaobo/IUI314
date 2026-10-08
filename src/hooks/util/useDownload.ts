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

/** 文本体是 `{"code":非200,"msg":...}` 形状的业务错误时返回 msg，否则返回空串 */
function businessErrorOf(text: string): string {
  if (!text.trimStart().startsWith('{'))
    return ''
  try {
    const body: unknown = JSON.parse(text)
    if (body && typeof body === 'object' && 'code' in body && 'msg' in body) {
      const { code, msg } = body as { code: unknown, msg: unknown }
      if (typeof code === 'number' && code !== 200)
        return String(msg || `业务错误 ${code}`)
    }
  }
  catch { /* 不是 JSON，按普通文本文件处理 */ }
  return ''
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

    // 后端用 JSON 返回业务错误（如"未找到原始日志与缺陷报告"）。
    // 必须把真实原因读出来抛给调用方 —— 原来只抛 `HTTP 200`，
    // 上层再显示一句笼统提示，用户根本不知道是没数据还是坏了。
    const contentType = response.headers.get('content-type') || ''
    if (!response.ok || contentType.includes('application/json')) {
      let reason = `HTTP ${response.status}`
      try {
        const body = await response.json()
        if (body?.msg) reason = String(body.msg)
      }
      catch { /* 非 JSON 体就沿用状态码 */ }
      throw new Error(reason)
    }

    const blob = await response.blob()
    // 后端 `Res` 的错误体实际是 text/plain 的 JSON 字符串（{"code":500,"msg":...}），
    // 只按 content-type 判断会把错误信息当文件存下来。文本响应再嗅探一次业务错误码。
    if (contentType.startsWith('text/plain')) {
      const reason = businessErrorOf(await blob.text())
      if (reason)
        throw new Error(reason)
    }
    // 空响应体也算失败：存下去就是个 0 字节文件，用户点开一片空白还以为功能坏了
    if (blob.size === 0)
      throw new Error('后端返回了空文件（该问题可能没有可打包的日志与报告）')

    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    // **不能同步 revoke**：部分浏览器会在读取 blob 之前就失效，
    // 结果保存下来是 0 字节文件。downloadText 早已用 rAF 修过同样的坑，
    // 这里漏了 —— 「下载的 zip 是空的」就是这么来的。
    requestAnimationFrame(() => URL.revokeObjectURL(objectUrl))
  }

  /** 下载失败时统一提示，返回是否成功 */
  /**
   * 下载失败时提示。**优先显示后端给的真实原因**，`errorTip` 只作兜底 ——
   * 「原始日志打包失败」这种笼统话对排查毫无帮助，而后端已经写清了
   * 是过了留存期还是 work_dir 变了。
   */
  const downloadWithTip = async (path: string, filename: string, errorTip: string) => {
    try {
      await download(path, filename)
      return true
    }
    catch (e: any) {
      const reason = e?.message ? String(e.message) : ''
      Message.error(reason && !reason.startsWith('HTTP ') ? reason : errorTip)
      return false
    }
  }

  return { download, downloadWithTip }
}
