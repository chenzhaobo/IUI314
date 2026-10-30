/**
 * 「缺陷详情」请求证据的展示规则（纯函数，便于脱离 Vue 单测）。
 *
 * 字段以后端 `defect_evidence::RequestEvidence` 为准：headers 是二元组数组，
 * `from_evidence=false` 表示请求是按用例定义回填的，不是真实记录。
 */
import type { ReleaseRequestEvidence } from '@/types/sechub-release'

interface EvidenceSource {
  full_url?: string | null
  request?: ReleaseRequestEvidence | null
}

function nonEmpty(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** 请求地址：优先完整地址，缺失时回退证据里的 path */
export function evidenceUrl(detail: EvidenceSource | null | undefined): string {
  const full = nonEmpty(detail?.full_url)
  if (full)
    return full
  return nonEmpty(detail?.request?.path)
}

/** 请求行（方法 + 完整地址），没有 request 时返回空串 */
export function requestLine(request: ReleaseRequestEvidence | null | undefined, url: string): string {
  if (!request)
    return ''
  return `${request.method} ${url}`.trim()
}

/** 是否取到了实际请求记录（false 时页面要提示「以下为用例定义」） */
export function hasActualEvidence(request: ReleaseRequestEvidence | null | undefined): boolean {
  return request?.from_evidence === true
}

/**
 * 验证脚本下载文件名，与后端 `verify_script::script_filename` 一致：
 * 仅保留 ASCII 字母数字 / `-` / `_`，其余替换为 `_`；空编号回退 defect。
 */
export function verifyScriptFilename(defectCode: string): string {
  const safe = Array.from(defectCode.trim())
    .map(ch => (/^[\w-]$/.test(ch) ? ch : '_'))
    .join('')
  return `verify_${safe || 'defect'}.py`
}
