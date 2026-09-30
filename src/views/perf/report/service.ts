/**
 * 报告页「资源数据」页签的取数（View → Composable → Service → Api 的 service 层）。
 *
 * 两个接口都是按 run 单点查：`run/metrics` 给指标行 + 事务级资源 + 快照摘要，
 * `snapshot/get` 再按快照 id 补硬件档位（副本/限额）。
 */
import type { RunMetricsView, SnapshotView } from './types'
import { ApiPerfObserveRun } from '@/api/perfObserveApis'
import { getAction } from '@/hooks'

/** 单 run 观测视图（不存在时后端按错误返回，getAction 已提示） */
export function fetchRunMetrics(runId: string): Promise<RunMetricsView | null> {
  return getAction<RunMetricsView>(ApiPerfObserveRun.metrics, { run_id: runId })
}

/** 环境快照详情（含硬件档位；run 未挂快照时不需要调用） */
export function fetchSnapshot(snapshotId: string): Promise<SnapshotView | null> {
  return getAction<SnapshotView>(ApiPerfObserveRun.snapshotGet, { id: snapshotId })
}
