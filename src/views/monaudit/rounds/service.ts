/**
 * 自动化轮次取数（service 层）。结算需要按错误原因决定是否提示强制结算，走 requestWithError。
 */
import type { RequestOutcome } from '../shared/service'
import type { ListData } from '../shared/types'
import type { RoundCreateForm, RoundDetail, RoundRow, SettleStats } from './types'
import { ApiMonauditRound } from '@/api/monauditApis'
import { getAction, parseTimeInput, postAction } from '@/hooks'
import { requestWithError } from '../shared/service'
import { compactQuery, nullable } from '../shared/types'

export function fetchRounds(query: object): Promise<ListData<RoundRow> | null> {
  return getAction<ListData<RoundRow>>(ApiMonauditRound.getList, compactQuery(query))
}

export function fetchRoundDetail(id: string): Promise<RoundDetail | null> {
  return getAction<RoundDetail>(ApiMonauditRound.getById, { id })
}

/** 新建轮次；data_since 转 RFC3339（按用户时区解释后转 UTC） */
export function createRound(form: RoundCreateForm): Promise<string | null> {
  const since = parseTimeInput(form.data_since)
  return postAction<string>(ApiMonauditRound.create, {
    round_no: nullable(form.round_no),
    name: nullable(form.name),
    data_since: since ? since.toISOString() : null,
    remark: nullable(form.remark),
  })
}

/** 开始同步；sourceIds 为空 = 全部启用的同步源 */
export function syncRound(roundId: string, sourceIds: string[]): Promise<string[] | null> {
  return postAction<string[]>(ApiMonauditRound.sync, {
    round_id: roundId,
    source_ids: sourceIds.length ? sourceIds : null,
  })
}

export function settleRound(roundId: string, force: boolean): Promise<RequestOutcome<SettleStats>> {
  return requestWithError<SettleStats>('post', ApiMonauditRound.settle, { round_id: roundId, force })
}

export async function retryBatch(batchId: string): Promise<boolean> {
  return (await postAction<unknown>(ApiMonauditRound.retry, { batch_id: batchId })) !== null
}

/** 补抓本轮日志（同步执行，可能较慢） */
export async function fetchRoundLogs(roundId: string): Promise<boolean> {
  return (await postAction<unknown>(ApiMonauditRound.fetchLogs, { round_id: roundId })) !== null
}
