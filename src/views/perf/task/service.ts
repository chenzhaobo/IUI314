/**
 * 批次观测抽屉的取数（View → Composable → Service → Api 的 service 层）。
 *
 * `task/resource` 与 `task/rerun` 都是按 task_id 单点查，一次取全（批次的
 * run 量级在一批 915 个脚本以内，且排行/曲线都由后端聚合好，不分页）。
 */
import type { EvidenceRunPayload, TaskRerunView, TaskResourceView } from './types'
import { ApiPerfObserveEvidence, ApiPerfObserveRerun, ApiPerfObserveRun } from '@/api/perfObserveApis'
import { getAction, postAction } from '@/hooks'

/** 批次资源视图：run 排行 + 批次曲线 + 各 run 窗口 */
export function fetchTaskResource(taskId: string): Promise<TaskResourceView | null> {
  return getAction<TaskResourceView>(ApiPerfObserveRun.taskResource, { task_id: taskId })
}

/** 批次复跑台账：observe_state + 各脚本裁决 */
export function fetchTaskRerun(taskId: string): Promise<TaskRerunView | null> {
  return getAction<TaskRerunView>(ApiPerfObserveRerun.taskRerun, { task_id: taskId })
}

/** `env_suspect` 后人工恢复复跑（后端只在该状态下生效，重复调用无害） */
export function resumeTaskRerun(taskId: string): Promise<string | null> {
  return postAction<string>(ApiPerfObserveRerun.resume, { task_id: taskId })
}

/**
 * 对单个 run 发起取证跑（后端 `flame.rs::start_evidence`，已核对）。
 * 返回新 run_id（克隆原 run，run_mode=evidence / compare_role=aux，数值不参与基线比对）；
 * 采样-执行-归档在 job 里串行进行。
 */
export function createEvidenceRun(payload: EvidenceRunPayload): Promise<string | null> {
  return postAction<string>(ApiPerfObserveEvidence.create, payload)
}
