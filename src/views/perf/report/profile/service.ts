/**
 * 「性能剖析」页签的取数（View → Composable → Service → Api 的 service 层）。
 *
 * 火焰图 HTML 不走 getAction：响应体是 text/html 原文（不是统一 Res 信封），
 * 需要带 Authorization 取 Blob 再交给 iframe 的 sandbox（D17：归档不在免鉴权目录）。
 * 其余四个接口都是标准信封。
 */
import type { FlameDiffRow, FlameRow, FlameTopRow } from './types'
import { ApiPerfObserveEvidence, ApiPerfObserveFlame } from '@/api/perfObserveApis'
import { getAction, postAction, useToken } from '@/hooks'

/** run 的火焰图台账（时间序） */
export function fetchFlameList(runId: string): Promise<FlameRow[] | null> {
  return getAction<FlameRow[]>(ApiPerfObserveFlame.list, { run_id: runId })
}

/** 热点方法 Top N（self/total 占比，%） */
export function fetchFlameTop(id: string, n = 20): Promise<FlameTopRow[] | null> {
  return getAction<FlameTopRow[]>(ApiPerfObserveFlame.top, { id, n })
}

/** 差分 Top N；任一不可差分时后端返回业务错误（getAction 已提示 msg） */
export function fetchFlameDiff(base: string, cur: string, n = 30): Promise<FlameDiffRow[] | null> {
  return getAction<FlameDiffRow[]>(ApiPerfObserveFlame.diff, { base, cur, n })
}

/** 发起取证跑：返回新 run_id（数值标记 aux，不参与基线比对） */
export function startEvidenceRun(runId: string, event: string): Promise<string | null> {
  return postAction<string>(ApiPerfObserveEvidence.create, { run_id: runId, event })
}

/**
 * 取火焰图 HTML 原文（带 Authorization）。失败时后端回统一 JSON 信封，
 * 这里解出 msg 抛给调用方提示；成功返回 Blob（页面由 iframe 以 sandbox 渲染）。
 */
export async function fetchFlameHtmlBlob(id: string): Promise<Blob> {
  const { token } = useToken()
  const base = import.meta.env.VITE_API_BASE_URL || ''
  const resp = await fetch(`${base}${ApiPerfObserveFlame.html}?id=${encodeURIComponent(id)}`, {
    headers: { Authorization: token },
  })
  const contentType = resp.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const body: { msg?: string } | null = await resp.json().catch(() => null)
    throw new Error(body?.msg || '火焰图读取失败')
  }
  if (!resp.ok)
    throw new Error(`火焰图读取失败（HTTP ${resp.status}）`)
  return resp.blob()
}
