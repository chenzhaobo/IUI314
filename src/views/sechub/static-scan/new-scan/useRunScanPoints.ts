/**
 * AI 确认「范围」下拉：全部 / 某个扫描点（契约 C：后端 scope 已支持 scan_point_id，前端开放）。
 *
 * 数据源选最便宜的现成接口：/prescan/summary?run_id= 已按扫描点聚合了该 run 的候选
 * （扫描点 id、名称、候选数），不必再拉候选列表或规则树。批量入口按多个 run 并行取并合并，
 * 同时记下每个 run 含哪些扫描点，提交时跳过不含所选扫描点的 run。
 */
import type { AiConfirmScopeOption } from './types'
import type { ScanPointSummaryRow } from '@/types/static-scan'
import { computed, ref } from 'vue'
import { domainLabels } from '../labels'
import { fetchRunScanPoints } from './service'

/** 「全部」范围的取值（与后端 default_scope 一致） */
export const AI_CONFIRM_SCOPE_ALL = 'all'

interface MergedScanPoint {
  id: string
  name: string
  domain: string
  candidates: number
}

export function useRunScanPoints() {
  const mergedPoints = ref<MergedScanPoint[]>([])
  const loadingScanPoints = ref(false)
  /** run_id → 该 run 内出现过的扫描点 id */
  const pointsByRun = new Map<string, Set<string>>()
  let seq = 0

  const scopeOptions = computed<AiConfirmScopeOption[]>(() => [
    { value: AI_CONFIRM_SCOPE_ALL, label: '全部' },
    ...mergedPoints.value.map(point => ({
      value: point.id,
      label: `${point.name} · ${domainLabels[point.domain] ?? point.domain} · 候选 ${point.candidates}`,
    })),
  ])

  function merge(rowsByRun: ScanPointSummaryRow[][]): MergedScanPoint[] {
    const merged = new Map<string, MergedScanPoint>()
    for (const rows of rowsByRun) {
      for (const row of rows) {
        if (!row.scan_point_id)
          continue
        const current = merged.get(row.scan_point_id)
        if (current)
          current.candidates += row.candidate_count ?? 0
        else
          merged.set(row.scan_point_id, { id: row.scan_point_id, name: row.scan_point_name || row.scan_point_id, domain: row.domain, candidates: row.candidate_count ?? 0 })
      }
    }
    return [...merged.values()].sort((a, b) => b.candidates - a.candidates)
  }

  /** 加载一个或多个 run 的扫描点（失败的 run 视为没有扫描点，下拉至少保留「全部」） */
  async function loadScanPoints(runIds: string[]) {
    const current = ++seq
    pointsByRun.clear()
    mergedPoints.value = []
    if (runIds.length === 0)
      return
    loadingScanPoints.value = true
    try {
      const rowsByRun = await Promise.all(runIds.map(runId => fetchRunScanPoints(runId)))
      if (current !== seq)
        return
      runIds.forEach((runId, index) => pointsByRun.set(runId, new Set(rowsByRun[index].map(row => row.scan_point_id))))
      mergedPoints.value = merge(rowsByRun)
    }
    finally {
      if (current === seq)
        loadingScanPoints.value = false
    }
  }

  /** 该 run 是否含所选范围（「全部」恒为 true） */
  function runHasScope(runId: string, scope: string): boolean {
    return scope === AI_CONFIRM_SCOPE_ALL || (pointsByRun.get(runId)?.has(scope) ?? false)
  }

  return {
    scopeOptions,
    loadingScanPoints,
    loadScanPoints,
    runHasScope,
  }
}
