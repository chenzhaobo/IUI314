/**
 * 监控审计共用取数（View → Composable → Service → Api 的 service 层）。
 *
 * 统一走 `@/hooks` 的 getAction / postAction（失败返回 null，拦截器已弹提示）；
 * 需要按后端错误原因决定下一步的场景（强制结算、乐观锁冲突）用 [`requestWithError`]。
 */
import type { BatchResult, IssueOptions, LabelValue } from './types'
import { Message, Notification } from '@arco-design/web-vue'
import { h } from 'vue'
import { ApiMonauditIssue } from '@/api/monauditApis'
import { getAction, isRequestFailed, usePost, usePut } from '@/hooks'
import { batchResultText } from './types'

/** 下拉选项：审计类型 / 轮次 / 同步源 / 可见项目组 / 是否全部范围 */
export function fetchIssueOptions(): Promise<IssueOptions | null> {
  return getAction<IssueOptions>(ApiMonauditIssue.options)
}

/** 处理人候选：项目组成员 */
export async function fetchHandlerCandidates(projectGroupId: string): Promise<LabelValue[]> {
  if (!projectGroupId)
    return []
  const list = await getAction<LabelValue[]>(ApiMonauditIssue.handlerCandidates, { project_group_id: projectGroupId })
  return Array.isArray(list) ? list : []
}

/** 带后端错误原因的请求结果（错误提示已由拦截器弹出） */
export interface RequestOutcome<T> {
  data: T | null
  error: string
}

function errorText(error: unknown): string {
  if (error instanceof Error)
    return error.message
  return error ? String(error) : ''
}

/**
 * POST / PUT 并保留错误原因。
 *
 * postAction 只给 null，拿不到原因；而强制结算要看原因里是否提到「失败」批次，
 * 单条编辑要识别「已被他人修改」后刷新，所以这里直接用组合式请求读 `error`。
 */
export async function requestWithError<T>(method: 'post' | 'put', url: string, payload: unknown): Promise<RequestOutcome<T>> {
  const request = method === 'post'
    ? usePost<T>(url, payload, { immediate: false })
    : usePut<T>(url, payload, { immediate: false })
  await request.execute()
  const data: unknown = request.data.value
  if (isRequestFailed(data))
    return { data: null, error: errorText(request.error.value) }
  return { data: data as T, error: '' }
}

/** 批量结果提示：主句用 Message，跳过原因多时用 Notification 列出 */
export function showBatchResult(result: BatchResult): void {
  const { summary, details } = batchResultText(result)
  if (!details.length) {
    if (result.skipped > 0)
      Message.warning(summary)
    else
      Message.success(summary)
    return
  }
  Notification.info({
    title: summary,
    content: () => h('div', { style: { whiteSpace: 'pre-line' } }, details.join('\n')),
    duration: 8000,
    closable: true,
  })
}
