import type { ConformanceIssue, ConformanceReport, CreateProbePayload, HwProfile } from './types'
/**
 * 新建摸底计划的表单状态与校验（View → Composable → Service → Api）。
 *
 * 脚本选定后立即调 `probe/conformance` 做摸底规范校验（spec R11.1）：
 * 有不符合项就**禁用提交**，与后端创建时的校验保持同一份判据
 * （后端也会再校验一次，这里只是提前给反馈）。
 */
import type { SelectOption } from '@/types/static-scan'
import { Message } from '@arco-design/web-vue'
import { computed, ref } from 'vue'
import { fetchConformance, fetchWorkloadBindings } from './service'
import { emptyHwProfile, normalizeHwProfiles } from './types'

/** 表单模型（默认值取后端 `CreateProbeReq` 的缺省口径） */
export interface ProbeCreateForm {
  name: string
  env_id: string
  script_id: string
  load_node_id: string
  target_tps?: number
  k_factor: number
  probe_threads: number
  rampup_sec: number
  steady_sec: number
  stability_sec: number
  max_threads: number
  hw_profiles: HwProfile[]
}

function blankForm(): ProbeCreateForm {
  return {
    name: '',
    env_id: '',
    script_id: '',
    load_node_id: '',
    target_tps: undefined,
    k_factor: 2,
    probe_threads: 1,
    rampup_sec: 60,
    steady_sec: 300,
    stability_sec: 1200,
    max_threads: 2000,
    hw_profiles: [emptyHwProfile(0)],
  }
}

export function useProbeCreate() {
  const form = ref<ProbeCreateForm>(blankForm())
  const conformance = ref<ConformanceReport | null>(null)
  const conformanceLoading = ref(false)
  const bindingOptions = ref<SelectOption[]>([])
  const bindingsLoading = ref(false)
  let confSeq = 0
  let bindSeq = 0

  function reset() {
    form.value = blankForm()
    conformance.value = null
    bindingOptions.value = []
  }

  /** 选脚本后校验；清空脚本时同步清结果 */
  async function checkScript(scriptId?: string) {
    const id = scriptId ?? form.value.script_id
    if (!id) {
      conformance.value = null
      return
    }
    const cur = ++confSeq
    conformanceLoading.value = true
    try {
      const report = await fetchConformance(id)
      if (cur !== confSeq)
        return
      conformance.value = report
    }
    finally {
      if (cur === confSeq)
        conformanceLoading.value = false
    }
  }

  /** 选环境后拉可操作的绑定部署（allow_ops=true 的工作负载） */
  async function loadBindings(envId?: string) {
    const id = envId ?? form.value.env_id
    if (!id) {
      bindingOptions.value = []
      return
    }
    const cur = ++bindSeq
    bindingsLoading.value = true
    try {
      const options = await fetchWorkloadBindings(id)
      if (cur !== bindSeq)
        return
      bindingOptions.value = options ?? []
    }
    finally {
      if (cur === bindSeq)
        bindingsLoading.value = false
    }
  }

  const conformanceIssues = computed<ConformanceIssue[]>(() => conformance.value?.issues ?? [])
  const conformanceBlocked = computed(() => Boolean(conformance.value && !conformance.value.ok))

  /** 校验并组装请求体；不通过返回 null（提示已弹出） */
  function buildPayload(): CreateProbePayload | null {
    const f = form.value
    if (!f.name.trim()) {
      Message.warning('请输入计划名称')
      return null
    }
    if (!f.env_id) {
      Message.warning('请选择环境')
      return null
    }
    if (!f.script_id) {
      Message.warning('请选择脚本')
      return null
    }
    if (conformance.value === null || !conformance.value.ok) {
      Message.warning('脚本未通过摸底规范校验，不能提交')
      return null
    }
    if (f.max_threads <= f.probe_threads) {
      Message.warning('最大并发必须大于探针并发')
      return null
    }
    if (f.steady_sec < 1 || f.stability_sec < 1) {
      Message.warning('稳态与稳定性时长必须 ≥ 1 秒')
      return null
    }
    const profiles = normalizeHwProfiles(f.hw_profiles)
    const badIndex = f.hw_profiles.findIndex(p => p.changes.some(c => c.binding_id.trim() && c.replicas === null && !c.container?.trim()))
    if (badIndex >= 0) {
      Message.warning(`档位 ${badIndex + 1} 的变更需给出副本数或容器名`)
      return null
    }
    return {
      name: f.name.trim(),
      env_id: f.env_id,
      script_id: f.script_id,
      load_node_id: f.load_node_id || undefined,
      target_tps: f.target_tps,
      k_factor: f.k_factor,
      probe_threads: f.probe_threads,
      rampup_sec: f.rampup_sec,
      steady_sec: f.steady_sec,
      stability_sec: f.stability_sec,
      max_threads: f.max_threads,
      hw_profiles: profiles,
    }
  }

  return {
    form,
    conformance,
    conformanceLoading,
    conformanceIssues,
    conformanceBlocked,
    bindingOptions,
    bindingsLoading,
    reset,
    checkScript,
    loadBindings,
    buildPayload,
  }
}
