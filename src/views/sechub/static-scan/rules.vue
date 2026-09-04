<script setup lang="ts">
import type { AssuranceMode, PageResult, RuleVersion, ScanPointTreeNode, StaticScanDomain } from '@/types/static-scan'
import { computed, reactive, ref } from 'vue'
import { Message, Modal, type TableColumnData } from '@arco-design/web-vue'
import { ApiSecRuleVersion, ApiSecScanPoint } from '@/api/sechubApis'
import StatusBadge from '@/components/static-scan/StatusBadge.vue'
import { useDownload, useGet, usePost, useToken } from '@/hooks'
import { domainLabels, securityCategoryLabels } from './labels'

defineOptions({ name: 'StaticScanRules' })

// ===== 左树数据 =====
const { data: treeData } = useGet<ScanPointTreeNode[]>(ApiSecScanPoint.tree, {}, { immediate: true })
const scanPointTree = computed(() => treeData.value ?? [])
const expandedTreeKeys = ref<string[]>([])
const selectedTreeKey = ref('')

function onTreeSelect(keys: (string | number)[]) {
  const key = keys.length ? String(keys[0]) : ''
  selectedTreeKey.value = key
  // 根据 key 前缀解析节点层级，设置对应过滤条件
  if (key.startsWith('domain:')) {
    query.value.domain = key.slice(7) as StaticScanDomain
    query.value.category = ''
    query.value.scan_point_id = ''
  }
  else if (key.startsWith('cat:')) {
    const raw = key.slice(4)
    const sep = raw.indexOf(':')
    query.value.domain = (sep > 0 ? raw.slice(0, sep) : raw) as StaticScanDomain
    query.value.category = sep > 0 ? raw.slice(sep + 1) : ''
    query.value.scan_point_id = ''
  }
  else if (key.startsWith('sp:')) {
    query.value.scan_point_id = key.slice(3)
    query.value.domain = ''
    query.value.category = ''
  }
  else {
    // 取消选中：清除树驱动过滤
    query.value.domain = ''
    query.value.category = ''
    query.value.scan_point_id = ''
  }
  refreshList()
}

// 将树节点转换为 a-tree 需要的格式（domain/category 层级翻译为中文）
function treeNodeLabel(n: ScanPointTreeNode): string {
  if (n.level === 'domain')
    return domainLabels[n.label] ?? n.label
  if (n.level === 'category')
    return securityCategoryLabels[n.label] ?? n.label
  return n.label
}
function treeToArcoFormat(nodes: ScanPointTreeNode[]): any[] {
  return nodes.map(n => ({
    key: n.level === 'domain' ? `domain:${n.value}` : n.level === 'category' ? `cat:${n.value}` : `sp:${n.value}`,
    title: `${treeNodeLabel(n)} (${n.rule_count})`,
    level: n.level,
    value: n.value,
    children: n.children.length ? treeToArcoFormat(n.children) : undefined,
  }))
}
const arcoTreeData = computed(() => treeToArcoFormat(scanPointTree.value))

const query = ref<{
  page_num: number
  page_size: number
  domain: '' | StaticScanDomain
  category: string
  publication_status: string
  assurance_mode: '' | AssuranceMode
  scan_point_id: string
}>({
  page_num: 1,
  page_size: 20,
  domain: '',
  category: '',
  publication_status: '',
  assurance_mode: '',
  scan_point_id: '',
})

const { data, isFetching, execute: loadList } = useGet<PageResult<RuleVersion>>(
  ApiSecRuleVersion.getList,
  query,
  { immediate: true },
)
const rows = computed(() => data.value?.list ?? [])
const total = computed(() => data.value?.total ?? 0)
const releasedCount = computed(() => rows.value.filter(item => item.release_status === 'released').length)
const blockedCount = computed(() => rows.value.filter(item => item.release_status !== 'released').length)

function refreshList() {
  query.value.page_num = 1
  void loadList()
}

