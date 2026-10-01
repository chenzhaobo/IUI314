/**
 * 资源四步诊断的取数（View → Composable → Service → Api 的 service 层）。
 */
import type { DiagnosisAiResult, DiagnosisRow, ToIssueResult } from './types'
import { ApiPerfObserveDiagnosis } from '@/api/perfObserveApis'
import { getAction, postAction } from '@/hooks'

/** 诊断台账（后端已按四步顺序返回，前端展示再按固定顺序重排兜底） */
export function fetchDiagnosisList(scope: string, scopeId: string): Promise<DiagnosisRow[] | null> {
  return getAction<DiagnosisRow[]>(ApiPerfObserveDiagnosis.list, { scope, scope_id: scopeId })
}

/** 诊断转缺陷（仅 hit 可转；同指纹未关闭缺陷直接关联，不新建） */
export function convertToIssue(diagnosisId: string): Promise<ToIssueResult | null> {
  return postAction<ToIssueResult>(ApiPerfObserveDiagnosis.toIssue, { diagnosis_id: diagnosisId })
}

/** AI 解读（后端真调 AI，耗时可达数分钟；结果存 perf_analysis_report） */
export function interpretDiagnosis(scope: string, scopeId: string): Promise<DiagnosisAiResult | null> {
  return postAction<DiagnosisAiResult>(ApiPerfObserveDiagnosis.ai, { scope, scope_id: scopeId })
}
