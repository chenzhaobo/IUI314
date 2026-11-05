<script setup lang="ts">
/** 详情抽屉 · 变更历史时间线 */
import type { IssueEventRow } from '../types'
import { formatTime } from '@/hooks'
import { ISSUE_STATUS, tagMeta } from '../../shared/types'
import { EVENT_TYPE } from '../types'

defineProps<{
  events: IssueEventRow[]
}>()

/** 状态变更的 from/to 是状态码，翻成中文；其余原样 */
function valueText(event: IssueEventRow, value: string | null | undefined): string {
  if (!value)
    return '-'
  return event.event_type === 'status' ? tagMeta(ISSUE_STATUS, value).label : value
}
</script>

<template>
  <div class="issue-events">
    <a-empty v-if="!events.length" description="暂无变更" />
    <a-timeline v-else>
      <a-timeline-item v-for="ev in events" :key="ev.id">
        <div class="ev-head">
          <a-tag size="small">
            {{ EVENT_TYPE[ev.event_type] ?? ev.event_type }}
          </a-tag>
          <span v-if="ev.from_value || ev.to_value" class="ev-change">
            {{ valueText(ev, ev.from_value) }} → {{ valueText(ev, ev.to_value) }}
          </span>
        </div>
        <div v-if="ev.detail" class="ev-detail">
          {{ ev.detail }}
        </div>
        <div class="ev-meta">
          {{ ev.operator_name || ev.operator }} · {{ formatTime(ev.created_at) }}
        </div>
      </a-timeline-item>
    </a-timeline>
  </div>
</template>

<style scoped>
.ev-head { display: flex; align-items: center; gap: 8px; }
.ev-change { font-size: 13px; }
.ev-detail { margin-top: 4px; color: var(--color-text-2); font-size: 13px; white-space: pre-wrap; }
.ev-meta { margin-top: 2px; color: var(--color-text-3); font-size: 12px; }
</style>
