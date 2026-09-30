/**
 * 环境资源绑定页的状态与取数（View → Composable → Service → Api）。
 *
 * 数据流：一次 `fetchBindings(envId)` 取回该环境全部行（含未确认候选与已忽略行），
 * 前端按 `isEffectiveBinding` 拆成「生效绑定表」与「候选区」——判定与后端
 * `binding::list` 的默认过滤逐字一致（见 ./types）。
 */
import type { BindingForm, BindingNameMaps, BindingRow, ClusterSelectOption, DiscoverForm, PerfEnvRow } from './types'
import type { SelectOption } from '@/types/static-scan'
import { Message, Modal } from '@arco-design/web-vue'
import { computed, reactive, ref } from 'vue'
import {
  confirmBindings,
  createBinding,
  discoverBindings,
  editBinding,
  fetchBindings,
  fetchClusterOptions,
  fetchMonitorSourceOptions,
  fetchPerfEnvs,
  fetchPrometheusOptions,
  fetchServiceOptions,
  fetchVmOptions,
  ignoreBindings,
  unbindBindings,
} from './service'
import {
  bindingResourceText,
  buildBindingPayload,
  buildDiscoverPayload,
  emptyBindingForm,
  emptyDiscoverForm,
  isEffectiveBinding,
  optionValueMap,
  validateBindingForm,
  validateDiscoverForm,
} from './types'

