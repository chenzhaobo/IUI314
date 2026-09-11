<script setup lang="ts">
/**
 * 表单概览表格（动态列）
 *
 * 列由「测试类型字典」驱动：
 *   · source=cases      → 该类型列展示 用例数 / 通过数 + 状态（全部用例最近结果通过=通过）
 *   · source=meta_scan  → 来自元数据直扫三态：静态权限检查展示 通过/不通过/不涉及；
 *                         静态日志检查展示 不通过 / 不涉及 / 操作数
 * 行尾固定一列「元数据扫描」= 不通过/不涉及/总数（权限 1 + 6 敏感操作 = 7 检测点）。
 */
import { computed } from 'vue'
import { type TableColumnData } from '@arco-design/web-vue'

interface TypeDef {
  code: string
  name: string
  source: string
  order_sort?: number
}
interface CaseStat {
  case_count: number
  pass_count: number
  last_tested_at: string | null
  status: string
}
interface MetaScan {
  perm_state: string
  fail: number
  na: number
  total: number
  op_fail: number
  op_na: number
}

const props = defineProps<{
  rows: Array<Record<string, unknown>>
  types: TypeDef[]
  loading: boolean
  pagination: Record<string, unknown>
  tableHeight: number
}>()

const emit = defineEmits<{
  (e: 'page-change', page: number): void
  (e: 'page-size-change', size: number): void
  (e: 'scan-detail', record: Record<string, unknown>): void
}>()

const CASE_STATUS: Record<string, { label: string, color: string }> = {
  pass: { label: '通过', color: 'green' },
  fail: { label: '不通过', color: 'red' },
  none: { label: '未执行', color: 'gray' },
}
const PERM_STATE: Record<string, { label: string, color: string }> = {
  pass: { label: '通过', color: 'green' },
  fail: { label: '不通过', color: 'red' },
  na: { label: '不涉及', color: 'gray' },
}

const columns = computed<TableColumnData[]>(() => {
  const base: TableColumnData[] = [
    { title: '表单编码', dataIndex: 'form_number', width: 180, ellipsis: true, tooltip: true, fixed: 'left' },
    { title: '表单名称', dataIndex: 'entity_name', width: 150, ellipsis: true, tooltip: true },
    { title: '应用', dataIndex: 'app_name', width: 130, slotName: 'app' },
    { title: '云', dataIndex: 'cloud_name', width: 100, ellipsis: true, tooltip: true },
  ]
  const typeCols: TableColumnData[] = props.types.map(t => ({
    title: t.name,
    dataIndex: `type_stats.${t.code}`,
    width: 140,
    slotName: `type_${t.code}`,
  }))
  const tail: TableColumnData[] = [
    { title: '元数据扫描（不通过/不涉及/总数）', dataIndex: 'meta_scan.total', width: 210, slotName: 'meta_scan' },
  ]
  return [...base, ...typeCols, ...tail]
})

function caseStat(row: Record<string, unknown>, code: string): CaseStat {
  const stats = row.type_stats as Record<string, CaseStat> | undefined
  return stats?.[code] || { case_count: 0, pass_count: 0, last_tested_at: null, status: 'none' }
}

function metaScan(row: Record<string, unknown>): MetaScan {
  return (row.meta_scan as MetaScan) || { perm_state: '', fail: 0, na: 0, total: 0, op_fail: 0, op_na: 0 }
}

function caseStatus(code: string) {
  return CASE_STATUS[code] || CASE_STATUS.none
}

function lastTestedAt(row: Record<string, unknown>, code: string): string {
  const stat = caseStat(row, code)
  if (!stat.last_tested_at)
    return '--'
  const d = new Date(stat.last_tested_at)
  return Number.isNaN(d.getTime()) ? stat.last_tested_at : d.toLocaleString('zh-CN', { hour12: false })
}
</script>

<template>
  <a-table
    :data="rows"
    :columns="columns"
    :loading="loading"
    :pagination="pagination"
    :scroll="{ y: tableHeight, x: 1600 }"
    row-key="id"
    size="small"
    @page-change="(p: number) => emit('page-change', p)"
    @page-size-change="(s: number) => emit('page-size-change', s)"
  >
    <template #app="{ record }">
      <span v-if="record.app_number">{{ record.app_number }} {{ record.app_name }}</span>
      <span v-else class="text-muted">未分类</span>
    </template>

    <template
      v-for="t in types"
      :key="t.code"
      #[`type_${t.code}`]="{ record }"
    >
      <template v-if="t.source === 'meta_scan'">
        <template v-if="t.code === 'meta_perm_check'">
          <a-tooltip :content="`权限配置检查：${PERM_STATE[metaScan(record).perm_state]?.label || '不涉及'}`">
            <a-tag :color="PERM_STATE[metaScan(record).perm_state]?.color || 'gray'" size="small">
              {{ PERM_STATE[metaScan(record).perm_state]?.label || '不涉及' }}
            </a-tag>
          </a-tooltip>
        </template>
        <template v-else>
          <a-tooltip content="敏感操作的日志开关三态（不通过 / 不涉及 / 操作数）">
            <span>
              <span :class="{ 'text-fail': metaScan(record).op_fail > 0 }">{{ metaScan(record).op_fail }}</span>
              /
              <span class="text-muted">{{ metaScan(record).op_na }}</span>
              /
              {{ metaScan(record).total - 1 - metaScan(record).op_na }}
            </span>
          </a-tooltip>
        </template>
      </template>
      <template v-else>
        <a-tooltip :content="`用例数 ${caseStat(record, t.code).case_count} ／ 通过 ${caseStat(record, t.code).pass_count} ／ 最近执行 ${lastTestedAt(record, t.code)}`">
          <span class="case-cell">
            <a-tag :color="caseStatus(caseStat(record, t.code).status).color" size="small">
              {{ caseStatus(caseStat(record, t.code).status).label }}
            </a-tag>
            <span class="case-count">{{ caseStat(record, t.code).case_count }}/{{ caseStat(record, t.code).pass_count }}</span>
          </span>
        </a-tooltip>
      </template>
    </template>

    <template #meta_scan="{ record }">
      <a-tooltip :content="`权限 ${PERM_STATE[metaScan(record).perm_state]?.label || '不涉及'} ／ 日志不通过 ${metaScan(record).op_fail} ／ 操作不涉及 ${metaScan(record).op_na}（点击看逐项明细）`">
        <a-link class="scan-link" @click="emit('scan-detail', record)">
          <span :class="{ 'text-fail': metaScan(record).fail > 0 }">{{ metaScan(record).fail }}</span>
          /
          <span class="text-muted">{{ metaScan(record).na }}</span>
          /
          {{ metaScan(record).total }}
        </a-link>
      </a-tooltip>
    </template>
  </a-table>
</template>

<style scoped>
.case-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.case-count {
  color: var(--color-text-3);
  font-size: 12px;
}

.text-fail {
  color: rgb(var(--red-6));
  font-weight: 600;
}

.text-muted {
  color: var(--color-text-3);
}
</style>
