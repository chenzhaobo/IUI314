/**
 * @description: 性能观测 API（101e：资源视图、指标模板、摸底压测、复跑台账、火焰图、诊断）
 *
 * 与 perfApis.ts（脚本/任务/报告/比对）分开：这一组是 `/perf/observe/*` 下的新接口。
 *
 * 契约以已合入后端 `ttp-ro-be-final@dbf4f25d` 的
 * `api/src/perf/observe.rs` + `service/src/perf/observe/{query,rerun,probe,flame,diagnosis,diagnosis_ai}.rs`
 * 为准（101h 火焰图、101i 诊断均已合入并核对）。
 */

// ── run 观测视图（query.rs）─────────────────────────
export enum ApiPerfObserveRun {
  /** GET ?run_id= → RunMetricsView */
  metrics = '/perf/observe/run/metrics',
  /** GET ?task_id= → TaskResourceView */
  taskResource = '/perf/observe/task/resource',
  /** GET ?id= → SnapshotView（含硬件档位） */
  snapshotGet = '/perf/observe/snapshot/get',
}

// ── 指标模板维护（query.rs）─────────────────────────
export enum ApiPerfObserveTemplate {
  list = '/perf/observe/templates/list',
  edit = '/perf/observe/templates/edit',
  add = '/perf/observe/templates/add',
}

// ── 基准回归复跑台账（rerun.rs）─────────────────────
export enum ApiPerfObserveRerun {
  taskRerun = '/perf/observe/task/rerun',
  resume = '/perf/observe/task/rerun/resume',
}

// ── 摸底压测编排（probe.rs）─────────────────────────
export enum ApiPerfObserveProbe {
  conformance = '/perf/observe/probe/conformance',
  create = '/perf/observe/probe/create',
  list = '/perf/observe/probe/list',
  get = '/perf/observe/probe/get',
  cancel = '/perf/observe/probe/cancel',
  override = '/perf/observe/probe/override',
}

// ── 火焰图（101h，flame.rs）─────────────────────────
export enum ApiPerfObserveFlame {
  /** GET ?run_id= → FlameVo[]（台账，时间序） */
  list = '/perf/observe/flame/list',
  /** GET ?id= → 火焰图 HTML 原文（需 Authorization；text/html + CSP sandbox） */
  html = '/perf/observe/flame/html',
  /** GET ?id=&n=20 → TopRow[]（self/total 占比，%） */
  top = '/perf/observe/flame/top',
  /** GET ?base=&cur=&n=30 → DiffRow[]；任一不可差分返回 400 并说明 */
  diff = '/perf/observe/flame/diff',
}

// ── 资源四步诊断（101i，diagnosis.rs / diagnosis_ai.rs）─────
export enum ApiPerfObserveDiagnosis {
  /** GET ?scope=&scope_id= → perf_run_diagnosis 行（四步固定顺序） */
  list = '/perf/observe/diagnosis/list',
  /** POST {diagnosis_id} → ToIssueResult（仅 hit 可转，同指纹未关闭缺陷直接关联） */
  toIssue = '/perf/observe/diagnosis/to-issue',
  /** POST {scope, scope_id} → InterpretResult（结果存 perf_analysis_report，返回 report_id） */
  ai = '/perf/observe/diagnosis/ai',
}

// ── 取证跑（101h，flame.rs start_evidence）──────────
export enum ApiPerfObserveEvidence {
  /** POST {run_id, event?} → 新 run_id（Res<String>）；采样-执行-归档在 job 里串行 */
  create = '/perf/observe/evidence',
}
