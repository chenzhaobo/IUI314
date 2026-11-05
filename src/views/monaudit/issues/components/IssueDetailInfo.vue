<script setup lang="ts">
/** 详情抽屉 · 基本信息（只读） */
import type { IssueDetail } from '../types'
import { formatTime } from '@/hooks'
import { ISSUE_LEVEL, ISSUE_STATUS, REPRO_STATE, tagMeta } from '../../shared/types'

defineProps<{
  detail: IssueDetail
}>()
</script>

<template>
  <div class="detail-info">
    <a-descriptions :column="2" size="small" bordered>
      <a-descriptions-item label="标题" :span="2">
        {{ detail.issue.title }}
      </a-descriptions-item>
      <a-descriptions-item label="审计类型">
        {{ detail.issue.audit_type_label }}（{{ detail.issue.audit_type }}）
      </a-descriptions-item>
      <a-descriptions-item label="优先级">
        <a-tag :color="tagMeta(ISSUE_LEVEL, detail.issue.level).color" size="small">
          {{ tagMeta(ISSUE_LEVEL, detail.issue.level).label }}
        </a-tag>
      </a-descriptions-item>
      <a-descriptions-item label="状态">
        <a-tag :color="tagMeta(ISSUE_STATUS, detail.issue.status).color" size="small">
          {{ tagMeta(ISSUE_STATUS, detail.issue.status).label }}
        </a-tag>
        <span v-if="detail.issue.close_reason" class="muted">（{{ detail.issue.close_reason }}）</span>
      </a-descriptions-item>
      <a-descriptions-item label="复现状态">
        <a-tag :color="tagMeta(REPRO_STATE, detail.issue.repro_state).color" size="small">
          {{ tagMeta(REPRO_STATE, detail.issue.repro_state).label }}
        </a-tag>
      </a-descriptions-item>
      <a-descriptions-item label="领域">
        {{ detail.issue.domain || '-' }}
      </a-descriptions-item>
      <a-descriptions-item label="项目组">
        {{ detail.issue.project_group_name || '未归类' }}
        <span class="muted">（{{ detail.issue.assign_source === 'manual' ? '人工归类' : '映射' }}）</span>
      </a-descriptions-item>
      <a-descriptions-item label="调用类" :span="2">
        <span class="mono">{{ detail.issue.invoke_class || '-' }}</span>
      </a-descriptions-item>
      <a-descriptions-item label="操作锚点" :span="2">
        <span class="mono">{{ detail.issue.op_anchor || '-' }}</span>
      </a-descriptions-item>
      <a-descriptions-item label="实际值 / 阈值">
        {{ detail.issue.max_act_value ?? '-' }} / {{ detail.issue.threshold ?? '-' }}
      </a-descriptions-item>
      <a-descriptions-item label="处理人">
        {{ detail.issue.handler_name || '-' }}
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
      <a-descriptions-item label="指纹">
        <span class="mono">{{ detail.issue.fingerprint }}</span>
      </a-descriptions-item>
    </a-descriptions>
    <div v-if="detail.fp_anchor" class="fp-anchor mono" :title="detail.fp_anchor">
      指纹锚点：{{ detail.fp_anchor }}
    </div>
  </div>
</template>

<style scoped>
.muted { color: var(--color-text-3); font-size: 12px; }
.mono { font-family: var(--font-family-mono, monospace); font-size: 12px; word-break: break-all; }
.fp-anchor { margin-top: 6px; color: var(--color-text-3); }
</style>