export function useEnvBinding() {
  /**
   * 绑定行状态先于环境声明：环境切换要立刻清空上一个环境的行，
   * 不能等 loadBindings 回来（否则会短暂看到别的环境的绑定）。
   */
  const bindings = ref<BindingRow[]>([])
  const bindingLoading = ref(false)
  /** 防竞态：快速切换环境时，迟到的旧响应不得覆盖当前环境的行 */
  let seq = 0

  // ── 性能环境（左栏）─────────────────────────────
  const envList = ref<PerfEnvRow[]>([])
  const envLoading = ref(false)
  const activeEnvId = ref('')
  const activeEnvName = computed(() => envList.value.find(env => env.id === activeEnvId.value)?.env_name ?? '')

  async function loadEnvs() {
    envLoading.value = true
    try {
      const rows = await fetchPerfEnvs()
      // 失败保持原列表（拦截器已提示），页面仍可用
      if (!rows)
        return
      envList.value = rows
      // 首次进入默认选中第一个环境：右栏空着会让人以为「没绑定」
      if (!activeEnvId.value && rows.length)
        selectEnv(rows[0])
    }
    finally {
      envLoading.value = false
    }
  }

  function selectEnv(env: PerfEnvRow) {
    if (activeEnvId.value === env.id)
      return
    activeEnvId.value = env.id
    bindings.value = []
    void loadBindings()
  }

  // ── 绑定行 ───────────────────────────────────────
  async function loadBindings() {
    const envId = activeEnvId.value
    if (!envId)
      return
    const current = ++seq
    bindingLoading.value = true
    try {
      const rows = await fetchBindings(envId)
      if (current !== seq)
        return
      bindings.value = rows ?? []
    }
    finally {
      if (current === seq)
        bindingLoading.value = false
    }
  }

  /** 生效绑定：人工绑定（confirmed_at 非空）与历史 VM/服务行 */
  const effectiveBindings = computed(() => bindings.value.filter(isEffectiveBinding))
  /** 候选：集群发现落下的未确认行（已忽略的藏起来，后端仍会返回） */
  const candidateBindings = computed(
    () => bindings.value.filter(row => !isEffectiveBinding(row) && row.ignored_at == null),
  )

  // ── 下拉选项与 id → 名字映射 ─────────────────────
  const clusterOptions = ref<ClusterSelectOption[]>([])
  const promOptions = ref<SelectOption[]>([])
  /** Prometheus 的纯名称映射：表格「资源描述」不要用途后缀 */
  const promNames = ref<Record<string, string>>({})
  const monitorOptions = ref<SelectOption[]>([])
  const vmOptions = ref<SelectOption[]>([])
  const serviceOptions = ref<SelectOption[]>([])

  const nameMaps = computed<BindingNameMaps>(() => ({
    cluster: optionValueMap(clusterOptions.value),
    prometheus: promNames.value,
    monitor: optionValueMap(monitorOptions.value),
    vm: optionValueMap(vmOptions.value),
    service: optionValueMap(serviceOptions.value),
  }))

  /**
   * 选项一次取全。失败项保持原值（少一个下拉不该让整页不可用）；
   * vm/service 即使不写中间件绑定也要取 —— 历史行的资源描述要翻名字。
   */
  async function loadOptions() {
    const [clusters, prom, monitors, vms, services] = await Promise.all([
      fetchClusterOptions(),
      fetchPrometheusOptions(),
      fetchMonitorSourceOptions(),
      fetchVmOptions(),
      fetchServiceOptions(),
    ])
    if (clusters)
      clusterOptions.value = clusters
    if (prom) {
      promOptions.value = prom.options
      promNames.value = prom.names
    }
    if (monitors)
      monitorOptions.value = monitors
    if (vms)
      vmOptions.value = vms
    if (services)
      serviceOptions.value = services
  }

  async function loadAll() {
    await Promise.all([loadEnvs(), loadOptions()])
  }

  // ── 新增绑定弹窗 ─────────────────────────────────
  const bindVisible = ref(false)
  const bindLoading = ref(false)
  const bindForm = ref<BindingForm>(emptyBindingForm())

  function openBind() {
    if (!activeEnvId.value) {
      Message.warning('请先在左侧选择性能环境')
      return
    }
    bindForm.value = emptyBindingForm()
    bindVisible.value = true
  }

  async function submitBind() {
    const reason = validateBindingForm(bindForm.value)
    if (reason) {
      Message.warning(reason)
      return
    }
    bindLoading.value = true
    try {
      const result = await createBinding(buildBindingPayload(bindForm.value, activeEnvId.value))
      // 失败：拦截器已弹原因，保持弹窗打开让用户改
      if (result === null)
        return
      Message.success('已绑定')
      bindVisible.value = false
      void loadBindings()
    }
    finally {
      bindLoading.value = false
    }
  }

  // ── 从集群发现弹窗 ───────────────────────────────
  const discoverVisible = ref(false)
  const discoverLoading = ref(false)
  const discoverForm = ref<DiscoverForm>(emptyDiscoverForm())

  function openDiscover() {
    if (!activeEnvId.value) {
      Message.warning('请先在左侧选择性能环境')
      return
    }
    discoverForm.value = emptyDiscoverForm()
    discoverVisible.value = true
  }

  async function submitDiscover() {
    const reason = validateDiscoverForm(discoverForm.value)
    if (reason) {
      Message.warning(reason)
      return
    }
    discoverLoading.value = true
    try {
      const summary = await discoverBindings(buildDiscoverPayload(discoverForm.value, activeEnvId.value))
      if (!summary)
        return
      // 三个计数都报出来：只报 created 会让「没新增 = 失败」的误解反复出现
      Message.success(
        `发现完成：新增候选 ${summary.created} 条，刷新 ${summary.updated} 条，标记消失 ${summary.missing} 条`,
      )
      discoverVisible.value = false
      void loadBindings()
    }
    finally {
      discoverLoading.value = false
    }
  }

  // ── 解绑 ────────────────────────────────────────
  function removeBinding(row: BindingRow) {
    Modal.warning({
      title: '确认解绑',
      content: `确定解绑「${bindingResourceText(row, nameMaps.value)}」？解绑后该资源不再计入本环境的可观测范围。`,
      hideCancel: false,
      onOk: async () => {
        const result = await unbindBindings([row.id])
        if (result === null)
          return
        Message.success('已解绑')
        void loadBindings()
      },
    })
  }

  // ── 允许操作开关（切换即调 edit）─────────────────
  const allowOpsSavingId = ref('')

  async function toggleAllowOps(row: BindingRow, value: boolean) {
    if (value === row.allow_ops)
      return
    allowOpsSavingId.value = row.id
    try {
      const result = await editBinding({ id: row.id, allow_ops: value })
      // 失败：开关由 record.allow_ops 驱动，值不动，视觉上自动回弹
      if (result === null)
        return
      row.allow_ops = value
      Message.success(value ? '已允许平台操作该资源' : '已禁止平台操作该资源')
    }
    finally {
      allowOpsSavingId.value = ''
    }
  }

  // ── Monitor 应用名行内编辑 ───────────────────────
  /**
   * 输入中的草稿。Arco Input 是受控组件（prop 变化会把 DOM 值重置回去），
   * 直接绑 record 会让输入互相打架，所以输入过程只写草稿，失焦/回车才提交。
   */
  const appNameDraft = reactive<Record<string, string>>({})

  function onAppNameInput(row: BindingRow, value: string) {
    appNameDraft[row.id] = value
  }

  async function commitAppName(row: BindingRow, value: string) {
    const next = value.trim()
    const prev = row.monitor_app_name ?? ''
    if (next === prev) {
      delete appNameDraft[row.id]
      return
    }
    const result = await editBinding({ id: row.id, monitor_app_name: next })
    // 失败保持旧值显示（草稿丢弃），成功才写回行
    if (result === null) {
      delete appNameDraft[row.id]
      return
    }
    row.monitor_app_name = next
    delete appNameDraft[row.id]
    Message.success('已更新 Monitor 应用名')
  }

  // ── 候选区：确认 / 忽略 ──────────────────────────
  const confirming = ref(false)
  const ignoring = ref(false)

  async function confirmCandidates(ids: string[]) {
    confirming.value = true
    try {
      const result = await confirmBindings(ids)
      if (result === null)
        return
      Message.success(`已确认 ${ids.length} 条候选`)
      void loadBindings()
    }
    finally {
      confirming.value = false
    }
  }

  async function ignoreCandidates(ids: string[]) {
    ignoring.value = true
    try {
      const result = await ignoreBindings(ids)
      if (result === null)
        return
      Message.success(`已忽略 ${ids.length} 条候选`)
      void loadBindings()
    }
    finally {
      ignoring.value = false
    }
  }

  return {
    // 环境
    envList,
    envLoading,
    activeEnvId,
    activeEnvName,
    selectEnv,
    // 绑定
    effectiveBindings,
    candidateBindings,
    bindingLoading,
    loadBindings,
    loadAll,
    // 选项
    clusterOptions,
    promOptions,
    monitorOptions,
    vmOptions,
    serviceOptions,
    nameMaps,
    // 新增绑定
    bindVisible,
    bindLoading,
    bindForm,
    openBind,
    submitBind,
    // 从集群发现
    discoverVisible,
    discoverLoading,
    discoverForm,
    openDiscover,
    submitDiscover,
    // 行操作
    removeBinding,
    toggleAllowOps,
    allowOpsSavingId,
    appNameDraft,
    onAppNameInput,
    commitAppName,
    // 候选
    confirming,
    ignoring,
    confirmCandidates,
    ignoreCandidates,
  }
}
