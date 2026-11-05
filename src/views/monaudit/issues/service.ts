/**
 * 问题清单取数（service 层）：列表 / 左树 / 详情 / 处理动作。
 *
 * 失败一律返回 null（拦截器已弹原因）；单条编辑需要识别乐观锁冲突，走 requestWithError。
 */
import type { RequestOutcome } from '../shared/service'
import type { BatchResult, ListData } from '../shared/types'
import type { ClassifyForm, HandleForm, IssueDetail, IssueRow, ScopeTreeNode, TraceLogLine, TransitionAction } from './types'
import { ApiMonauditIssue } from '@/api/monauditApis'
import { getAction, postAction } from '@/hooks'
import { requestWithError } from '../shared/service'
import { compactQuery, nullable } from '../shared/types'

export function fetchIssues(query: object): Promise<ListData<IssueRow> | null> {
  return getAction<ListData<IssueRow>>(ApiMonauditIssue.getList, compactQuery(query))
}

/** 左树：query 已剔除左树范围（树结构不随点选塌缩） */
export function fetchIssueTree(query: object): Promise<ScopeTreeNode | null> {
  return getAction<ScopeTreeNode>(ApiMonauditIssue.tree, compactQuery(query))
}

export function fetchIssueDetail(id: string): Promise<IssueDetail | null> {
  return getAction<IssueDetail>(ApiMonauditIssue.getById, { id })
}

export async function fetchTraceLog(id: string): Promise<TraceLogLine[] | null> {
  const lines = await getAction<TraceLogLine[]>(ApiMonauditIssue.traceLog, { id })
  if (lines === null)
    return null
  return Array.isArray(lines) ? lines : []
}

/** 单条编辑（version 乐观锁） */
export function editIssue(id: string, version: number, form: HandleForm): Promise<RequestOutcome<unknown>> {
  return requestWithError<unknown>('put', ApiMonauditIssue.edit, {
    id,
    version,
    plan_finish_date: nullable(form.plan_finish_date),
    story_no: nullable(form.story_no),
    defect_code: nullable(form.defect_code),
    handle_note: nullable(form.handle_note),
  })
}

/** 批量填写：空字段不出现 = 不修改 */
export function batchEditIssues(ids: string[], form: HandleForm): Promise<BatchResult | null> {
  const payload: Record<string, unknown> = { ids }
  for (const key of ['plan_finish_date', 'story_no', 'defect_code', 'handle_note'] as const) {
    const value = nullable(form[key])
    if (value !== null)
      payload[key] = value
  }
  return postAction<BatchResult>(ApiMonauditIssue.batchEdit, payload)
}

/** 分派；handlerId 为空 = 取消分派 */
export function assignIssues(ids: string[], handlerId: string): Promise<BatchResult | null> {
  return postAction<BatchResult>(ApiMonauditIssue.assign, { ids, handler_id: nullable(handlerId) })
}

export function classifyIssues(ids: string[], form: ClassifyForm): Promise<BatchResult | null> {
  return postAction<BatchResult>(ApiMonauditIssue.classify, {
    ids,
    project_group_id: form.project_group_id,
    create_mapping: form.create_mapping,
  })
}

export function transitionIssues(ids: string[], action: TransitionAction, reason: string): Promise<BatchResult | null> {
  return postAction<BatchResult>(ApiMonauditIssue.transition, { ids, action, reason: nullable(reason) })
}

/** 重新抓取样例 traceId 的日志（同步执行，可能较慢） */
export async function refetchIssueLog(id: string): Promise<boolean> {
  return (await postAction<unknown>(ApiMonauditIssue.refetchLog, { id })) !== null
}
