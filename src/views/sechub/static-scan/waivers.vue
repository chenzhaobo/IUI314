<script lang="ts" setup>
/**
 * 白名单管理 — Waiver 申请/审批/撤销
 */
import type { WaiverRuleStatRow } from '@/types/static-scan'
import { computed, onMounted, ref } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import { useGet, usePost } from '@/hooks'
import { ApiSecWaiver, ApiSecProjectGroup } from '@/api/sechubApis'

defineOptions({ name: 'waivers' })

// ── 查询 ──────────────────────────────────────────
const queryParams = ref<Record<string, any>>({
  page_num: 1,
  page_size: 10,
  status: '',
  project_group_id: '',
  rule_version_id: '',
  scan_point_id: '',
  domain: '',
})

const { isFetching: loading, data: rawData, execute: refresh } = useGet<any>(ApiSecWaiver.getList, queryParams, { immediate: true })

const dataList = computed(() => rawData.value?.list || [])
const total = computed(() => rawData.value?.total || 0)

// ── 左树：白名单规则维度统计 ─────────────────
const waiverRuleStats = ref<WaiverRuleStatRow[]>([])
const ruleStatsLoading = ref(false)
const selectedRuleId = ref('all')
const expandedKeys = ref<string[]>([])

// ── 左树宽度拖拽 ─────────────────────
const leftPanelWidth = ref(230)
const isDragging = ref(false)
const PANEL_MIN = 160
const PANEL_MAX = 480

