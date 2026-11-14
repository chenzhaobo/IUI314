import type { AutomationAuthMode, AutomationSourceForm, AutomationSourceListFilter, AutomationSourceRow } from './types'
import { Message, Modal } from '@arco-design/web-vue'
import { ref } from 'vue'
import { usePagedQuery } from '@/hooks'
import { createAutomationSource, deleteAutomationSources, fetchAutomationSources, testAutomationSource, updateAutomationSource } from './service'
import { automationSourceFormOf, buildAutomationSourcePayload, emptyAutomationSourceForm } from './types'

export function useAutomationSources() {
  const dataList = ref<AutomationSourceRow[]>([])
  const loading = ref(false)
  const formVisible = ref(false)
  const formLoading = ref(false)
  const isEdit = ref(false)
  const formData = ref<AutomationSourceForm>(emptyAutomationSourceForm())
  const testingId = ref('')
  let seq = 0
  let originalAuthMode: AutomationAuthMode = 'app_token'

  const { query, total, pagination, onPageChange, onPageSizeChange, search }
    = usePagedQuery<AutomationSourceListFilter>({ keyword: '', status: '' }, () => void loadList())

  async function loadList() {
    const current = ++seq
    loading.value = true
    try {
      const page = await fetchAutomationSources(query.value)
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

  function resetFilter() {
    query.value.keyword = ''
    query.value.status = ''
    search()
  }

  function openCreate() {
    isEdit.value = false
    originalAuthMode = 'app_token'
    formData.value = emptyAutomationSourceForm()
    formVisible.value = true
  }

  function openEdit(row: AutomationSourceRow) {
    isEdit.value = true
    originalAuthMode = row.auth_mode
    formData.value = automationSourceFormOf(row)
    formVisible.value = true
  }

  async function submitForm(): Promise<boolean> {
    const form = formData.value
    const requiredFields: Array<[string, string]> = [
      [form.code, '编码'],
      [form.name, '名称'],
      [form.base_url, '平台地址'],
      [form.task_id, '任务 taskId'],
      [form.task_name, '任务名称'],
    ]
    if (form.auth_mode === 'app_token')
      requiredFields.push([form.app_id, 'appId'], [form.account_id, 'accountId'])
    for (const [value, label] of requiredFields) {
      if (!value.trim()) {
        Message.warning(`${label}不能为空`)
        return false
      }
    }
    const authModeChanged = isEdit.value && form.auth_mode !== originalAuthMode
    if ((!isEdit.value || authModeChanged) && !form.app_secret) {
      const credential = form.auth_mode === 'token' ? '访问 Token' : '应用密钥'
      Message.warning(authModeChanged ? `切换认证方式必须重新填写${credential}` : `新增自动化源必须填写${credential}`)
      return false
    }
    formLoading.value = true
    try {
      const payload = buildAutomationSourcePayload(form)
      const ok = isEdit.value ? await updateAutomationSource(payload) : (await createAutomationSource(payload)) !== null
      if (!ok)
        return false
      Message.success(isEdit.value ? '已保存' : '已新增，请测试连接后再启用')
      void loadList()
      return true
    }
    finally {
      formLoading.value = false
    }
  }

  async function testSource(row: AutomationSourceRow) {
    testingId.value = row.id
    try {
      const result = await testAutomationSource(row.id)
      if (!result)
        return
      if (result.ok)
        Modal.success({ title: '连接测试通过', content: result.detail || '连接成功' })
      else
        Modal.error({ title: '连接测试失败', content: result.error || '连接失败' })
    }
    finally {
      testingId.value = ''
    }
  }

  function removeSource(row: AutomationSourceRow) {
    Modal.warning({
      title: '确认删除',
      content: `确定删除自动化源「${row.name}」？历史轮次和已采集用例保留。`,
      hideCancel: false,
      onOk: async () => {
        if (await deleteAutomationSources([row.id])) {
          Message.success('已删除')
          void loadList()
        }
      },
    })
  }

  return {
    query,
    dataList,
    loading,
    pagination,
    onPageChange,
    onPageSizeChange,
    search,
    resetFilter,
    loadList,
    formVisible,
    formLoading,
    isEdit,
    formData,
    openCreate,
    openEdit,
    submitForm,
    testingId,
    testSource,
    removeSource,
  }
}
