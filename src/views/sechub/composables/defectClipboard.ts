/**
 * 缺陷标题 / Markdown 内容复制。
 *
 * 内网 http（非安全上下文）下 `navigator.clipboard` 常被浏览器禁掉，
 * 此时提示用户手动全选，而不是静默失败。
 */
import { Message } from '@arco-design/web-vue'

export async function copyDefectText(text: string, label: string): Promise<boolean> {
  if (!text) {
    Message.warning(`没有可复制的${label}`)
    return false
  }
  try {
    await navigator.clipboard.writeText(text)
    Message.success(`已复制${label}`)
    return true
  }
  catch {
    Message.info('复制失败，请手动选择内容')
    return false
  }
}
