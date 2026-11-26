/**
 * 领域映射：映射列表 / 新增编辑删除 / 重新归属 / 未匹配领域（一键预填建映射）。
 */
import type { LabelValue } from '../shared/types'
import type { MappingForm, MappingListFilter, MappingRow, UnmappedDomain } from './types'
import { Message, Modal } from '@arco-design/web-vue'
import { ref } from 'vue'
import { usePagedQuery } from '@/hooks'
import { fetchHandlerCandidates, fetchIssueOptions } from '../shared/service'
import { createMapping, deleteMappings, fetchMappings, fetchUnmapped, reapplyMappings, updateMapping } from './service'
import { buildMappingPayload, emptyMappingForm, mappingFormFromUnmapped, mappingFormOf } from './types'

export function useMappings() {
  const dataList = ref<MappingRow[]>([])
  const loading = ref(false)
  const projectGroups = ref<LabelValue[]>([])
  let seq = 0

  const { query, total, pagination, onPageChange, onPageSizeChange, search }
    = usePagedQuery<MappingListFilter>({ keyword: '', match_type: '', project_group_id: '' }, () => void loadList())

  async function loadList() {
    const current = ++seq
    loading.value = true
    try {
      const page = await fetchMappings(query.value)
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

  async function loadGroups() {
    const options = await fetchIssueOptions()
    projectGroups.value = options?.project_groups ?? []
  }

  // ── 未匹配领域 ────────────────────────────────────
  const unmapped = ref<UnmappedDomain[]>([])
  const unmappedLoading = ref(false)

  async function loadUnmapped() {
    unmappedLoading.value = true
    try {
      unmapped.value = await fetchUnmapped()
    }
    finally {
      unmappedLoading.value = false
    }
  }

  // ── 新增 / 编辑 ───────────────────────────────────
  const formVisible = ref(false)
  const formLoading = ref(false)
  const formData = ref<MappingForm>(emptyMappingForm())
  const handlerOptions = ref<LabelValue[]>([])
  const handlerLoading = ref(false)

  /** 处理人候选随项目组变化；换组时清掉不属于新组的默认处理人 */
  async function loadHandlers(groupId: string) {
    handlerOptions.value = []
    if (!groupId)
      return
    handlerLoading.value = true
    try {
      handlerOptions.value = await fetchHandlerCandidates(groupId)
    }
    finally {
      handlerLoading.value = false
    }
  }

  function onGroupChange() {
    formData.value.default_handler_id = ''
    void loadHandlers(formData.value.project_group_id)
  }

  function openForm(form: MappingForm) {
    formData.value = form
    formVisible.value = true
    void loadHandlers(form.project_group_id)
  }

  function openCreate() {
    openForm(emptyMappingForm())
  }

  function openEdit(row: MappingRow) {
    openForm(mappingFormOf(row))
  }

  function openFromUnmapped(row: UnmappedDomain) {
    openForm(mappingFormFromUnmapped(row))
  }

  async function submitForm(): Promise<boolean> {
    if (!formData.value.pattern.trim() || !formData.value.project_group_id) {
      Message.warning('请填写匹配值并选择项目组')
      return false
    }
    formLoading.value = true
    try {
      const payload = buildMappingPayload(formData.value)
      const ok = formData.value.id ? await updateMapping(payload) : (await createMapping(payload)) !== null
      if (!ok)
        return false
      Message.success('已保存；已有问题需点「重新归属」才会按新映射归属')
      void loadList()
      return true
    }
    finally {
      formLoading.value = false
    }
  }

  function removeMapping(row: MappingRow) {
    Modal.warning({
      title: '确认删除',
      content: `确定删除映射「${row.pattern}」→「${row.project_group_name}」？`,
      hideCancel: false,
      onOk: async () => {
        if (await deleteMappings([row.id])) {
          Message.success('已删除')
          void loadList()
        }
      },
    })
  }

  const reapplying = ref(false)

  function reapply() {
    Modal.confirm({
      title: '重新归属',
      content: '按当前映射重算所有「映射归属」的问题（人工归类的不受影响），归属变化会记入变更历史。确认执行？',
      onOk: async () => {
        reapplying.value = true
        try {
          if (await reapplyMappings()) {
            Message.success('重新归属完成')
            void loadUnmapped()
          }
        }
        finally {
          reapplying.value = false
        }
      },
    })
  }

  function init() {
    void loadGroups()
    void loadList()
    void loadUnmapped()
  }

  return {
    query,
    dataList,
    loading,
    pagination,
    onPageChange,
    onPageSizeChange,
    search,
    projectGroups,
    unmapped,
    unmappedLoading,
    loadUnmapped,
    formVisible,
    formLoading,
    formData,
    handlerOptions,
    handlerLoading,
    onGroupChange,
    openCreate,
    openEdit,
    openFromUnmapped,
    submitForm,
    removeMapping,
    reapplying,
    reapply,
    init,
  }
}