/** 工具栏领域下拉变更：清除树选中与分类/扫描点过滤 */
function onDomainFilterChange() {
  selectedTreeKey.value = ''
  query.value.category = ''
  query.value.scan_point_id = ''
  refreshList()
}

function changePage(page: number) {
  query.value.page_num = page
  void loadList()
}

const columns: TableColumnData[] = [
  { title: '领域 / 分类', dataIndex: 'domain', slotName: 'domain', width: 150 },
  { title: '扫描点', dataIndex: 'scan_point_name', slotName: 'scanPoint', width: 230 },
  { title: '规则版本', dataIndex: 'name', slotName: 'rule', width: 180 },
  { title: '检测说明', dataIndex: 'detect', slotName: 'detect', width: 280, ellipsis: true, tooltip: true },
  { title: '启用', dataIndex: 'enabled', slotName: 'enabled', width: 80 },
  { title: '发布状态', dataIndex: 'release_status', slotName: 'release', width: 170 },
  { title: '保障模式', dataIndex: 'assurance_mode', slotName: 'assurance', width: 160 },
  { title: '零命中复核', dataIndex: 'agent_required_on_zero_hit', slotName: 'zeroHit', width: 120 },
  { title: '执行器', dataIndex: 'engine', slotName: 'engine', width: 110 },
  { title: '提供方 / 配置', dataIndex: 'provider', slotName: 'agent', width: 170 },
  { title: '上下文完整性', dataIndex: 'context_completeness_predicate', slotName: 'context', width: 200, ellipsis: true, tooltip: true },
  { title: '操作', dataIndex: 'op', slotName: 'op', width: 180, fixed: 'right' },
]

const assuranceLabels: Record<string, string> = {
  deterministic_complete: '确定性完整',
  candidate_review: '候选复核',
  rule_scope_review: '规则范围复核',
  hybrid: '混合',
}
const engineLabels: Record<string, string> = {
  regex_candidate: '正则候选',
  config_candidate: '配置候选',
}

function formatContextPredicate(value: unknown): string {
  if (value === null || value === undefined || value === '')
    return '-'
  if (typeof value === 'string')
    return value
  try {
    return JSON.stringify(value)
  }
  catch {
    return String(value)
  }
}

// ===== 规则详情抽屉 =====
const detailVisible = ref(false)
const detailRecord = ref<RuleVersion | null>(null)
function openDetail(record: RuleVersion) {
  detailRecord.value = record
  detailVisible.value = true
}

function matcherOf(record: RuleVersion | null): Record<string, any> {
  return (record?.matcher_json ?? {}) as Record<string, any>
}

const dangerousArgLabels: Record<string, string> = {
  candidate_match_requires_agent_argument_resolution: '正则仅圈出可疑位置，需 Agent 进一步确认参数是否可被攻击者控制后才能定性。',
}

const assuranceExplain: Record<string, string> = {
  deterministic_complete: '正则即可定论，无需 Agent 复核',
  candidate_review: '正则圈出候选，逐条交 Agent 确认真伪',
  rule_scope_review: 'Agent 按规则范围整体复核',
  hybrid: '候选逐条 + 范围整体双重复核',
}

const sampleStatusLabels: Record<string, string> = {
  not_linked: '未链接样例',
  development: '开发中',
  ready: '就绪',
}

const implementationLabels: Record<string, string> = {
  implemented: '已实现',
  verified: '已验证',
  production_ready: '可投产',
  reconstructed: '重建',
  stub: '占位',
}

// 检测类别（中文）
function categoryLabel(record: RuleVersion | null): string {
  const m = matcherOf(record)
  if (m.category)
    return securityCategoryLabels[m.category] || m.category
  if (record?.domain === 'performance')
    return '性能问题'
  return ''
}

// 检测说明摘要（列表列 + 抽屉共用）
function detectSummary(record: RuleVersion | null): string {
  if (!record)
    return '-'
  const m = matcherOf(record)
  if (m.prescan_hint)
    return String(m.prescan_hint)
  if (m.category) {
    const cat = securityCategoryLabels[m.category] || m.category
    const lang = m.language ? `${m.language} ` : ''
    return `检测 ${lang}代码中潜在的${cat}风险`
  }
  if (Array.isArray(m.signals) && m.signals.length)
    return `检测信号：${m.signals.join('、')}`
  if (m.purpose)
    return String(m.purpose)
  return record.name
}

