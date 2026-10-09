/**
 * @description: 并发基准 API（111：固化/人工确认、profile 与基线查询、判定结果）
 *
 * 与 perfApis.ts（脚本/任务/报告/比对）分开：这一组是 `/perf/conc/*` 下的新接口。
 *
 * 契约以已合入后端 `api/src/perf/conc.rs` + `service/src/perf/conc/{profile,judge}.rs` 为准。
 * 注意 `profile/get` 的 data 是 `Option<Model>`：脚本未固化时接口成功但 data 为 null。
 */

// ── 并发基准（design specs/101-perf-observability/conc-baseline.md §4）──
export enum ApiPerfConc {
  /** POST {run_id} → {profile_id, txn_count}：把成功 run 的条件固化为 profile + 并发基线 */
  promote = '/perf/conc/promote',
  /** GET ?page_num=&page_size= → {list, total, total_pages, page_num}（带脚本名、基线事务数） */
  profileList = '/perf/conc/profile/list',
  /** GET ?script_id= → Model | null（脚本当前生效的 profile） */
  profileGet = '/perf/conc/profile/get',
  /** POST {ids} → 软删条数文案（历史基线与判定结果保留） */
  profileDelete = '/perf/conc/profile/delete',
  /** GET ?profile_id= → 逐事务基线明细 */
  baselineList = '/perf/conc/baseline/list',
  /** POST {run_id} → {profile_id, txn_count}：人工把某次判定结果确认为新基线 */
  baselineAccept = '/perf/conc/baseline/accept',
  /** GET ?run_id= | ?task_id= → 逐事务判定结果（reasons 为中文原因为字符串数组） */
  resultList = '/perf/conc/result/list',
}
