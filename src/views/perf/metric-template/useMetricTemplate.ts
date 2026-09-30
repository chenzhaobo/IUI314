/**
 * 指标模板页的状态与取数（View → Composable → Service → Api）。
 *
 * 列表不分页（模板是配置数据，量级十几到几十条），按 service_type 分组展示；
 * 编辑弹窗与新增弹窗共用一个表单模型，靠 `mode` 区分提交口径。
 */
import type { MetricTemplateRow, TemplateAddPayload, TemplateEditPayload, TemplateForm } from './types'
import { Message, Modal } from '@arco-design/web-vue'
import { computed, ref } from 'vue'
import { addTemplate, editTemplate, fetchTemplates } from './service'
import { blankTemplateForm, isBuiltin, withGroupStart } from './types'

export function useMetricTemplate() {
  const loading = ref(false)
  const rows = ref<MetricTemplateRow[]>([])
  const typeFilter = ref('')
  const keyword = ref('')

  async function load() {
    loading.value = true
    try {
      const list = await fetchTemplates()
      if (list)
        rows.value = list
    }
    finally {
      loading.value = false
    }
  }

  /** service_type 过滤 + 显示名 / metric_key 关键字（大小写不敏感） */
  const tableRows = computed(() => {
    const kw = keyword.value.trim().toLowerCase()
    const filtered = rows.value.filter((row) => {
      if (typeFilter.value && row.service_type !== typeFilter.value)
        return false
      if (!kw)
        return true
      return row.display_name.toLowerCase().includes(kw) || row.metric_key.toLowerCase().includes(kw)
    })
    return withGroupStart(filtered)
  })

  // ── 编辑 / 新增弹窗 ───────────────────────────────
  const modalVisible = ref(false)
  const modalMode = ref<'edit' | 'add'>('edit')
  const submitting = ref(false)
  const form = ref<TemplateForm>(blankTemplateForm())

  function openEdit(row: MetricTemplateRow) {
    modalMode.value = 'edit'
    form.value = {
      id: row.id,
      service_type: row.service_type,
      metric_key: row.metric_key,
      display_name: row.display_name,
      promql_tpl: row.promql_tpl,
      unit: row.unit,
      agg: row.agg,
      prom_purpose: row.prom_purpose,
      enabled: row.enabled,
      remark: row.remark ?? '',
      sort: row.sort,
    }
    modalVisible.value = true
  }

  function openAdd() {
    modalMode.value = 'add'
    form.value = blankTemplateForm()
    modalVisible.value = true
  }

  function validate(f: TemplateForm): string | null {
    if (!f.display_name.trim())
      return '请填写显示名'
    if (!f.promql_tpl.trim())
      return '请填写 PromQL 模板'
    if (modalMode.value === 'add' && !f.metric_key.trim())
      return '请填写 metric_key'
    return null
  }

  async function submit() {
    const f = form.value
    const err = validate(f)
    if (err) {
      Message.warning(err)
      return
    }
    submitting.value = true
    try {
      if (modalMode.value === 'edit') {
        const payload: TemplateEditPayload = {
          id: f.id,
          display_name: f.display_name.trim(),
          promql_tpl: f.promql_tpl,
          enabled: f.enabled,
          remark: f.remark,
        }
        const res = await editTemplate(payload)
        if (res === null)
          return
        Message.success(res || '保存成功')
      }
      else {
        const payload: TemplateAddPayload = {
          service_type: f.service_type,
          metric_key: f.metric_key.trim(),
          display_name: f.display_name.trim(),
          promql_tpl: f.promql_tpl,
          unit: f.unit,
          agg: f.agg,
          prom_purpose: f.prom_purpose,
          remark: f.remark || undefined,
          sort: f.sort,
        }
        const res = await addTemplate(payload)
        if (res === null)
          return
        Message.success('已新增自定义模板')
      }
      modalVisible.value = false
      await load()
    }
    finally {
      submitting.value = false
    }
  }

  // ── 行内启用开关 ─────────────────────────────────
  const togglingId = ref('')

  async function toggleEnabled(row: MetricTemplateRow, value: boolean) {
    togglingId.value = row.id
    try {
      const res = await editTemplate({ id: row.id, enabled: value })
      if (res === null)
        return
      row.enabled = value
      Message.success(value ? '已启用' : '已停用')
    }
    finally {
      togglingId.value = ''
    }
  }

  // ── 删除（内置不可删） ───────────────────────────
  function removeTemplate(row: MetricTemplateRow) {
    if (isBuiltin(row)) {
      Message.warning('内置模板只可停用，不可删除')
      return
    }
    Modal.confirm({
      title: '删除自定义模板',
      content: `确认删除「${row.display_name}」（${row.metric_key}）？已回查的历史指标不受影响。`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { status: 'danger' },
      onOk: async () => {
        const res = await editTemplate({ id: row.id, deleted: true })
        if (res === null)
          return
        Message.success(res || '删除成功')
        await load()
      },
    })
  }

  return {
    loading,
    rows,
    typeFilter,
    keyword,
    tableRows,
    load,
    modalVisible,
    modalMode,
    submitting,
    form,
    openEdit,
    openAdd,
    submit,
    togglingId,
    toggleEnabled,
    removeTemplate,
  }
}
