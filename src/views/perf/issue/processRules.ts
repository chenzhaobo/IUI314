/**
 * 缺陷处理流转「要不要写说明」的规则 —— 与后端 `defect_process::remark_required` 保持一致。
 *
 * 结论性的推进要留依据：已修复（改了什么）、已发版（哪个版本）、已验证（凭什么判定）、
 * 不处理（为什么不修）；两类推翻也要：从已发版 / 已验证退回、把别人手上的单转给另一个人。
 * 认领无主的单、推进到修复中不强制。改这里要同步改后端，否则会出现
 * 「页面放行、后端拒绝」或「页面拦了、其实后端允许」。
 */

export interface ProcessRow {
  process_status?: string | null
  process_owner?: string | null
}

const CONCLUSIVE = ['fixed', 'released', 'verified', 'wont_fix']
const SETTLED = ['released', 'verified']

export function remarkRequired(row: ProcessRow, target: string, owner?: string): boolean {
  if (CONCLUSIVE.includes(target))
    return true
  if ((target === 'fixing' || target === 'claimed') && SETTLED.includes(String(row.process_status || '')))
    return true
  if (target === 'claimed') {
    const prev = String(row.process_owner || '').trim()
    const next = String(owner || '').trim()
    return !!prev && !!next && prev !== next
  }
  return false
}

/** 批量：任一行需要说明就要求填写。 */
export function anyRemarkRequired(rows: ProcessRow[], target: string, owner?: string): boolean {
  return rows.some(r => remarkRequired(r, target, owner))
}

/** 说明框的标签与示例。 */
export function remarkPrompt(target: string): { label: string, placeholder: string } {
  switch (target) {
    case 'fixed':
      return { label: '修复说明', placeholder: '改了什么、对应的提交或补丁号' }
    case 'released':
      return { label: '发版说明', placeholder: '版本号、上线时间' }
    case 'verified':
      return { label: '验证依据', placeholder: '看了哪段时间的数据、达标率 / 耗时结论' }
    case 'fixing':
      return { label: '说明', placeholder: '从已发版 / 已验证退回时写明为什么判定失效' }
    default:
      return { label: '说明', placeholder: '会记入流转记录' }
  }
}

/** 处理进度的显示标签与颜色（与问题列表「处理进度」列同口径）；空值 = 还没转交。 */
const PROCESS_DISPLAY: Record<string, { label: string, color: string }> = {
  claimed: { label: '已认领', color: 'blue' },
  fixing: { label: '修复中', color: 'orange' },
  fixed: { label: '已修复', color: 'cyan' },
  released: { label: '已发版', color: 'green' },
  verified: { label: '已验证', color: 'green' },
  wont_fix: { label: '不处理', color: 'gray' },
}

export function processDisplay(status?: string | null): { label: string, color: string } {
  return PROCESS_DISPLAY[String(status || '')] ?? { label: '未转交', color: 'red' }
}
