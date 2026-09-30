<script setup lang="ts">
/**
 * 提案展开行：按 kind 展示证据（evidence）+ 决策信息。
 * 纯展示组件，不取数；字段缺失一律「—」。
 */
import type { TableColumnData } from '@arco-design/web-vue'
import type { LabeledValue, RuleProposalRow } from './types'
import { computed } from 'vue'
import { formatTime } from '@/hooks'
import { recordText, text } from './types'

const props = defineProps<{ row: RuleProposalRow }>()

const items = computed<LabeledValue[]>(() => {
  const row = props.row
  const common: LabeledValue[] = [{ label: '去重键', value: text(row.dedup_key) }]
  switch (row.kind) {
    case 'retire':
    case 'revise':
      return [
        { label: '规则编号', value: text(row.evidence.rule_key) },
        { label: '规则名称', value: text(row.evidence.rule_name) },
        { label: '涉及仓库', value: row.metrics.repository_ids?.length ? row.metrics.repository_ids.join('，') : '—' },
        { label: 'AI 确认/排除/复核', value: [row.metrics.ai_confirmed, row.metrics.ai_rejected, row.metrics.ai_review_needed].map(text).join(' / ') },
        { label: '判定阈值', value: recordText(row.metrics.thresholds) },
        ...common,
      ]
    case 'new_rule':
    case 'scan_point':
      return [
        { label: '聚簇', value: text(row.evidence.cluster) },
        { label: '规则编号', value: text(row.evidence.rule_key) },
        ...common,
      ]
    case 'counter_example': {
      const e = row.evidence
      const location = typeof e.start_line === 'number' ? `${text(e.file_path)}:${e.start_line}` : text(e.file_path)
      return [
        { label: '缺陷标题', value: text(e.title) },
        { label: '缺陷 ID', value: text(e.issue_id) },
        { label: '问题身份', value: text(e.problem_key) },
        { label: '仓库', value: text(e.repository_id) },
        { label: '位置', value: location },
        { label: '方法', value: text(e.method_name) },
        { label: '标记人', value: text(e.marked_by) },
        { label: '误报原因', value: text(e.reason) },
        ...common,
      ]
    }
    default:
      return common
  }
})

/** 聚簇样本（仅新增规则 / 新增扫描点） */
const samples = computed(() => {
  const row = props.row
  return row.kind === 'new_rule' || row.kind === 'scan_point' ? (row.evidence.samples ?? []) : []
})

/** 反例命中的原文片段 */
const matchedText = computed(() => {
  const row = props.row
  return row.kind === 'counter_example' ? (row.evidence.matched_text ?? '') : ''
})

const SAMPLE_COLUMNS: TableColumnData[] = [
  { title: '文件', dataIndex: 'file_path', ellipsis: true, tooltip: true },
  { title: '方法', dataIndex: 'method_name', width: 180, ellipsis: true, tooltip: true },
  { title: '问题身份', dataIndex: 'problem_key', width: 220, ellipsis: true, tooltip: true },
  { title: '仓库', dataIndex: 'repository_id', width: 140, ellipsis: true, tooltip: true },
  { title: 'run', dataIndex: 'run_id', width: 140, ellipsis: true, tooltip: true },
]
</script>

<template>
  <div class="proposal-evidence">
    <a-descriptions :column="2" size="small" bordered>
      <a-descriptions-item v-for="item in items" :key="item.label" :label="item.label">
        <span class="ev-value">{{ item.value }}</span>
      </a-descriptions-item>
      <a-descriptions-item v-if="row.status !== 'pending'" label="决策">
        {{ text(row.decided_by) }} · {{ formatTime(row.decided_at) }}
      </a-descriptions-item>
      <a-descriptions-item v-if="row.status !== 'pending'" label="决策备注">
        {{ text(row.decision_note) }}
      </a-descriptions-item>
    </a-descriptions>
    <pre v-if="matchedText" class="ev-snippet">{{ matchedText }}</pre>
    <a-table
      v-if="samples.length"
      class="ev-samples"
      :data="samples"
      :columns="SAMPLE_COLUMNS"
      :pagination="false"
      row-key="candidate_id"
      size="mini"
    />
  </div>
</template>

<style scoped>
.proposal-evidence {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ev-value {
  word-break: break-all;
}
.ev-snippet {
  max-height: 240px;
  margin: 0;
  padding: 8px;
  overflow: auto;
  background: var(--color-fill-2);
  font-size: 12px;
  white-space: pre-wrap;
}
</style>