function onDragStart(e: MouseEvent) {
  isDragging.value = true
  const startX = e.clientX
  const startW = leftPanelWidth.value
  const onMove = (ev: MouseEvent) => {
    leftPanelWidth.value = Math.min(PANEL_MAX, Math.max(PANEL_MIN, startW + ev.clientX - startX))
  }
  const onUp = () => {
    isDragging.value = false
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const { data, execute } = useGet<T>(url, {}, { immediate: false })
  await execute()
  return data.value ?? null
}

async function loadRuleStats() {
  ruleStatsLoading.value = true
  try {
    const params = new URLSearchParams()
    if (queryParams.value.project_group_id)
      params.set('project_group_id', queryParams.value.project_group_id)
    waiverRuleStats.value = await fetchJson<WaiverRuleStatRow[]>(`${ApiSecWaiver.ruleStats}?${params.toString()}`) ?? []
    expandedKeys.value = ['all', ...ruleTree.value.flatMap(n => [n.key, ...(n.children ?? []).map(c => c.key)])]
  }
  finally {
    ruleStatsLoading.value = false
  }
}

// 左树数据：全部（根）→ domain 分组 → 扫描点 → 规则版本节点
const ruleTree = computed(() => {
  const groups = new Map<string, WaiverRuleStatRow[]>()
  for (const r of waiverRuleStats.value) {
    const d = r.domain || '未分类'
    if (!groups.has(d))
      groups.set(d, [])
    groups.get(d)!.push(r)
  }
  const domainNodes = Array.from(groups.entries()).map(([domain, rules]) => {
    const spGroups = new Map<string, WaiverRuleStatRow[]>()
    for (const r of rules) {
      const spId = r.scan_point_id || 'unknown'
      if (!spGroups.has(spId))
        spGroups.set(spId, [])
      spGroups.get(spId)!.push(r)
    }
    return {
      key: `domain:${domain}`,
      title: domainLabel(domain),
      children: Array.from(spGroups.entries()).map(([spId, spRules]) => ({
        key: `sp:${spId}`,
        title: spRules[0].scan_point_name || spId,
        spStats: {
          active: spRules.reduce((s, r) => s + r.active, 0),
          pending: spRules.reduce((s, r) => s + r.pending, 0),
          total: spRules.reduce((s, r) => s + r.total, 0),
        },
        children: spRules.map(r => ({
          key: r.rule_version_id,
          title: r.rule_name,
          rule: r,
        })),
      })),
    }
  })
  return [{
    key: 'all',
    title: '全部',
    children: domainNodes,
  }]
})

function domainLabel(d: string): string {
  const map: Record<string, string> = { security: '安全', performance: '性能' }
  return map[d] ?? d
}

function onTreeSelect(keys: (string | number)[]) {
  const key = keys.length ? String(keys[0]) : 'all'
  selectedRuleId.value = key
  queryParams.value.page_num = 1
  if (key === 'all') {
    queryParams.value.domain = ''
    queryParams.value.rule_version_id = ''
    queryParams.value.scan_point_id = ''
  }
  else if (key.startsWith('domain:')) {
    queryParams.value.domain = key.slice(7)
    queryParams.value.rule_version_id = ''
    queryParams.value.scan_point_id = ''
  }
  else if (key.startsWith('sp:')) {
    queryParams.value.domain = ''
    queryParams.value.rule_version_id = ''
    queryParams.value.scan_point_id = key.slice(3)
  }
  else {
    queryParams.value.domain = ''
    queryParams.value.rule_version_id = key
    queryParams.value.scan_point_id = ''
  }
  refresh()
}

// 重载列表 + 左树（创建/审批/撤销/查询后调用）
function reloadAll() {
  refresh()
  void loadRuleStats()
}

// ── 项目组选项 ────────────────────────────────────
const { data: pgData } = useGet<any>(ApiSecProjectGroup.getAll, {}, { immediate: true })
const pgOptions = computed(() => (Array.isArray(pgData.value) ? pgData.value : []).map((g: any) => ({ label: g.name, value: g.id })))

const statusOptions = [
  { label: '待审批', value: 'pending' },
  { label: '生效', value: 'active' },
  { label: '过期', value: 'expired' },
  { label: '撤销', value: 'revoked' },
]

const statusColorMap: Record<string, string> = {
  pending: 'gold',
  active: 'green',
  expired: 'gray',
  revoked: 'red',
}

// ── 创建申请 ──────────────────────────────────────
const formVisible = ref(false)
const formLoading = ref(false)
const formData = ref<Record<string, any>>({
  rule_version_id: '',
  rule_code: '',
  project_group_id: '',
  module_repository_id: '',
  path_pattern: '',
  reason: '',
  impact: '',
  effective_to: '',
})

function openCreate() {
  formData.value = { rule_version_id: '', rule_code: '', project_group_id: '', module_repository_id: '', path_pattern: '', reason: '', impact: '', effective_to: '' }
  formVisible.value = true
}

const { execute: doCreate } = usePost(ApiSecWaiver.create, formData, { immediate: false })

async function submitForm() {
  formLoading.value = true
  try {
    await doCreate()
    Message.success('申请已提交')
    formVisible.value = false
    reloadAll()
  }
  catch (e: any) {
    Message.error(e?.message || '申请失败')
  }
  finally {
    formLoading.value = false
  }
}

// ── 审批/撤销 ─────────────────────────────────────
const approveVisible = ref(false)
const approveLoading = ref(false)
const currentRow = ref<any>(null)
const approveForm = ref({ approved: true, comment: '' })

function openApprove(row: any) {
  currentRow.value = row
  approveForm.value = { approved: true, comment: '' }
  approveVisible.value = true
}

async function postAction(url: string, payload: Record<string, any>) {
  const request = usePost(url, payload, { immediate: false })
  await request.execute()
  if (request.error.value)
    throw new Error(String(request.error.value))
  return request.data.value
}

async function submitApprove() {
  approveLoading.value = true
  try {
    await postAction(ApiSecWaiver.approve, { id: currentRow.value.id, approved: approveForm.value.approved, comment: approveForm.value.comment })
    Message.success(approveForm.value.approved ? '已批准' : '已拒绝')
    approveVisible.value = false
    reloadAll()
  }
  catch (e: any) {
    Message.error(e?.message || '操作失败')
  }
  finally {
    approveLoading.value = false
  }
}

function handleRevoke(row: any) {
  Modal.warning({
    title: '确认撤销',
    content: `确定撤销白名单「${row.rule_code || row.id}」？`,
    hideCancel: false,
    onOk: async () => {
      await postAction(ApiSecWaiver.revoke, { id: row.id })
      Message.success('已撤销')
      reloadAll()
    },
  })
}

// ── 分页 ──────────────────────────────────────────
function onPageChange(page: number) {
  queryParams.value.page_num = page
  refresh()
}

function onSearch() {
  queryParams.value.page_num = 1
  // 查询条件（项目组/状态）变更：重置树选中并重新加载左树
  selectedRuleId.value = 'all'
  queryParams.value.rule_version_id = ''
  queryParams.value.scan_point_id = ''
  queryParams.value.domain = ''
  reloadAll()
}

onMounted(() => {
  void loadRuleStats()
})
</script>

<template>
  <div class="p-4">
    <a-card title="白名单管理" class="mb-4">
      <template #extra>
        <a-button type="primary" size="small" data-testid="btn-create-waiver" @click="openCreate">
          新建申请
        </a-button>
      </template>

      <!-- 筛选栏 -->
      <div class="flex flex-wrap gap-3">
        <a-select v-model="queryParams.project_group_id" placeholder="项目组" allow-clear style="width: 180px" :options="pgOptions" @change="onSearch" />
        <a-select v-model="queryParams.status" placeholder="状态" allow-clear style="width: 140px" :options="statusOptions" @change="onSearch" />
        <a-button type="primary" size="small" @click="onSearch">
          查询
        </a-button>
      </div>
    </a-card>

    <!-- 左树右表（可拖拽分栏） -->
    <div class="split-layout" :class="{ dragging: isDragging }">
      <!-- 左树：规则分布 -->
      <div class="split-left" :style="{ width: `${leftPanelWidth}px` }">
        <a-card :bordered="false" size="small" class="split-card">
          <template #title>
            规则分布
            <small class="card-sub">生效/待审批/总数</small>
          </template>
          <a-spin :loading="ruleStatsLoading" style="width: 100%">
            <a-tree
              v-if="ruleTree.length"
              :data="ruleTree"
              v-model:expanded-keys="expandedKeys"
              :selected-keys="[selectedRuleId]"
              @select="onTreeSelect"
            >
              <template #title="node">
                <div class="rule-node">
                  <span class="rule-name" :title="node.title">{{ node.title }}</span>
                  <span v-if="node.rule" class="rule-stats">
                    <span class="s-active">{{ node.rule.active }}</span>/<span class="s-pending">{{ node.rule.pending }}</span>/<span class="s-total">{{ node.rule.total }}</span>
                  </span>
                  <span v-else-if="node.spStats" class="rule-stats">
                    <span class="s-active">{{ node.spStats.active }}</span>/<span class="s-pending">{{ node.spStats.pending }}</span>/<span class="s-total">{{ node.spStats.total }}</span>
                  </span>
                </div>
              </template>
            </a-tree>
            <a-empty v-else description="暂无白名单" />
          </a-spin>
        </a-card>
      </div>

      <!-- 拖拽手柄 -->
      <div class="split-handle" @mousedown="onDragStart" />

      <!-- 右表：白名单列表 -->
      <div class="split-right">
        <a-card :bordered="false" class="split-card">
          <!-- 表格 -->
          <a-table :data="dataList" :loading="loading" :pagination="{ total, current: queryParams.page_num, pageSize: queryParams.page_size }" row-key="id" @page-change="onPageChange">
        <template #columns>
          <a-table-column title="规则代码" data-index="rule_code" :width="140" ellipsis />
          <a-table-column title="原因" data-index="reason" :width="200" ellipsis tooltip />
          <a-table-column title="状态" data-index="status" :width="100">
            <template #cell="{ record }">
              <a-tag :color="statusColorMap[record.status] || 'gray'">
                {{ statusOptions.find(s => s.value === record.status)?.label || record.status }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="申请人" data-index="requester_id" :width="120" ellipsis />
          <a-table-column title="审批人" data-index="approver_id" :width="120" ellipsis />
          <a-table-column title="生效时间" data-index="effective_from" :width="160" />
          <a-table-column title="过期时间" data-index="effective_to" :width="160" />
          <a-table-column title="操作" :width="160" fixed="right">
            <template #cell="{ record }">
              <a-space>
                <a-button v-if="record.status === 'pending'" size="mini" type="primary" data-testid="btn-approve-waiver" @click="openApprove(record)">
                  审批
                </a-button>
                <a-button v-if="record.status === 'active'" size="mini" status="danger" data-testid="btn-revoke-waiver" @click="handleRevoke(record)">
                  撤销
                </a-button>
              </a-space>
            </template>
          </a-table-column>
        </template>
          </a-table>
        </a-card>
      </div>
    </div>

    <!-- 创建申请弹窗 -->
    <a-modal v-model:visible="formVisible" title="新建白名单申请" :ok-loading="formLoading" @ok="submitForm">
      <a-form :model="formData" layout="vertical">
        <a-form-item label="规则版本ID" required>
          <a-input v-model="formData.rule_version_id" placeholder="规则版本 ID" data-testid="form-rule-version" />
        </a-form-item>
        <a-form-item label="规则代码">
          <a-input v-model="formData.rule_code" placeholder="如: SEC-001" />
        </a-form-item>
        <a-form-item label="项目组">
          <a-select v-model="formData.project_group_id" :options="pgOptions" placeholder="可选，空=全局" allow-clear />
        </a-form-item>
        <a-form-item label="模块仓库ID">
          <a-input v-model="formData.module_repository_id" placeholder="可选" />
        </a-form-item>
        <a-form-item label="路径模式">
          <a-input v-model="formData.path_pattern" placeholder="如: src/legacy/**" />
        </a-form-item>
        <a-form-item label="原因说明" required>
          <a-textarea v-model="formData.reason" placeholder="申请白名单的原因" data-testid="form-reason" />
        </a-form-item>
        <a-form-item label="影响说明">
          <a-textarea v-model="formData.impact" placeholder="可选" />
        </a-form-item>
        <a-form-item label="过期时间">
          <a-date-picker v-model="formData.effective_to" show-time value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 审批弹窗 -->
    <a-modal v-model:visible="approveVisible" title="白名单审批" :ok-loading="approveLoading" @ok="submitApprove">
      <a-form :model="approveForm" layout="vertical">
        <a-form-item label="审批决定" required>
          <a-radio-group v-model="approveForm.approved" data-testid="approve-radio">
            <a-radio :value="true">
              批准
            </a-radio>
            <a-radio :value="false">
              拒绝
            </a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="审批意见">
          <a-textarea v-model="approveForm.comment" placeholder="可选" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.card-sub { margin-left: 12px; color: var(--color-text-3); font-weight: normal; font-size: 12px; }
.split-layout { display: flex; gap: 0; align-items: stretch; }
.split-layout.dragging { user-select: none; cursor: col-resize; }
.split-left { flex-shrink: 0; overflow: hidden; }
.split-card { height: 100%; overflow-y: auto; }
.split-handle {
  width: 6px; flex-shrink: 0; cursor: col-resize; border-radius: 3px; margin: 0 3px;
  background: transparent; transition: background 0.2s;
}
.split-handle:hover, .split-layout.dragging .split-handle { background: rgb(var(--primary-6)); }
.split-right { flex: 1; min-width: 0; }
.rule-node { display: flex; align-items: center; justify-content: space-between; gap: 4px; width: 100%; }
.rule-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rule-stats { flex-shrink: 0; font-size: 12px; color: var(--color-text-3); }
.s-active { color: rgb(var(--green-6)); font-weight: 500; }
.s-pending { color: rgb(var(--orange-6)); }
.s-total { color: var(--color-text-2); }
</style>
