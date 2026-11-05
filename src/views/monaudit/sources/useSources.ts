/**
 * 同步源配置：列表 / 新增编辑 / 删除 / 测试 OpenAPI（View → Composable → Service）。
 */
import type { SourceForm, SourceListFilter, SourceRow } from './types'
import { Message, Modal } from '@arco-design/web-vue'
import { ref } from 'vue'
import { usePagedQuery } from '@/hooks'
import { createSource, deleteSources, fetchSources, testOpenapi, updateSource } from './service'
import { buildSourcePayload, emptySourceForm, extraParamsError, sourceFormOf } from './types'

export function useSources() {
  const dataList = ref<SourceRow[]>([])
  const loading = ref(false)
  let seq = 0

  const { query, total, pagination, onPageChange, onPageSizeChange, search }
    = usePagedQuery<SourceListFilter>({ keyword: '', status: '' }, () => void loadList())

  async function loadList() {
    const current = ++seq
    loading.value = true
    try {
      const page = await fetchSources(query.value)
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

  // ── 新增 / 编辑 ───────────────────────────────────
  const formVisible = ref(false)
  const formLoading = ref(false)
  const isEdit = ref(false)
  const formData = ref<SourceForm>(emptySourceForm())

  function openCreate() {
    isEdit.value = false
    formData.value = emptySourceForm()
    formVisible.value = true
  }

  function openEdit(row: SourceRow) {
    isEdit.value = true
    formData.value = sourceFormOf(row)
    formVisible.value = true
  }

  /** 返回 false 时弹窗保持打开（后端校验原因已由拦截器弹出） */
  async function submitForm(): Promise<boolean> {
    const extraError = extraParamsError(formData.value.query_extra_params)
    if (extraError) {
      Message.warning(extraError)
      return false
    }
    formLoading.value = true
    try {
      const payload = buildSourcePayload(formData.value)
      const ok = isEdit.value ? await updateSource(payload) : (await createSource(payload)) !== null
      if (!ok)
        return false
      Message.success(isEdit.value ? '已保存' : '已新增')
      void loadList()
      return true
    }
    finally {
      formLoading.value = false
    }
  }

  function removeSource(row: SourceRow) {
    Modal.warning({
      title: '确认删除',
      content: `确定删除同步源「${row.name}（${row.code}）」？已同步的问题与日志保留。`,
      hideCancel: false,
      onOk: async () => {
        if (await deleteSources([row.id])) {
          Message.success('已删除')
          void loadList()
        }
      },
    })
  }

  // ── 测试 OpenAPI ──────────────────────────────────
  const testingId = ref('')

  async function testSource(row: SourceRow) {
    testingId.value = row.id
    try {
      const result = await testOpenapi(row.id)
      if (!result)
        return
      if (result.ok)
        Modal.success({ title: '测试通过', content: result.detail || '接口可用' })
      else
        Modal.error({ title: '测试失败', content: result.error || '接口不可用' })
      void loadList()
    }
    finally {
      testingId.value = ''
    }
  }

  return {
    query,
    dataList,
    loading,
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
    removeSource,
    testingId,
    testSource,
  }
}
