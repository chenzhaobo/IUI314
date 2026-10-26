<script setup lang="ts">
import type { CleanupPolicy, CleanupPreview, CleanupRun } from '@/api/cleanupApis'
import { Message, Modal } from '@arco-design/web-vue'
import { computed, reactive, ref } from 'vue'
import { ApiCleanup, resolveCleanupApi } from '@/api/cleanupApis'
import { formatTime, postAction, putAction, useGet } from '@/hooks'

// 组件名与菜单 path（cleanup）一致，keep-alive 按它匹配；kebab-case 是路由约定。
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'cleanup' })

const DOMAIN_LABEL: Record<string, string> = {
  system: '系统',
  ai: 'AI',
  security: '安全测试',
  static_scan: '静态扫描',
  cloud: '公有云分析',
  perf: '性能测试',
}

const filters = reactive({ domain: '', enabled: '' })
const queryParams = computed(() => ({
  domain: filters.domain || '',
  enabled: filters.enabled || '',
}))
const { data: rawPolicies, isFetching, execute: fetchPolicies } = useGet<CleanupPolicy[]>(ApiCleanup.policies, queryParams, { immediate: true })
const policies = computed(() => rawPolicies.value ?? [])

function formatBytes(bytes: number): string {
  if (!bytes)
    return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

// ── 编辑策略 ──────────────────────────────────────
const editVisible = ref(false)
const editingId = ref('')
const editForm = reactive({
  label: '',
  retention_days: 180,
  keep_latest: 0,
  batch_size: 500,
  max_items_per_run: 5000,
  enabled: true,
  dry_run: true,
  description: '',
})

function openEdit(record: CleanupPolicy) {
  editingId.value = record.id
  editForm.label = record.label
  editForm.retention_days = record.retention_days
  editForm.keep_latest = record.keep_latest
  editForm.batch_size = record.batch_size
  editForm.max_items_per_run = record.max_items_per_run
  editForm.enabled = record.enabled === '1'
  editForm.dry_run = record.dry_run === '1'
  editForm.description = record.description || ''
  editVisible.value = true
}

async function savePolicy() {
  const res = await putAction<CleanupPolicy>(resolveCleanupApi(ApiCleanup.policy, { id: editingId.value }), {
    label: editForm.label,
    retention_days: editForm.retention_days,
    keep_latest: editForm.keep_latest,
    batch_size: editForm.batch_size,
    max_items_per_run: editForm.max_items_per_run,
    enabled: editForm.enabled ? '1' : '0',
    dry_run: editForm.dry_run ? '1' : '0',
    description: editForm.description,
  })
  if (res === null)
    return
  Message.success('策略已更新')
  editVisible.value = false
  await fetchPolicies()
}

async function patchPolicy(record: CleanupPolicy, patch: Record<string, string>) {
  const res = await putAction<CleanupPolicy>(resolveCleanupApi(ApiCleanup.policy, { id: record.id }), patch)
  if (res === null)
    return false
  await fetchPolicies()
  return true
}

async function handleToggleEnabled(record: CleanupPolicy, value: boolean) {
  await patchPolicy(record, { enabled: value ? '1' : '0' })
}

function handleToggleDryRun(record: CleanupPolicy, value: boolean) {
  if (value) {
    patchPolicy(record, { dry_run: '1' })
    return
  }
  Modal.warning({
    title: '关闭 DRY-RUN',
    content: `「${record.label}」之后的执行会真实删除过期数据，且不可恢复。确认关闭？`,
    hideCancel: false,
    onOk: () => patchPolicy(record, { dry_run: '0' }),
  })
}

// ── 预览 / 执行 ───────────────────────────────────
async function preview(record: CleanupPolicy) {
  const res = await postAction<CleanupPreview>(ApiCleanup.preview, { category: record.category })
  if (res === null)
    return
  Modal.info({
    title: `预览：${record.label}`,
    content: `待清理 ${res.scanned} 项，预计释放 ${formatBytes(res.freed_bytes)}（预览不会删除任何数据）`,
  })
  await fetchPolicies()
}

function runOne(record: CleanupPolicy) {
  const dry = record.dry_run === '1'
  Modal.confirm({
    title: '执行清理',
    content: dry
      ? `「${record.label}」当前为 DRY-RUN，只会统计不会删除。确认执行？`
      : `「${record.label}」将真实删除过期数据，且不可恢复。确认执行？`,
    okText: '执行',
    cancelText: '取消',
    onOk: async () => {
      const res = await postAction<string>(ApiCleanup.run, { category: record.category })
      if (res !== null)
        Message.success(res)
      await fetchPolicies()
    },
  })
}

function runAll() {
  Modal.confirm({
    title: '执行全部启用的清理策略',
    content: '各策略按自身 DRY-RUN 设置执行；关闭 DRY-RUN 的类别会真实删除。确认继续？',
    okText: '执行',
    cancelText: '取消',
    onOk: async () => {
      const res = await postAction<string>(ApiCleanup.run, {})
      if (res !== null)
        Message.success(res)
      await fetchPolicies()
    },
  })
}

// ── 运行历史 ──────────────────────────────────────
const historyVisible = ref(false)
const historyPage = reactive({ page_num: 1, page_size: 20 })
const historyQuery = computed(() => ({ ...historyPage }))
const { data: historyRaw, isFetching: historyLoading, execute: fetchHistory } = useGet<any>(ApiCleanup.runs, historyQuery, { immediate: false })
const historyRows = computed<CleanupRun[]>(() => historyRaw.value?.list ?? [])
const historyTotal = computed(() => historyRaw.value?.total || 0)

async function openHistory() {
  historyVisible.value = true
  await fetchHistory()
}

function statusColor(status: string) {
  return status === 'success' ? 'green' : status === 'failed' ? 'red' : 'gray'
}

function handleHistoryPage(page: number) {
  historyPage.page_num = page
  fetchHistory()
}
</script>

<template>
  <div class="cleanup-page">
    <a-card :bordered="false">
      <div class="toolbar">
        <a-select v-model="filters.domain" placeholder="全部领域" allow-clear style="width: 150px" @change="() => fetchPolicies()">
          <a-option v-for="(label, key) in DOMAIN_LABEL" :key="key" :value="key">
            {{ label }}
          </a-option>
        </a-select>
        <a-select v-model="filters.enabled" placeholder="启用状态" allow-clear style="width: 130px" @change="() => fetchPolicies()">
          <a-option value="1">
            已启用
          </a-option>
          <a-option value="0">
            已停用
          </a-option>
        </a-select>
        <a-button @click="() => fetchPolicies()">
          刷新
        </a-button>
        <div class="spacer" />
        <a-button @click="openHistory">
          运行历史
        </a-button>
        <a-button type="primary" @click="runAll">
          执行全部
        </a-button>
      </div>

      <a-table :data="policies" :loading="isFetching" row-key="id" :pagination="false" :scroll="{ x: 1350 }">
        <template #columns>
          <a-table-column title="领域" data-index="domain" :width="100">
            <template #cell="{ record }">
              {{ DOMAIN_LABEL[record.domain] || record.domain }}
            </template>
          </a-table-column>
          <a-table-column title="类别" data-index="category" :width="210" ellipsis tooltip />
          <a-table-column title="说明" data-index="label" :width="200" ellipsis tooltip />
          <a-table-column title="保留天数" data-index="retention_days" :width="90" />
          <a-table-column title="保留最新" data-index="keep_latest" :width="90">
            <template #cell="{ record }">
              {{ record.keep_latest || '不限' }}
            </template>
          </a-table-column>
          <a-table-column title="批量 / 单次" :width="120">
            <template #cell="{ record }">
              {{ record.batch_size }} / {{ record.max_items_per_run }}
            </template>
          </a-table-column>
          <a-table-column title="启用" data-index="enabled" :width="80">
            <template #cell="{ record }">
              <a-switch :model-value="record.enabled === '1'" @change="value => handleToggleEnabled(record, Boolean(value))" />
            </template>
          </a-table-column>
          <a-table-column title="DRY-RUN" data-index="dry_run" :width="100">
            <template #cell="{ record }">
              <a-tag :color="record.dry_run === '1' ? 'orange' : 'red'">
                {{ record.dry_run === '1' ? '仅统计' : '会删除' }}
              </a-tag>
              <a-switch :model-value="record.dry_run === '1'" size="small" @change="value => handleToggleDryRun(record, Boolean(value))" />
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="190" fixed="right">
            <template #cell="{ record }">
              <a-space>
                <a-link @click="preview(record)">
                  预览
                </a-link>
                <a-link @click="openEdit(record)">
                  编辑
                </a-link>
                <a-link status="danger" @click="runOne(record)">
                  执行
                </a-link>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:visible="editVisible" title="编辑清理策略" :width="560" @ok="savePolicy">
      <a-form :model="editForm" layout="vertical">
        <a-form-item label="名称">
          <a-input v-model="editForm.label" :max-length="128" />
        </a-form-item>
        <a-form-item label="保留天数">
          <a-input-number v-model="editForm.retention_days" :min="1" :max="3650" />
        </a-form-item>
        <a-form-item label="保留最新 N 次（0=不限制）">
          <a-input-number v-model="editForm.keep_latest" :min="0" :max="10000" />
        </a-form-item>
        <a-form-item label="批量大小">
          <a-input-number v-model="editForm.batch_size" :min="1" :max="5000" />
        </a-form-item>
        <a-form-item label="单次最多处理">
          <a-input-number v-model="editForm.max_items_per_run" :min="1" :max="100000" />
        </a-form-item>
        <a-space size="large">
          <a-form-item label="启用">
            <a-switch v-model="editForm.enabled" />
          </a-form-item>
          <a-form-item label="DRY-RUN（只统计）">
            <a-switch v-model="editForm.dry_run" />
          </a-form-item>
        </a-space>
        <a-form-item label="说明">
          <a-textarea v-model="editForm.description" :auto-size="{ minRows: 2, maxRows: 4 }" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-drawer v-model:visible="historyVisible" title="清理运行历史" :width="760">
      <a-table
        :data="historyRows"
        :loading="historyLoading"
        row-key="id"
        :pagination="{ current: historyPage.page_num, pageSize: historyPage.page_size, total: historyTotal, showTotal: true }"
        @page-change="handleHistoryPage"
      >
        <template #columns>
          <a-table-column title="时间" data-index="created_at" :width="160">
            <template #cell="{ record }">
              {{ formatTime(record.created_at) }}
            </template>
          </a-table-column>
          <a-table-column title="类别" data-index="category" :width="200" ellipsis tooltip />
          <a-table-column title="模式" data-index="trigger_mode" :width="90" />
          <a-table-column title="DRY-RUN" data-index="dry_run" :width="90">
            <template #cell="{ record }">
              {{ record.dry_run === '1' ? '是' : '否' }}
            </template>
          </a-table-column>
          <a-table-column title="状态" data-index="status" :width="90">
            <template #cell="{ record }">
              <a-tag :color="statusColor(record.status)">
                {{ record.status }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="扫描 / 删除 / 跳过" :width="150">
            <template #cell="{ record }">
              {{ record.scanned_count }} / {{ record.deleted_count }} / {{ record.skipped_count }}
            </template>
          </a-table-column>
          <a-table-column title="释放" data-index="freed_bytes" :width="90">
            <template #cell="{ record }">
              {{ formatBytes(record.freed_bytes) }}
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-drawer>
  </div>
</template>

<style scoped>
.cleanup-page {
  padding: 16px;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}
.spacer {
  flex: 1;
}
</style>
