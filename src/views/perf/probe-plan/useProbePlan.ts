import type { CreateProbePayload, ProbePlanView } from './types'
/**
 * 摸底压测页的状态与取数（View → Composable → Service → Api）。
 *
 * 列表按环境 / 状态过滤（后端最多 200 行，不分页）；详情抽屉打开时取一次
 * `probe/get`，运行中的计划可「刷新」「改写下一档并发」「取消」。
 */
import type { SelectOption } from '@/types/static-scan'
import { Message, Modal } from '@arco-design/web-vue'
import { computed, ref } from 'vue'
import {
  cancelProbePlan,
  createProbePlan,
  fetchEnvOptions,
  fetchLoadNodeOptions,
  fetchProbePlan,
  fetchProbePlans,
  fetchScriptOptions,
  overrideNextThreads,
} from './service'
import { isTerminalStatus } from './types'

export function useProbePlan() {
  const loading = ref(false)
  const plans = ref<ProbePlanView[]>([])
  const envFilter = ref('')
  const statusFilter = ref('')
  const envOptions = ref<SelectOption[]>([])
  const scriptOptions = ref<SelectOption[]>([])
  const loadNodeOptions = ref<SelectOption[]>([])

  async function load() {
    loading.value = true
    try {
      const rows = await fetchProbePlans({
        env_id: envFilter.value || undefined,
        status: statusFilter.value || undefined,
      })
      if (rows)
        plans.value = rows
    }
    finally {
      loading.value = false
    }
  }

  /** 三个下拉都取全量；失败不清空（保留上次结果，避免下拉变空） */
  async function loadOptions() {
    const [envs, scripts, nodes] = await Promise.all([fetchEnvOptions(), fetchScriptOptions(), fetchLoadNodeOptions()])
    if (envs)
      envOptions.value = envs
    if (scripts)
      scriptOptions.value = scripts
    if (nodes)
      loadNodeOptions.value = nodes
  }

  async function loadAll() {
    await Promise.all([load(), loadOptions()])
  }

  // ── 新建计划 ─────────────────────────────────────
  const createVisible = ref(false)
  const creating = ref(false)

  async function submitCreate(payload: CreateProbePayload) {
    creating.value = true
    try {
      const id = await createProbePlan(payload)
      if (id === null)
        return
      Message.success('计划已创建，正在排队执行')
      createVisible.value = false
      await load()
    }
    finally {
      creating.value = false
    }
  }

  // ── 详情抽屉 ─────────────────────────────────────
  const detailVisible = ref(false)
  const detailLoading = ref(false)
  const detail = ref<ProbePlanView | null>(null)
  let seq = 0

  async function openDetail(record: ProbePlanView) {
    detailVisible.value = true
    await refreshDetail(record.id)
  }

  async function refreshDetail(planId?: string) {
    const id = planId ?? detail.value?.id ?? ''
    if (!id)
      return
    const cur = ++seq
    detailLoading.value = true
    try {
      const row = await fetchProbePlan(id)
      if (cur !== seq)
        return
      if (row)
        detail.value = row
    }
    finally {
      if (cur === seq)
        detailLoading.value = false
    }
  }

  // ── 运行中操作 ───────────────────────────────────
  const overrideThreads = ref<number | undefined>(undefined)
  const overriding = ref(false)
  const cancelling = ref(false)

  const canOperate = computed(() => Boolean(detail.value) && !isTerminalStatus(detail.value?.status ?? ''))

  async function submitOverride() {
    const plan = detail.value
    if (!plan)
      return
    const threads = overrideThreads.value
    if (!threads || threads < 1) {
      Message.warning('请输入下一档并发（≥ 1）')
      return
    }
    if (threads > plan.max_threads) {
      Message.warning(`下一档并发必须在 1..=${plan.max_threads} 之间`)
      return
    }
    overriding.value = true
    try {
      const res = await overrideNextThreads({ plan_id: plan.id, next_threads: threads })
      if (res === null)
        return
      Message.success(res || '已排队到下一档位生效')
      overrideThreads.value = undefined
      await refreshDetail(plan.id)
    }
    finally {
      overriding.value = false
    }
  }

  function confirmCancel() {
    const plan = detail.value
    if (!plan)
      return
    Modal.confirm({
      title: '取消摸底计划',
      content: `确认取消「${plan.name}」？已改动的硬件会走恢复流程。`,
      okText: '取消计划',
      cancelText: '再想想',
      onOk: async () => {
        cancelling.value = true
        try {
          const res = await cancelProbePlan(plan.id)
          if (res === null)
            return
          Message.success(res || '已取消')
          await refreshDetail(plan.id)
          await load()
        }
        finally {
          cancelling.value = false
        }
      },
    })
  }

  return {
    loading,
    plans,
    envFilter,
    statusFilter,
    envOptions,
    scriptOptions,
    loadNodeOptions,
    load,
    loadAll,
    createVisible,
    creating,
    submitCreate,
    detailVisible,
    detailLoading,
    detail,
    openDetail,
    refreshDetail,
    canOperate,
    overrideThreads,
    overriding,
    submitOverride,
    confirmCancel,
    cancelling,
  }
}
