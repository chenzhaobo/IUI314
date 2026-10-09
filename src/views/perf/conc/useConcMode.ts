/**
 * 触发弹窗的「基准模式 + 固化条件摘要」逻辑（task.vue / test-plan.vue 共用）。
 *
 * 并发模式下平台按 profile 下发 `-Jthreads/-Jrampup/-Jduration`，忽略请求里的
 * 线程/爬坡/循环/时长（design §3.2），所以表单要隐藏这几项，并逐个脚本展示将使用的
 * profile；**缺任一 profile 后端整单拒绝**，页面用红色提示提前暴露。
 */
import type { BenchMode, ConcProfile } from './types'
import { computed, ref } from 'vue'
import { fetchPlanScripts, fetchProfileByScript } from './service'
import { BENCH_MODE_CONCURRENT, BENCH_MODE_SINGLE } from './types'

/** 摘要里的一个脚本行 */
export interface ConcScriptProfile {
  scriptId: string
  scriptName: string
  /** null = 该脚本未固化并发 profile（触发会被整单拒绝） */
  profile: ConcProfile | null
}

export function useConcMode() {
  const mode = ref<BenchMode>(BENCH_MODE_SINGLE)
  const scripts = ref<ConcScriptProfile[]>([])
  const loading = ref(false)
  /**
   * 取数序号：脚本多选会连续变化，`Promise.all` 不保证落地顺序，
   * 用序号丢弃过期响应，避免旧结果覆盖新选择（摘要与实际将执行的脚本不一致）。
   */
  let seq = 0

  const isConcurrent = computed(() => mode.value === BENCH_MODE_CONCURRENT)
  /** 缺 profile 的脚本（>0 时后端会整单拒绝） */
  const missing = computed(() => scripts.value.filter(s => !s.profile))
  const ready = computed(() => scripts.value.length > 0 && missing.value.length === 0)

  /** 逐个脚本 profile/get（后端没有批量接口，脚本量级为个位数） */
  async function loadProfiles(list: Array<{ id: string, name?: string | null }>) {
    const current = ++seq
    const normalized = list.map(s => ({ scriptId: s.id, scriptName: s.name || s.id, profile: null as ConcProfile | null }))
    scripts.value = normalized
    if (list.length === 0) {
      loading.value = false
      return
    }
    loading.value = true
    const rows = await Promise.all(list.map(async (s, i) => ({
      ...normalized[i],
      profile: await fetchProfileByScript(s.id),
    })))
    if (current !== seq)
      return
    scripts.value = rows
    loading.value = false
  }

  /** 计划触发：脚本列表由 preview 动态解析（领域关联 + 额外脚本 - 排除） */
  async function loadPlanProfiles(planId: string) {
    const options = await fetchPlanScripts(planId)
    if (!options)
      return
    await loadProfiles(options.map(o => ({ id: o.value, name: o.label })))
  }

  /** 每次打开弹窗重置，避免残留上一次的模式与摘要 */
  function reset() {
    seq += 1
    mode.value = BENCH_MODE_SINGLE
    scripts.value = []
    loading.value = false
  }

  return { mode, isConcurrent, scripts, loading, missing, ready, loadProfiles, loadPlanProfiles, reset }
}
