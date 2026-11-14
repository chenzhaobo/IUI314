<script setup lang="ts">
/** 问题详情 · 问题摘要；具体现场字段由 IssueDiagnosisPanel 展示。 */
import type { IssueDetail } from '../types'
import { formatTime } from '@/hooks'
import { ISSUE_LEVEL, ISSUE_STATUS, REPRO_STATE, tagMeta } from '../../shared/types'

defineProps<{
  detail: IssueDetail
}>()
</script>

<template>
  <div class="detail-info">
    <div class="issue-title">
      <span>{{ detail.issue.title }}</span>
      <a-space size="mini" wrap>
        <a-tag :color="tagMeta(ISSUE_LEVEL, detail.issue.level).color" size="small">
          {{ tagMeta(ISSUE_LEVEL, detail.issue.level).label }}
        </a-tag>
        <a-tag :color="tagMeta(ISSUE_STATUS, detail.issue.status).color" size="small">
          {{ tagMeta(ISSUE_STATUS, detail.issue.status).label }}
        </a-tag>
        <a-tag :color="tagMeta(REPRO_STATE, detail.issue.repro_state).color" size="small">
          {{ tagMeta(REPRO_STATE, detail.issue.repro_state).label }}
        </a-tag>
      </a-space>
    </div>

    <a-descriptions :column="3" size="small" bordered>
      <a-descriptions-item label="审计类型">
        {{ detail.issue.audit_type_label }}（{{ detail.issue.audit_type }}）
      </a-descriptions-item>
      <a-descriptions-item label="项目组">
        {{ detail.issue.project_group_name || '未归类' }}
        <span class="muted">（{{ detail.issue.assign_source === 'manual' ? '人工归类' : '映射' }}）</span>
      </a-descriptions-item>
      <a-descriptions-item label="处理人">
        {{ detail.issue.handler_name || '未分派' }}
      </a-descriptions-item>
      <a-descriptions-item label="首次出现">
        {{ formatTime(detail.issue.first_seen_at) }}
      </a-descriptions-item>
      <a-descriptions-item label="最近出现">
        {{ formatTime(detail.issue.last_seen_at) }}
      </a-descriptions-item>
      <a-descriptions-item label="出现 / 未复现轮次">
        {{ detail.issue.hit_rounds }} / {{ detail.issue.miss_rounds }}
      </a-descriptions-item>
    </a-descriptions>

    <a-collapse ghost class="tech-meta">
      <a-collapse-item header="技术归并信息">
        <div class="meta-line">
          归并键：<span class="mono">{{ detail.issue.fingerprint }}</span>
        </div>
        <div v-if="detail.fp_anchor" class="meta-line">
          归并依据：<span class="mono">{{ detail.fp_anchor }}</span>
        </div>
        <div v-if="detail.issue.op_anchor" class="meta-line">
          操作锚点：<span class="mono">{{ detail.issue.op_anchor }}</span>
        </div>
      </a-collapse-item>
    </a-collapse>
  </div>
</template>

<style scoped>
.issue-title { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 10px; font-size: 16px; font-weight: 600; }
.muted { color: var(--color-text-3); font-size: 12px; }
.mono { font-family: var(--font-family-mono, monospace); font-size: 12px; word-break: break-all; }
.tech-meta { margin-top: 6px; color: var(--color-text-3); }
.meta-line { margin: 2px 0; font-size: 12px; }
</style>
