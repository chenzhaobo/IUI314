/**
 * Prometheus 数据源页的状态与取数（View → Composable → Service → Api）。
 *
 * 页面只留模板：列表/分页/弹窗/测试连接的动作都在这里，
 * 取数一律经 ./service（页面与组合式函数不直接碰 `@/api` 常量）。
 */
import type { ClusterOptionRow, PrometheusForm, PrometheusListFilter, PrometheusRow } from './types'
import type { SelectOption } from '@/types/static-scan'
import { Message, Modal } from '@arco-design/web-vue'
import { computed, ref } from 'vue'
import { usePagedQuery } from '@/hooks'
import { createPrometheus, deletePrometheuses, fetchClusterOptions, fetchPrometheuses, testPrometheus, updatePrometheus } from './service'
import {
  buildPrometheusPayload,
  emptyPrometheusForm,
  PROMETHEUS_DEFAULT_FILTER,
  PROMETHEUS_PAGE_SIZE,
  prometheusFormOf,
  promNeedsCredential,
  promNeedsUsername,
} from './types'

export function usePrometheusSource() {
  // ── 列表 ──────────────────────────────────────────
  const dataList = ref<PrometheusRow[]>([])
  const loading = ref(false)
  /** 防竞态：连点筛选/翻页时，迟到的旧响应不得覆盖新条件的结果 */
  let seq = 0

  const { query, total, pagination, onPageChange, onPageSizeChange, search }
    = usePagedQuery<PrometheusListFilter>({ ...PROMETHEUS_DEFAULT_FILTER }, () => loadList(), { pageSize: PROMETHEUS_PAGE_SIZE })

  async function loadList() {
    const current = ++seq
    loading.value = true
    try {
      const page = await fetchPrometheuses(query.value)
      if (current !== seq)
        return
      dataList.value = page?.list ?? []
      total.value = page?.total ?? 0
    }
    finally {
      if (current === seq)
        loading.value = false
    }
  }

  // ── 集群下拉（关联集群）───────────────────────────
  const clusterOptions = ref<SelectOption[]>([])
  const clusterNames = computed<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    for (const option of clusterOptions.value)
      map[option.value] = option.label
    return map
  })

  async function loadClusterOptions() {
    const rows: ClusterOptionRow[] | null = await fetchClusterOptions()
    // 失败保持原列表：少一个下拉不该让整页不可用
    if (!rows)
      return
    clusterOptions.value = rows.map(row => ({ label: row.name || row.code || row.id, value: row.id }))
  }

  // ── 新增/编辑弹窗 ─────────────────────────────────
  const formVisible = ref(false)
  const formLoading = ref(false)
  const isEdit = ref(false)
  const formData = ref<PrometheusForm>(emptyPrometheusForm())

  /** 表单里是否显示用户名 / 凭据：none 全隐藏，basic 两者都要，bearer 只要令牌 */
  const showUsername = computed(() => promNeedsUsername(formData.value.auth_type))
  const showCredential = computed(() => promNeedsCredential(formData.value.auth_type))

  function openCreate() {
    isEdit.value = false
    formData.value = emptyPrometheusForm()
    formVisible.value = true
  }

  function openEdit(row: PrometheusRow) {
    isEdit.value = true
    formData.value = prometheusFormOf(row)
    formVisible.value = true
  }

  /** 切换鉴权方式清掉不再需要的输入，避免把用户名/旧令牌误发给另一种认证 */
  function onAuthTypeChange() {
    if (!promNeedsUsername(formData.value.auth_type))
      formData.value.username = ''
    if (!promNeedsCredential(formData.value.auth_type))
      formData.value.credential = ''
  }

  async function submitForm() {
    const form = formData.value
    if (promNeedsUsername(form.auth_type) && !form.username.trim()) {
      Message.warning('Basic 认证需要填写用户名')
      return
    }
    formLoading.value = true
    try {
      const payload = buildPrometheusPayload(form)
      const result = isEdit.value ? await updatePrometheus(payload) : await createPrometheus(payload)
      // 失败：拦截器已弹原因，保持弹窗打开让用户改（也不丢已填内容）
      if (result === null)
        return
      Message.success(isEdit.value ? '已保存' : '已新增')
      formVisible.value = false
      void loadList()
    }
    finally {
      formLoading.value = false
    }
  }

  // ── 删除 ─────────────────────────────────────────
  function removePrometheus(row: PrometheusRow) {
    Modal.warning({
      title: '确认删除',
      content: `确定删除 Prometheus「${row.name}（${row.code}）」？引用它的绑定与指标回查将失效。`,
      hideCancel: false,
      onOk: async () => {
        const result = await deletePrometheuses([row.id])
        if (result === null)
          return
        Message.success('已删除')
        void loadList()
      },
    })
  }

  // ── 测试连接 ──────────────────────────────────────
  const testingId = ref('')

  async function testConnection(row: PrometheusRow) {
    testingId.value = row.id
    try {
      const result = await testPrometheus(row.id)
      if (result === null)
        return
      if (result.ok)
        Message.success(result.detail ?? '连接正常')
      else
        Message.error(result.error ?? '连接失败')
      // 后端已回写 verified_at / verify_error / build_info，重拉列表让状态与版本列跟着变
      void loadList()
    }
    finally {
      testingId.value = ''
    }
  }

  return {
    dataList,
    loading,
    total,
    query,
    pagination,
    onPageChange,
    onPageSizeChange,
    search,
    loadList,
    clusterOptions,
    clusterNames,
    loadClusterOptions,
    formVisible,
    formLoading,
    isEdit,
    formData,
    showUsername,
    showCredential,
    openCreate,
    openEdit,
    onAuthTypeChange,
    submitForm,
    removePrometheus,
    testingId,
    testConnection,
  }
}
