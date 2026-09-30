/**
 * K8s 集群页的状态与取数（View → Composable → Service → Api）。
 *
 * 页面只留模板：列表/分页/弹窗/测试连接的动作都在这里，
 * 取数一律经 ./service（页面与组合式函数不直接碰 `@/api` 常量）。
 */
import type { K8sClusterForm, K8sClusterListFilter, K8sClusterRow } from './types'
import { Message, Modal } from '@arco-design/web-vue'
import { ref } from 'vue'
import { usePagedQuery } from '@/hooks'
import { createK8sCluster, deleteK8sClusters, fetchK8sClusters, testK8sCluster, updateK8sCluster } from './service'
import { buildClusterPayload, clusterFormOf, emptyK8sClusterForm, K8S_CLUSTER_DEFAULT_FILTER, K8S_CLUSTER_PAGE_SIZE } from './types'

export function useK8sCluster() {
  // ── 列表 ──────────────────────────────────────────
  const dataList = ref<K8sClusterRow[]>([])
  const loading = ref(false)
  /** 防竞态：连点筛选/翻页时，迟到的旧响应不得覆盖新条件的结果 */
  let seq = 0

  // fetch 必须传函数声明：usePagedQuery 在声明处就要引用它重拉列表（函数提升）
  const { query, total, pagination, onPageChange, onPageSizeChange, search }
    = usePagedQuery<K8sClusterListFilter>({ ...K8S_CLUSTER_DEFAULT_FILTER }, () => loadList(), { pageSize: K8S_CLUSTER_PAGE_SIZE })

  async function loadList() {
    const current = ++seq
    loading.value = true
    try {
      const page = await fetchK8sClusters(query.value)
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

  // ── 新增/编辑弹窗 ─────────────────────────────────
  const formVisible = ref(false)
  const formLoading = ref(false)
  const isEdit = ref(false)
  const formData = ref<K8sClusterForm>(emptyK8sClusterForm())

  function openCreate() {
    isEdit.value = false
    formData.value = emptyK8sClusterForm()
    formVisible.value = true
  }

  function openEdit(row: K8sClusterRow) {
    isEdit.value = true
    formData.value = clusterFormOf(row)
    formVisible.value = true
  }

  async function submitForm() {
    const form = formData.value
    formLoading.value = true
    try {
      const payload = buildClusterPayload(form)
      const result = isEdit.value ? await updateK8sCluster(payload) : await createK8sCluster(payload)
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
  function removeCluster(row: K8sClusterRow) {
    Modal.warning({
      title: '确认删除',
      content: `确定删除集群「${row.name}（${row.code}）」？已绑定该集群的环境将失去资源寻址。`,
      hideCancel: false,
      onOk: async () => {
        const result = await deleteK8sClusters([row.id])
        if (result === null)
          return
        Message.success('已删除')
        void loadList()
      },
    })
  }

  // ── 测试连接 ──────────────────────────────────────
  const testingId = ref('')

  async function testConnection(row: K8sClusterRow) {
    testingId.value = row.id
    try {
      const result = await testK8sCluster(row.id)
      if (result === null)
        return
      if (result.ok)
        Message.success(result.detail ?? '连接正常')
      else
        Message.error(result.error ?? '连接失败')
      // 后端已回写 verified_at / verify_error，重拉列表让状态列跟着变
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
    formVisible,
    formLoading,
    isEdit,
    formData,
    openCreate,
    openEdit,
    submitForm,
    removeCluster,
    testingId,
    testConnection,
  }
}