function exclusionsOf(record: RuleVersion | null): string {
  const m = matcherOf(record)
  return m.exclusions ? String(m.exclusions) : ''
}

function dangerousArgOf(record: RuleVersion | null): string {
  const m = matcherOf(record)
  if (!m.dangerous_argument)
    return ''
  return dangerousArgLabels[m.dangerous_argument] || String(m.dangerous_argument)
}

function knowledgeOf(record: RuleVersion | null): string {
  const m = matcherOf(record)
  return m.knowledge ? String(m.knowledge) : ''
}

function regexPatternsOf(record: RuleVersion | null): string {
  const m = matcherOf(record)
  if (Array.isArray(m.patterns) && m.patterns.length)
    return m.patterns.join('\n')
  return ''
}

function signalsOf(record: RuleVersion | null): string {
  const m = matcherOf(record)
  if (Array.isArray(m.signals) && m.signals.length)
    return m.signals.join('\n')
  return ''
}

function fileTypesOf(record: RuleVersion | null): string {
  const list = record?.required_input_selectors_json ?? record?.required_input_selectors ?? []
  return list.length ? list.join('、') : '-'
}

function providerOf(record: RuleVersion | null): string {
  const p = record?.provider_profile_json
  const provider = record?.provider || p?.provider
  const profile = record?.profile || p?.profile
  return `${provider || '-'} / ${profile || '-'}`
}

function sampleStatusOf(record: RuleVersion | null): string {
  const s = record?.sample_manifest_json?.status
  if (!s) {
    const m = matcherOf(record)
    if (m.sample_status)
      return sampleStatusLabels[m.sample_status] || m.sample_status
    return '未配置'
  }
  return sampleStatusLabels[s] || s
}

function implementationOf(record: RuleVersion | null): string {
  const s = record?.implementation_status
  if (!s)
    return '-'
  return implementationLabels[s] || s
}

function sourceOf(record: RuleVersion | null): string {
  const m = matcherOf(record)
  if (m.source_file)
    return `${m.source_file}${m.source_line ? `:${m.source_line}` : ''}`
  return '-'
}

function assuranceFull(record: RuleVersion | null): string {
  if (!record)
    return '-'
  const label = assuranceLabels[record.assurance_mode] || record.assurance_mode
  const explain = assuranceExplain[record.assurance_mode] || ''
  return explain ? `${label}（${explain}）` : label
}

function matcherJsonText(record: RuleVersion | null): string {
  if (!record?.matcher_json)
    return '{}'
  try {
    return JSON.stringify(record.matcher_json, null, 2)
  }
  catch {
    return String(record.matcher_json)
  }
}

// ===== 编辑抽屉 =====
const editVisible = ref(false)
const editSaving = ref(false)
const editForm = reactive({
  id: '',
  name: '',
  engine: '',
  assurance_mode: '',
  agent_required_on_zero_hit: false,
  publication_status: '',
  implementation_status: '',
  enabled: true,
  patterns: '',
  category: '',
  language: '',
  dangerous_argument: '',
  signals: '',
  prescan_hint: '',
  exclusions: '',
  file_selectors: '',
})

function openEdit(record: RuleVersion) {
  const m = (record.matcher_json ?? {}) as Record<string, any>
  editForm.id = record.id
  editForm.name = record.name
  editForm.engine = record.engine
  editForm.assurance_mode = record.assurance_mode
  editForm.agent_required_on_zero_hit = record.agent_required_on_zero_hit
  editForm.publication_status = record.publication_status || record.release_status || ''
  editForm.implementation_status = record.implementation_status || ''
  editForm.enabled = record.enabled !== false
  editForm.patterns = Array.isArray(m.patterns) ? m.patterns.join('\n') : ''
  editForm.category = m.category || ''
  editForm.language = m.language || ''
  editForm.dangerous_argument = m.dangerous_argument || ''
  editForm.signals = Array.isArray(m.signals) ? m.signals.join(',') : ''
  editForm.prescan_hint = m.prescan_hint || ''
  editForm.exclusions = m.exclusions || ''
  const selectors = record.required_input_selectors_json ?? record.required_input_selectors ?? []
  editForm.file_selectors = Array.isArray(selectors) ? selectors.join(',') : ''
  editVisible.value = true
}

