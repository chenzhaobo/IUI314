<script setup lang="ts">
/**
 * 结果页展开行的「多模型结论对比」：一行一轮判定（新到旧）。
 *
 * - 带 AI-01 权限分组的轮次可展开分组子表（CandidateVerdictGroups）；无分组的轮次不出展开钮。
 * - 「模型分歧」只比不同模型之间的轮次级结论，分组结论与不完整轮次不参与。
 * - 报告正文由父组件的报告弹窗展示，这里只抛出 view-report。
 */
import type { TableColumnData, TableData, TableExpandable } from '@arco-design/web-vue'
import type { CandidateVerdictRow } from '@/types/static-scan'
import { h } from 'vue'
import { formatTime } from '@/hooks'
import CandidateVerdictGroups from './CandidateVerdictGroups.vue'
import { aiModeText, confidenceText, useCandidateVerdictHistory, verdictKind, verdictKindBadge, verdictTag } from './useCandidateVerdictHistory'

const props = defineProps<{ verdicts?: CandidateVerdictRow[] | null }>()
const emit = defineEmits<{ viewReport: [CandidateVerdictRow] }>()

const { rounds, roundCount, disagrees, roundOf, groupsOf } = useCandidateVerdictHistory(() => props.verdicts)

const columns: TableColumnData[] = [
  { title: '', slotName: 'vAdopted', width: 110 },
  { title: '模型', dataIndex: 'ai_model', width: 170, ellipsis: true, tooltip: true },
  { title: '模式', slotName: 'vMode', width: 90 },
  { title: '结论', slotName: 'vVerdict', width: 100 },
  { title: '风险', dataIndex: 'risk_level', width: 70 },
  { title: '置信度', slotName: 'vConfidence', width: 80 },
  { title: '判定依据', dataIndex: 'rationale', ellipsis: true, tooltip: true },
  { title: '报告', slotName: 'vReport', width: 70 },
  { title: '时间', slotName: 'vCreatedAt', width: 160 },
]

/** expandedRowRender 返回 undefined 时 Arco 不渲染该行的展开钮，所以只有带分组的轮次可展开 */
const expandable: TableExpandable = {
  width: 36,
  expandedRowRender: (record: TableData) => {
    const groups = groupsOf(record.id)
    return groups.length ? h(CandidateVerdictGroups, { groups }) : undefined
  },
}

function onViewReport(id: unknown) {
  const round = roundOf(id)
  if (round)
    emit('viewReport', round)
}

function isPartial(id: unknown): boolean {
  const round = roundOf(id)
  return round ? verdictKind(round) === 'group_partial' : false
}

function kindBadgeOf(id: unknown) {
  const round = roundOf(id)
  return round ? verdictKindBadge(round) : null
}
</script>

<template>
  <a-empty v-if="!roundCount" description="暂无结论记录（该候选还没经过 AI 确认）" />
  <template v-else>
    <div class="verdict-hint">
      共 {{ roundCount }} 轮判定。换模型重扫会**追加**一轮而不是覆盖，下面按时间倒序列出；
      标「采信」的那轮就是列表页展示的结论，带权限分组的轮次点行首「+」查看分组结论。
      <span v-if="disagrees" class="verdict-warn">⚠️ 不同模型结论不一致，建议人工裁定</span>
    </div>
    <a-table
      :data="rounds"
      :columns="columns"
      :expandable="expandable"
      :pagination="false"
      row-key="id"
      size="mini"
    >
      <template #vAdopted="{ record: v }">
        <a-tag v-if="v.adopted" color="arcoblue" size="small">
          采信
        </a-tag>
        <span v-else class="text-muted">历史</span>
        <a-tooltip v-if="kindBadgeOf(v.id)" :content="kindBadgeOf(v.id)?.tip" mini>
          <a-tag :color="kindBadgeOf(v.id)?.color" size="small" class="kind-badge">
            {{ kindBadgeOf(v.id)?.label }}
          </a-tag>
        </a-tooltip>
      </template>
      <template #vMode="{ record: v }">
        {{ aiModeText(v.ai_mode) }}
      </template>
      <template #vVerdict="{ record: v }">
        <a-tag :color="verdictTag(v.verdict).color" size="small">
          {{ verdictTag(v.verdict).label }}
        </a-tag>
      </template>
      <template #vConfidence="{ record: v }">
        {{ confidenceText(v.confidence) }}
      </template>
      <template #vReport="{ record: v }">
        <a-button v-if="v.has_report" type="text" size="mini" @click="onViewReport(v.id)">
          查看
        </a-button>
        <a-tooltip v-else-if="isPartial(v.id)" content="不完整轮次缺少候选聚合结论，因此没有本轮报告" mini>
          <span class="text-muted">无</span>
        </a-tooltip>
        <a-tooltip v-else content="该轮结论没有落盘报告；confirmed / 需人工复核的结论现在会被服务端强制要求报告，缺失即拒绝入库" mini>
          <span class="text-muted">无</span>
        </a-tooltip>
      </template>
      <template #vCreatedAt="{ record: v }">
        {{ formatTime(v.created_at) }}
      </template>
    </a-table>
  </template>
</template>

<style scoped>
.verdict-hint { margin-bottom: 8px; color: var(--color-text-3); font-size: 12px; }
.verdict-warn { margin-left: 8px; color: rgb(var(--warning-6)); font-weight: 600; }
.text-muted { color: var(--color-text-4); }
.kind-badge { margin-left: 4px; }
</style>
