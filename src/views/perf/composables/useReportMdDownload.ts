/**
 * 单独下载缺陷报告 md（不打包原始日志）。
 *
 * 「下载关联文件」会把原始天梯日志与 md 打成一个 zip，日志动辄几十 MB，
 * 只想把报告转给开发时太重。走 `pattern/report-md/download`：返回完整原文 ——
 * 详情接口为了不卡浏览器会截断超过 2MB 的报告，不能拿详情里的内容直接存。
 */
import { ref } from 'vue'
import { ApiPerfPatternLedger } from '@/api/perfApis'
import { useDownload } from '@/hooks'

/** 定位缺陷报告：台账编号 / id，或问题编号 / id（后端反查台账） */
export interface ReportMdKey {
  pattern?: string
  issue?: string
}

/** `编号-defect_1.md`；还不知道报告路径时用 `编号-缺陷报告.md` */
export function reportMdFileName(label: string, file?: string): string {
  const base = (file || '').split('/').pop()?.trim()
  const name = base && base.toLowerCase().endsWith('.md') ? base : '缺陷报告.md'
  return `${label || '缺陷报告'}-${name}`
}

/** 下载接口路径：空键不下发 */
export function reportMdDownloadPath(key: ReportMdKey): string {
  const params = new URLSearchParams()
  if (key.pattern)
    params.set('pattern', key.pattern)
  if (key.issue)
    params.set('issue', key.issue)
  return `${ApiPerfPatternLedger.reportMdDownload}?${params.toString()}`
}

export function useReportMdDownload() {
  const mdDownloading = ref(false)
  const { downloadWithTip } = useDownload()

  /**
   * @param key 定位键
   * @param label 文件名前缀（台账编号 / 问题编号）
   * @param file 已知的报告相对路径（详情已加载时传入，文件名更准确）
   */
  async function downloadReportMd(key: ReportMdKey, label: string, file?: string) {
    if (!key.pattern && !key.issue)
      return
    mdDownloading.value = true
    try {
      await downloadWithTip(reportMdDownloadPath(key), reportMdFileName(label, file), '缺陷报告下载失败：报告可能已随日期目录清理')
    }
    finally {
      mdDownloading.value = false
    }
  }

  return { mdDownloading, downloadReportMd }
}