async function submitEdit() {
  editSaving.value = true
  try {
    const payload: Record<string, any> = {
      id: editForm.id,
      name: editForm.name,
      engine: editForm.engine,
      assurance_mode: editForm.assurance_mode,
      agent_required_on_zero_hit: editForm.agent_required_on_zero_hit,
      publication_status: editForm.publication_status,
      implementation_status: editForm.implementation_status,
      enabled: editForm.enabled,
    }
    if (editForm.patterns.trim())
      payload.patterns = editForm.patterns.split('\n').map((s: string) => s.trim()).filter(Boolean)
    if (editForm.category.trim())
      payload.category = editForm.category.trim()
    if (editForm.language.trim())
      payload.language = editForm.language.trim()
    if (editForm.dangerous_argument.trim())
      payload.dangerous_argument = editForm.dangerous_argument.trim()
    if (editForm.signals.trim())
      payload.signals = editForm.signals.split(',').map((s: string) => s.trim()).filter(Boolean)
    if (editForm.prescan_hint.trim())
      payload.prescan_hint = editForm.prescan_hint.trim()
    if (editForm.exclusions.trim())
      payload.exclusions = editForm.exclusions.trim()
    if (editForm.file_selectors.trim())
      payload.file_selectors = editForm.file_selectors.split(',').map((s: string) => s.trim()).filter(Boolean)
    const request = usePost(ApiSecRuleVersion.update, payload, { immediate: false })
    await request.execute()
    if (!request.error.value) {
      Message.success('保存成功')
      editVisible.value = false
      void loadList()
    }
    else {
      Message.error(String(request.error.value) || '保存失败')
    }
  }
  finally {
    editSaving.value = false
  }
}

// ===== 禁用/启用 =====
async function toggleEnabled(record: RuleVersion) {
  const newEnabled = record.enabled === false
  const action = newEnabled ? '启用' : '禁用'
  Modal.confirm({
    title: `确认${action}`,
    content: `确定要${action}规则「${record.name}」吗？`,
    onOk: async () => {
      const request = usePost(ApiSecRuleVersion.setEnabled, { id: record.id, enabled: newEnabled }, { immediate: false })
      await request.execute()
      if (!request.error.value) {
        Message.success(`已${action}`)
        void loadList()
      }
      else {
        Message.error(String(request.error.value) || `${action}失败`)
      }
    },
  })
}

// ===== 导入 =====
const importVisible = ref(false)
const importLoading = ref(false)
const importResult = ref<any>(null)

function openImport() {
  importResult.value = null
  importVisible.value = true
}

async function handleImportUpload(fileList: any[]) {
  const file = fileList?.[0]?.file
  if (!file)
    return
  importLoading.value = true
  importResult.value = null
  try {
    const formData = new FormData()
    formData.append('file', file)
    const { token } = useToken()
    const resp = await fetch(`/api${ApiSecRuleVersion.importRules}`, {
      method: 'POST',
      headers: { Authorization: token },
      body: formData,
    })
    const res = await resp.json()
    if (res.code === 200 || res.code === 0) {
      importResult.value = res.data
      Message.success(`导入完成：新增 ${res.data.inserted} 条`)
      void loadList()
    }
    else {
      Message.error(res.msg || '导入失败')
    }
  }
  catch (e: any) {
    Message.error(`导入异常: ${e.message}`)
  }
  finally {
    importLoading.value = false
  }
}

// ===== 导出 / 下载模板 =====
const { downloadWithTip } = useDownload()

