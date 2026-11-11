/**
 * 缺陷页新增动作的取数（View → Composable → Service → Api 的 service 层）。
 * 失败返回 null（拦截器已弹后端原因），调用方不必重复提示。
 */
import type { IssueDetectionRow } from './types'
import { ApiSecPrescan } from '@/api/sechubApis'
import { getAction, postAction } from '@/hooks'

/** 007a 人工确认复现：pending_repro → open（后端写流转事件） */
export function confirmIssueRepro(issueId: string): Promise<Record<string, unknown> | null> {
  return postAction<Record<string, unknown>>(ApiSecPrescan.issueConfirmRepro, { issue_id: issueId })
}

/** 契约 A：某缺陷的全部检出记录（按检出时间倒序）；失败返回 null */
export async function fetchIssueDetections(issueId: string): Promise<IssueDetectionRow[] | null> {
  const data = await getAction<IssueDetectionRow[]>(ApiSecPrescan.issueDetections, { issue_id: issueId })
  if (data === null)
    return null
  return Array.isArray(data) ? data : []
}
