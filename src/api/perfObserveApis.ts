/**
 * @description: 性能观测 API（101e：run/批次资源视图、指标模板、摸底压测、复跑台账）
 *
 * 与 perfApis.ts（脚本/任务/报告/比对）分开：这一组是 `/perf/observe/*` 下的新接口。
 *
 * 契约以已合入后端 `ttp-ro-be-aac3@aac3cac6` 的
 * `api/src/perf/observe.rs` + `service/src/perf/observe/{query,rerun,probe}.rs` 为准。
 * 其中 **火焰图与诊断（101h/101i）尚未合入**，本文件只留「取证跑」入口，
 * 见文件末尾注释。
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

// ── 取证跑（101h，待后端落地核对）───────────────────
/**
 * `POST /perf/observe/evidence` 在 `aac3cac6` 中**不存在**（101h-be 未合入）。
 * 请求体按 spec R13 / plan §4.6 取最小集：`run_id`（取证对象）+ `event`
 * （cpu / alloc / lock / wall / itimer，基准回归取证默认 wall）。
 * 响应按同组其余"发起类"接口口径取 `string`（新 run id 或提示语）。
 * 后端落地后需核对：路径、事件枚举、返回体。
 */
export enum ApiPerfObserveEvidence {
  create = '/perf/observe/evidence',
}