function downloadWithAuth(url: string, filename: string) {
  void downloadWithTip(url, filename, '下载失败')
}

function exportRules() {
  const params = new URLSearchParams()
  if (query.value.domain)
    params.set('domain', query.value.domain)
  if (query.value.publication_status)
    params.set('publication_status', query.value.publication_status)
  if (query.value.assurance_mode)
    params.set('assurance_mode', query.value.assurance_mode)
  const qs = params.toString()
  downloadWithAuth(`${ApiSecRuleVersion.exportRules}${qs ? `?${qs}` : ''}`, 'rules_export.xlsx')
}

function downloadTemplate() {
  downloadWithAuth(ApiSecRuleVersion.template, 'rule_import_template.xlsx')
}
</script>

<template>
  <div class="static-scan-rules">
    <a-collapse class="m-b-12px" :bordered="false" style="background: transparent">
      <a-collapse-item key="readiness" title="规则就绪状态说明（complete_scan）">
        <a-typography-paragraph type="secondary" style="margin: 0">
          当前规则状态不满足完整扫描（complete_scan）上线条件：安全 169 条匹配器为「仅候选」（candidate_only）；性能 25 条为「重建待确认」（reconstructed_pending_confirmation）。
          规则台账当前作为预扫描 pattern 来源使用，complete_scan 权威发布流程暂未启用，不影响预扫描与 AI 确认链路。
        </a-typography-paragraph>
      </a-collapse-item>
    </a-collapse>

    <!-- 左树右表布局 -->
    <a-row :gutter="12">
      <!-- 左树：扫描点树 -->
      <a-col :span="5">
        <a-card title="扫描点分类" :bordered="false" size="small">
          <div class="panel-scroll-y" :style="{ maxHeight: 'calc(100vh - 220px)' }">
            <a-tree
              v-if="arcoTreeData.length"
              :data="arcoTreeData"
              v-model:expanded-keys="expandedTreeKeys"
              :selected-keys="selectedTreeKey ? [selectedTreeKey] : []"
              @select="onTreeSelect"
            />
            <a-empty v-else description="加载中..." />
          </div>
        </a-card>
      </a-col>

      <!-- 右表 -->
      <a-col :span="19">
        <a-row :gutter="12" class="m-b-12px">
          <a-col :span="12">
            <a-card :bordered="false">
              <a-result status="warning" title="安全：仅候选（candidate_only）" subtitle="需补齐危险参数、正反例、canonical 发布与保障契约后才可上线" />
            </a-card>
          </a-col>
          <a-col :span="12">
            <a-card :bordered="false">
              <a-result status="warning" title="性能：重建待确认（reconstructed）" subtitle="业务口径确认及支撑输入完整性契约完成前不可上线" />
            </a-card>
          </a-col>
        </a-row>
    <a-card :bordered="false" class="m-b-8px">
      <a-space wrap>
        <a-select v-model="query.domain" placeholder="领域" allow-clear style="width: 150px" @change="onDomainFilterChange">
          <a-option value="security">
            安全
          </a-option>
          <a-option value="performance">
            性能
          </a-option>
        </a-select>
        <a-select v-model="query.publication_status" placeholder="发布状态" allow-clear style="width: 240px" @change="refreshList">
          <a-option value="formal">
            正式发布（formal）
          </a-option>
          <a-option value="candidate_only">
            仅候选（candidate_only）
          </a-option>
          <a-option value="reconstructed_pending_confirmation">
            重建待确认（reconstructed）
          </a-option>
          <a-option value="knowledge_only">
            仅知识（knowledge_only）
          </a-option>
        </a-select>
        <a-select v-model="query.assurance_mode" placeholder="保障模式" allow-clear style="width: 230px" @change="refreshList">
          <a-option value="deterministic_complete">
            确定性完整（deterministic_complete）
          </a-option>
          <a-option value="candidate_review">
            候选复核（candidate_review）
          </a-option>
          <a-option value="rule_scope_review">
            规则范围复核（rule_scope_review）
          </a-option>
          <a-option value="hybrid">
            混合（hybrid）
          </a-option>
        </a-select>
        <a-button @click="refreshList">
          刷新
        </a-button>
        <a-button type="primary" @click="openImport">
          导入
        </a-button>
        <a-button @click="exportRules">
          导出
        </a-button>
        <a-button @click="downloadTemplate">
          下载模板
        </a-button>
        <a-tag color="green">
          当前页已发布 {{ releasedCount }}
        </a-tag>
        <a-tag color="orangered">
          当前页阻塞 {{ blockedCount }}
        </a-tag>
      </a-space>
    </a-card>
    <a-card :bordered="false">
      <a-table
        :loading="isFetching"
        :data="rows"
        :columns="columns"
        :pagination="{ total, current: query.page_num, pageSize: query.page_size, showTotal: true }"
        row-key="id"
        column-resizable
        :scroll="{ x: 1900 }"
        @page-change="changePage"
      >
        <template #domain="{ record }">
          <a-tag :color="record.domain === 'security' ? 'red' : 'purple'">
            {{ domainLabels[record.domain] || record.domain }}
          </a-tag>
          <div class="category">
            {{ categoryLabel(record) }}
          </div>
        </template>
        <template #scanPoint="{ record }">
          <div>{{ record.scan_point_name }}</div>
          <small>{{ record.scan_point_key }}</small>
        </template>
        <template #rule="{ record }">
          <div>{{ record.name }}</div>
          <small>@ {{ record.version }}</small>
        </template>
        <template #detect="{ record }">
          {{ detectSummary(record) }}
        </template>
        <template #enabled="{ record }">
          <a-tag :color="record.enabled !== false ? 'green' : 'gray'" size="small">
            {{ record.enabled !== false ? '启用' : '禁用' }}
          </a-tag>
        </template>
        <template #release="{ record }">
          <StatusBadge :status="record.release_status" size="small" />
        </template>
        <template #assurance="{ record }">
          {{ assuranceLabels[record.assurance_mode] || record.assurance_mode }}
        </template>
        <template #zeroHit="{ record }">
          <a-tag :color="record.agent_required_on_zero_hit ? 'orangered' : 'blue'">
            {{ record.agent_required_on_zero_hit ? '需复核' : '声明免检' }}
          </a-tag>
        </template>
        <template #engine="{ record }">
          {{ engineLabels[record.engine] || record.engine }}
        </template>
        <template #context="{ record }">
          {{ formatContextPredicate(record.context_completeness_predicate) }}
        </template>
        <template #agent="{ record }">
          {{ providerOf(record) }}
        </template>
        <template #op="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="openEdit(record)">
              编辑
            </a-button>
            <a-button type="text" size="small" :status="record.enabled !== false ? 'warning' : 'success'" @click="toggleEnabled(record)">
              {{ record.enabled !== false ? '禁用' : '启用' }}
            </a-button>
            <a-button type="text" size="small" @click="openDetail(record)">
              详情
            </a-button>
          </a-space>
        </template>
      </a-table>
    </a-card>
      </a-col>
    </a-row>

    <a-drawer v-model:visible="detailVisible" title="规则详情" :width="720" :footer="false" unmount-on-close>
      <template v-if="detailRecord">
        <div class="m-b-16px">
          <a-space wrap>
            <span class="detail-title">{{ detailRecord.name }}</span>
            <StatusBadge :status="detailRecord.release_status" size="small" />
            <a-tag :color="detailRecord.non_authoritative ? 'orangered' : 'green'">
              {{ detailRecord.non_authoritative ? '非权威' : '权威' }}
            </a-tag>
          </a-space>
          <div class="detail-sub">
            {{ detailRecord.rule_key }} @ v{{ detailRecord.version }}
          </div>
        </div>

        <a-divider orientation="left">
          ① 这条规则检测什么
        </a-divider>
        <a-descriptions :column="1" bordered size="small" class="m-b-8px">
          <a-descriptions-item label="检测类别">
            {{ categoryLabel(detailRecord) || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="检测说明">
            {{ detectSummary(detailRecord) }}
          </a-descriptions-item>
          <a-descriptions-item v-if="exclusionsOf(detailRecord)" label="排除条件">
            {{ exclusionsOf(detailRecord) }}
          </a-descriptions-item>
          <a-descriptions-item v-if="dangerousArgOf(detailRecord)" label="危险参数">
            {{ dangerousArgOf(detailRecord) }}
          </a-descriptions-item>
        </a-descriptions>

        <template v-if="knowledgeOf(detailRecord)">
          <a-divider orientation="left">
            检测知识（正反例）
          </a-divider>
          <pre class="knowledge-block">{{ knowledgeOf(detailRecord) }}</pre>
        </template>

        <a-divider orientation="left">
          ② 怎么扫描
        </a-divider>
        <a-descriptions :column="1" bordered size="small" class="m-b-8px">
          <a-descriptions-item v-if="regexPatternsOf(detailRecord)" label="正则表达式">
            <pre class="regex-block">{{ regexPatternsOf(detailRecord) }}</pre>
          </a-descriptions-item>
          <a-descriptions-item v-if="signalsOf(detailRecord)" label="检测信号">
            <pre class="regex-block">{{ signalsOf(detailRecord) }}</pre>
          </a-descriptions-item>
          <a-descriptions-item label="扫描文件">
            {{ fileTypesOf(detailRecord) }}
          </a-descriptions-item>
          <a-descriptions-item label="保障模式">
            {{ assuranceFull(detailRecord) }}
          </a-descriptions-item>
          <a-descriptions-item label="执行器">
            {{ engineLabels[detailRecord.engine] || detailRecord.engine }}
          </a-descriptions-item>
          <a-descriptions-item label="零命中策略">
            {{ detailRecord.agent_required_on_zero_hit ? '正则零命中时仍需 Agent 复核' : '按保障模式默认处理' }}
          </a-descriptions-item>
        </a-descriptions>

        <a-divider orientation="left">
          ③ 可信度与来源
        </a-divider>
        <a-descriptions :column="2" bordered size="small" class="m-b-8px">
          <a-descriptions-item label="发布状态">
            <StatusBadge :status="detailRecord.release_status" size="small" />
          </a-descriptions-item>
          <a-descriptions-item label="是否权威">
            {{ detailRecord.non_authoritative ? '非权威' : '权威' }}
          </a-descriptions-item>
          <a-descriptions-item label="实现状态">
            {{ implementationOf(detailRecord) }}
          </a-descriptions-item>
          <a-descriptions-item label="样本状态">
            {{ sampleStatusOf(detailRecord) }}
          </a-descriptions-item>
          <a-descriptions-item label="提供方 / 配置">
            {{ providerOf(detailRecord) }}
          </a-descriptions-item>
          <a-descriptions-item label="归属扫描点">
            {{ detailRecord.scan_point_name }}
          </a-descriptions-item>
          <a-descriptions-item label="来源" :span="2">
            {{ sourceOf(detailRecord) }}
          </a-descriptions-item>
        </a-descriptions>

        <a-alert v-if="detailRecord.release_status !== 'released'" type="warning" class="m-b-8px">
          该规则当前为「{{ detailRecord.release_status }}」，尚未达到正式发布（released）条件，扫描结果不计入权威结论。
        </a-alert>

        <a-collapse :bordered="false">
          <a-collapse-item header="原始 matcher_json（技术细节）" key="matcher">
            <pre class="json-block">{{ matcherJsonText(detailRecord) }}</pre>
          </a-collapse-item>
        </a-collapse>
      </template>
    </a-drawer>

    <!-- 编辑抽屉 -->
    <a-drawer v-model:visible="editVisible" title="编辑规则" :width="640" unmount-on-close>
      <a-form :model="editForm" layout="vertical">
        <a-form-item label="规则名称" required>
          <a-input v-model="editForm.name" />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="执行器">
              <a-select v-model="editForm.engine">
                <a-option value="regex_candidate">正则候选</a-option>
                <a-option value="config_candidate">配置候选</a-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="保障模式">
              <a-select v-model="editForm.assurance_mode">
                <a-option value="deterministic_complete">确定性完整</a-option>
                <a-option value="candidate_review">候选复核</a-option>
                <a-option value="rule_scope_review">规则范围复核</a-option>
                <a-option value="hybrid">混合</a-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="发布状态">
              <a-select v-model="editForm.publication_status">
                <a-option value="formal">正式发布</a-option>
                <a-option value="candidate_only">仅候选</a-option>
                <a-option value="reconstructed_pending_confirmation">重建待确认</a-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="实现状态">
              <a-input v-model="editForm.implementation_status" placeholder="implemented / verified / production_ready" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="零命中复核">
              <a-switch v-model="editForm.agent_required_on_zero_hit" checked-text="需要" unchecked-text="不需要" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="启用状态">
              <a-switch v-model="editForm.enabled" checked-text="启用" unchecked-text="禁用" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-divider orientation="left">检测配置</a-divider>
        <a-form-item label="正则表达式（安全用，多条换行分隔）">
          <a-textarea v-model="editForm.patterns" :auto-size="{ minRows: 2, maxRows: 6 }" />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="检测类别">
              <a-input v-model="editForm.category" placeholder="sql-injection / rce / ssrf ..." />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="语言">
              <a-input v-model="editForm.language" placeholder="java / xml" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="危险参数">
          <a-input v-model="editForm.dangerous_argument" />
        </a-form-item>
        <a-form-item label="检测信号（性能用，逗号分隔）">
          <a-input v-model="editForm.signals" />
        </a-form-item>
        <a-form-item label="预扫提示（性能用）">
          <a-input v-model="editForm.prescan_hint" />
        </a-form-item>
        <a-form-item label="排除条件（性能用）">
          <a-input v-model="editForm.exclusions" />
        </a-form-item>
        <a-form-item label="扫描文件（globs 逗号分隔）">
          <a-input v-model="editForm.file_selectors" placeholder="**/*.java, **/*.xml" />
        </a-form-item>
      </a-form>
      <template #footer>
        <a-space>
          <a-button @click="editVisible = false">取消</a-button>
          <a-button type="primary" :loading="editSaving" @click="submitEdit">保存</a-button>
        </a-space>
      </template>
    </a-drawer>

    <!-- 导入对话框 -->
    <a-modal v-model:visible="importVisible" title="导入规则" :width="560" :footer="false" unmount-on-close>
      <a-upload
        draggable
        accept=".xlsx,.xls"
        :auto-upload="false"
        :limit="1"
        @change="handleImportUpload"
      />
      <div v-if="importLoading" class="m-t-12px">
        <a-spin tip="导入中..." />
      </div>
      <div v-if="importResult" class="m-t-12px">
        <a-alert :type="importResult.errors?.length ? 'warning' : 'success'">
          <template #title>导入结果</template>
          <div>总计: {{ importResult.total }} 行，新增: {{ importResult.inserted }}，版本化: {{ importResult.versioned }}，禁旧版: {{ importResult.disabled_old }}</div>
          <div v-if="importResult.errors?.length" class="m-t-8px">
            <div v-for="(err, idx) in importResult.errors" :key="idx" class="import-error">
              {{ err }}
            </div>
          </div>
        </a-alert>
      </div>
      <div class="m-t-12px">
        <a-button type="text" size="small" @click="downloadTemplate">下载导入模板</a-button>
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
.static-scan-rules { padding: 0; }
.category { margin-top: 4px; color: var(--color-text-3); }
.detail-title { font-size: 16px; font-weight: 600; }
.detail-sub { margin-top: 4px; font-size: 12px; color: var(--color-text-3); }
.regex-block,
.json-block,
.knowledge-block {
  margin: 0 0 8px;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  background: var(--color-fill-2);
  border-radius: 4px;
}
.import-error {
  font-size: 12px;
  color: var(--color-danger-6);
  line-height: 1.8;
}
</style>
