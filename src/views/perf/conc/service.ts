/**
 * 并发基准页面的取数（View/Composable → Service → Api 的 service 层）。
 *
 * 两条容易踩的口径：
 * 1. `profile/get` 的 data 是 `Option<Model>`，脚本未固化时后端成功返回 `data: null`，
 *    而请求层把 `null` 收敛成 `{}`（见 useRequest 的 afterFetch），所以**必须按 `id` 判空**，
 *    不能只看返回值是否存在。
 * 2. `result/list` 的 `run_id` / `task_id` 二选一，都空时后端返回空数组（不报错），
 *    页面侧据此提示「请先选择查询对象」。
 */
import type { BenchMode, ConcBaselineRow, ConcOption, ConcProfile, ConcProfileRow, ConcResultRow, ConcTxnOutcome, PageList } from './types'
import { ApiPerfTask, ApiPerfTestPlan } from '@/api/perfApis'
import { ApiPerfConc } from '@/api/perfConcApis'
import { getAction, postAction } from '@/hooks'

/** 固化（晋级）：把一次成功 run 的执行条件固化为脚本 profile 并写并发基线 */
export function promoteRun(runId: string): Promise<ConcTxnOutcome | null> {
  return postAction<ConcTxnOutcome>(ApiPerfConc.promote, { run_id: runId })
}

/** 人工确认：把某次 run 的判定结果确认为新基线 */
export function acceptRunBaseline(runId: string): Promise<ConcTxnOutcome | null> {
  return postAction<ConcTxnOutcome>(ApiPerfConc.baselineAccept, { run_id: runId })
}

/** 脚本当前生效的 profile；未固化返回 null（接口成功但 data 为 null） */
export async function fetchProfileByScript(scriptId: string): Promise<ConcProfile | null> {
  const profile = await getAction<ConcProfile>(ApiPerfConc.profileGet, { script_id: scriptId })
  return profile?.id ? profile : null
}

/** profile 分页列表（带脚本名与基线事务数） */
export function fetchProfiles(params: { page_num: number, page_size: number }): Promise<PageList<ConcProfileRow> | null> {
  return getAction<PageList<ConcProfileRow>>(ApiPerfConc.profileList, params)
}

/** 批量软删 profile（历史基线与判定结果保留） */
export function deleteProfiles(ids: string[]): Promise<unknown> {
  return postAction(ApiPerfConc.profileDelete, { ids })
}

/** 某个 profile 的逐事务基线明细 */
export function fetchBaselines(profileId: string): Promise<ConcBaselineRow[] | null> {
  return getAction<ConcBaselineRow[]>(ApiPerfConc.baselineList, { profile_id: profileId })
}

/** 判定结果（run_id / task_id 二选一） */
export function fetchConcResults(params: { run_id?: string, task_id?: string }): Promise<ConcResultRow[] | null> {
  return getAction<ConcResultRow[]>(ApiPerfConc.resultList, params)
}

// ── 触发弹窗用：模式与 profile 摘要 ────────────────

/**
 * 计划触发弹窗前先解析脚本列表（计划按领域动态展开，脚本 ID 只在 preview 里有）。
 * 返回 null 表示取数失败（拦截器已提示）。
 */
export async function fetchPlanScripts(planId: string): Promise<ConcOption[] | null> {
  const preview = await getAction<{ scripts?: { id: string, name?: string | null }[] }>(ApiPerfTestPlan.preview, { id: planId })
  if (!preview)
    return null
  return (preview.scripts ?? []).map(s => ({ label: s.name || s.id, value: s.id }))
}

/**
 * 并发基准任务下拉（基准报告「并发基准」页签按 task_id 查询用）。
 * bench_mode 不在任务检索参数里，按每页 200 拉回后在前端过滤：
 * 并发基准任务本就稀少，够用且不引入新接口。
 */
export async function fetchConcurrentTaskOptions(): Promise<ConcOption[] | null> {
  const page = await getAction<{ list?: { id: string, name?: string | null, bench_mode?: string | null, task_status?: string | null }[] }>(
    ApiPerfTask.getList,
    { page_num: 1, page_size: 200 },
  )
  if (!page)
    return null
  return (page.list ?? [])
    .filter(t => t.bench_mode === 'concurrent')
    .map(t => ({ label: `${t.name || t.id}（${t.task_status ?? '-'}）`, value: t.id }))
}

/** 模式单选的可选项（两处触发表单共用） */
export const BENCH_MODE_OPTIONS: ConcOption<BenchMode>[] = [
  { label: '单用户（默认）', value: 'single' },
  { label: '并发（固定并发 + 固定时长，参数取固化 profile）', value: 'concurrent' },
]
