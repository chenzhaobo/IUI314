/**
 * 白名单页的状态与取数（View → Composable → Service → Api）。
 *
 * 页面只留模板：列表/左树/分页/两处弹窗（新建申请、审批）的动作都在这里，
 * 取数一律经 ./service（页面与组合式函数不直接碰 `@/api` 常量）。
 */
import type { WaiverForm, WaiverListFilter, WaiverRow, WaiverRuleTreeNode } from './types'
import type { SelectOption, WaiverRuleStatRow } from '@/types/static-scan'
import { Message, Modal } from '@arco-design/web-vue'
import { computed, ref } from 'vue'
import { usePagedQuery } from '@/hooks'
import { approveWaiver, createWaiver, fetchProjectGroupOptions, fetchWaiverRuleStats, fetchWaivers, revokeWaiver } from './service'
import {
  buildWaiverPayload,
  emptyWaiverForm,
  WAIVER_LIST_DEFAULT_FILTER,
  WAIVER_PAGE_SIZE,
  waiverDomainLabel,
  waiverRuleTitle,
  waiverScopeValueOptions,
} from './types'

export function useWaivers() {
  // ── 列表 ──────────────────────────────────────────
  const dataList = ref<WaiverRow[]>([])
  const loading = ref(false)
  /** 防竞态：连点筛选/翻页时，迟到的旧响应不得覆盖新条件的结果 */
  let seq = 0

  // fetch 必须传函数声明而不是箭头函数：usePagedQuery 在声明处就要引用它重拉列表，
  // 函数提升在这里真实可用（回调只在事件里触发，不会被立即调用）。
  const { query, total, pagination, onPageChange, onPageSizeChange }
    = usePagedQuery<WaiverListFilter>({ ...WAIVER_LIST_DEFAULT_FILTER }, () => loadList(), { pageSize: WAIVER_PAGE_SIZE })

  async function loadList() {
    const current = ++seq
    loading.value = true
    try {
      const page = await fetchWaivers(query.value)
      // 迟到的响应直接丢弃：它属于上一组查询条件
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

  // ── 左树：白名单规则维度统计 ─────────────────
  const waiverRuleStats = ref<WaiverRuleStatRow[]>([])
  const ruleStatsLoading = ref(false)
  const selectedRuleId = ref('all')
  const expandedKeys = ref<string[]>([])

  // 左树数据：全部（根）→ domain 分组 → 扫描点 → 规则版本节点
  const ruleTree = computed<WaiverRuleTreeNode[]>(() => {
    const groups = new Map<string, WaiverRuleStatRow[]>()
    for (const row of waiverRuleStats.value) {
      const domain = row.domain || '未分类'
      if (!groups.has(domain))
        groups.set(domain, [])
      groups.get(domain)!.push(row)
    }
    const domainNodes = Array.from(groups.entries()).map(([domain, rules]) => {
      const spGroups = new Map<string, WaiverRuleStatRow[]>()
      for (const rule of rules) {
        const spId = rule.scan_point_id || 'unknown'
        if (!spGroups.has(spId))
          spGroups.set(spId, [])
        spGroups.get(spId)!.push(rule)
      }
      return {
        key: `domain:${domain}`,
        title: waiverDomainLabel(domain),
        children: Array.from(spGroups.entries()).map(([spId, spRules]) => ({
          key: `sp:${spId}`,
          title: spRules[0].scan_point_name || spId,
          spStats: {
            active: spRules.reduce((sum, rule) => sum + rule.active, 0),
            pending: spRules.reduce((sum, rule) => sum + rule.pending, 0),
            total: spRules.reduce((sum, rule) => sum + rule.total, 0),
          },
          children: spRules.map(rule => ({
            key: rule.rule_version_id,
            title: waiverRuleTitle(rule),
            rule,
          })),
        })),
      }
    })
    return [{ key: 'all', title: '全部', children: domainNodes }]
  })

  async function loadRuleStats() {
    ruleStatsLoading.value = true
    try {
      waiverRuleStats.value = await fetchWaiverRuleStats(query.value.project_group_id) ?? []
      expandedKeys.value = ['all', ...ruleTree.value.flatMap(node => [node.key, ...(node.children ?? []).map(child => child.key)])]
    }
    finally {
      ruleStatsLoading.value = false
    }
  }

  function onTreeSelect(keys: (string | number)[]) {
    const key = keys.length ? String(keys[0]) : 'all'
    selectedRuleId.value = key
    query.value.page_num = 1
    if (key === 'all') {
      query.value.domain = ''
      query.value.rule_version_id = ''
      query.value.scan_point_id = ''
    }
    else if (key.startsWith('domain:')) {
      query.value.domain = key.slice(7)
      query.value.rule_version_id = ''
      query.value.scan_point_id = ''
    }
    else if (key.startsWith('sp:')) {
      query.value.domain = ''
      query.value.rule_version_id = ''
      query.value.scan_point_id = key.slice(3)
    }
    else {
      query.value.domain = ''
      query.value.rule_version_id = key
      query.value.scan_point_id = ''
    }
    void loadList()
  }

  /** 筛选条件变化后查询：回到第 1 页 + 清掉左树范围（那些范围在新视角下没有意义） */
  function onSearch() {
    query.value.page_num = 1
    query.value.rule_version_id = ''
    query.value.scan_point_id = ''
    query.value.domain = ''
    selectedRuleId.value = 'all'
    reloadAll()
  }

  /** 重载列表 + 左树（创建/审批/撤销/查询后调用） */
  function reloadAll() {
    void loadList()
    void loadRuleStats()
  }

  // ── 项目组选项 ────────────────────────────────────
  const pgOptions = ref<SelectOption[]>([])

  async function loadProjectGroupOptions() {
    const options = await fetchProjectGroupOptions()
    // 失败保持原列表：少一个下拉不该让整页不可用
    if (options)
      pgOptions.value = options
  }

  // ── 创建申请 ──────────────────────────────────────
  const formVisible = ref(false)
  const formLoading = ref(false)
  const formData = ref<WaiverForm>(emptyWaiverForm())

  /** 范围值候选项：scope_kind=code_role / entry_kind 是枚举下拉，path_glob 为空数组 → 模板走输入框 */
  const scopeValueOptions = computed<SelectOption[]>(() => waiverScopeValueOptions(formData.value.scope_kind))

  function openCreate() {
    formData.value = emptyWaiverForm()
    formVisible.value = true
  }

  /** 切范围维度必须清空范围值：代码角色/入口类型的枚举值与路径 glob 互不通用 */
  function onScopeKindChange() {
    formData.value.scope_value = ''
  }

  /** 显式选「范围排除」且没填规则版本时，规则版本可留空（全规则生效）；其余情形沿用旧表单，不做校验 */
  async function submitForm() {
    formLoading.value = true
    try {
      const id = await createWaiver(buildWaiverPayload(formData.value))
      // 失败：拦截器已弹原因，保持弹窗打开让用户改（避免重复提示，也不丢已填内容）
      if (id === null)
        return
      Message.success('申请已提交')
      formVisible.value = false
      reloadAll()
    }
    finally {
      formLoading.value = false
    }
  }

  // ── 审批/撤销 ─────────────────────────────────────
  const approveVisible = ref(false)
  const approveLoading = ref(false)
  const currentRow = ref<WaiverRow | null>(null)
  const approveForm = ref({ approved: true, comment: '' })

  function openApprove(row: WaiverRow) {
    currentRow.value = row
    approveForm.value = { approved: true, comment: '' }
    approveVisible.value = true
  }

  async function submitApprove() {
    const row = currentRow.value
    if (!row)
      return
    approveLoading.value = true
    try {
      const result = await approveWaiver({ id: row.id, approved: approveForm.value.approved, comment: approveForm.value.comment })
      if (result === null)
        return
      Message.success(approveForm.value.approved ? '已批准' : '已拒绝')
      approveVisible.value = false
      reloadAll()
    }
    finally {
      approveLoading.value = false
    }
  }

  function revoke(row: WaiverRow) {
    Modal.warning({
      title: '确认撤销',
      content: `确定撤销白名单「${row.rule_code || row.id}」？`,
      hideCancel: false,
      onOk: async () => {
        const result = await revokeWaiver(row.id)
        if (result === null)
          return
        Message.success('已撤销')
        reloadAll()
      },
    })
  }

  return {
    dataList,
    loading,
    query,
    pagination,
    onPageChange,
    onPageSizeChange,
    onSearch,
    loadList,
    ruleStatsLoading,
    ruleTree,
    selectedRuleId,
    expandedKeys,
    loadRuleStats,
    onTreeSelect,
    pgOptions,
    loadProjectGroupOptions,
    formVisible,
    formLoading,
    formData,
    scopeValueOptions,
    openCreate,
    onScopeKindChange,
    submitForm,
    approveVisible,
    approveLoading,
    currentRow,
    approveForm,
    openApprove,
    submitApprove,
    revoke,
  }
}
