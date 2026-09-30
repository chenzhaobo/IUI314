/**
 * Monitor 数据源页的状态与取数（View → Composable → Service → Api）。
 *
 * 页面只留模板：列表/分页/弹窗/测试连接的动作都在这里，
 * 取数一律经 ./service（页面与组合式函数不直接碰 `@/api` 常量）。
 */
import type { MonitorSourceForm, MonitorSourceListFilter, MonitorSourceRow } from './types'
import { Message, Modal } from '@arco-design/web-vue'
import { computed, ref } from 'vue'
import { usePagedQuery } from '@/hooks'
import { createMonitorSource, deleteMonitorSources, fetchMonitorSources, testMonitorSource, updateMonitorSource } from './service'
import {
  buildMonitorSourcePayload,
  emptyMonitorSourceForm,
  MONITOR_SOURCE_DEFAULT_FILTER,
  MONITOR_SOURCE_PAGE_SIZE,
  monitorRetentionHint,
  monitorSourceFormOf,
} from './types'

export function useMonitorSource() {
  // ── 列表 ──────────────────────────────────────────
  const dataList = ref<MonitorSourceRow[]>([])
  const loading = ref(false)
  /** 防竞态：连点筛选/翻页时，迟到的旧响应不得覆盖新条件的结果 */
  let seq = 0

  const { query, total, pagination, onPageChange, onPageSizeChange, search }
    = usePagedQuery<MonitorSourceListFilter>({ ...MONITOR_SOURCE_DEFAULT_FILTER }, () => loadList(), { pageSize: MONITOR_SOURCE_PAGE_SIZE })

  async function loadList() {
    const current = ++seq
    loading.value = true
    try {
      const page = await fetchMonitorSources(query.value)
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

  /** 页面保留期提示：N 来自测试连接回写的 max_store_days（见 types 里的口径注释） */
  const retentionHint = computed(() => monitorRetentionHint(dataList.value))

  // ── 新增/编辑弹窗 ─────────────────────────────────
  const formVisible = ref(false)
  const formLoading = ref(false)
  const isEdit = ref(false)
  const formData = ref<MonitorSourceForm>(emptyMonitorSourceForm())

  function openCreate() {
    isEdit.value = false
    formData.value = emptyMonitorSourceForm()
    formVisible.value = true
  }

  function openEdit(row: MonitorSourceRow) {
    isEdit.value = true
    formData.value = monitorSourceFormOf(row)
    formVisible.value = true
  }

  async function submitForm() {
    formLoading.value = true
    try {
      const payload = buildMonitorSourcePayload(formData.value)
      const result = isEdit.value ? await updateMonitorSource(payload) : await createMonitorSource(payload)
      // 失败：拦截器已弹原因（后端 validate 的中文原因），保持弹窗打开让用户改
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
  function removeMonitorSource(row: MonitorSourceRow) {
    Modal.warning({
      title: '确认删除',
      content: `确定删除 Monitor 数据源「${row.name}（${row.code}）」？引用它的绑定与火焰图采集将失效。`,
      hideCancel: false,
      onOk: async () => {
        const result = await deleteMonitorSources([row.id])
        if (result === null)
          return
        Message.success('已删除')
        void loadList()
      },
    })
  }

  // ── 测试连接 ──────────────────────────────────────
  const testingId = ref('')

  async function testConnection(row: MonitorSourceRow) {
    testingId.value = row.id
    try {
      const result = await testMonitorSource(row.id)
      if (result === null)
        return
      if (result.ok)
        Message.success(result.detail ?? '连接正常')
      else
        Message.error(result.error ?? '连接失败')
      // 后端已回写 verified_at / verify_error / 采样与保留上限，重拉列表让各列跟着变
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
    retentionHint,
    formVisible,
    formLoading,
    isEdit,
    formData,
    openCreate,
    openEdit,
    submitForm,
    removeMonitorSource,
    testingId,
    testConnection,
  }
}
