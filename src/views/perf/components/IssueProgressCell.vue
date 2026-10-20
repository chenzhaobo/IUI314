<script setup lang="ts">
/**
 * 台账「缺陷进度」单元格：台账是 AI 结论，缺陷是承诺（谁、何时、怎么验收）。
 * 两者不合并，台账这里只把关联缺陷的进度带出来，点编号跳问题列表。
 */
import { computed } from 'vue'
import { processDisplay } from '@/views/perf/issue/processRules'

export interface IssueProgress {
  issue_no?: string | null
  status?: string | null
  process_status?: string | null
  process_owner?: string | null
  plan_date?: string | null
  overdue?: boolean
  revoked?: boolean
}

const props = defineProps<{ progress?: IssueProgress | null }>()
const emit = defineEmits<{ (e: 'open', issueNo: string): void }>()

const display = computed(() => processDisplay(props.progress?.process_status))
const planDate = computed(() => String(props.progress?.plan_date || '').slice(0, 10))
</script>

<template>
  <div v-if="progress?.issue_no && !progress.revoked" class="issue-progress">
    <a-link :hoverable="false" class="issue-no" @click="emit('open', String(progress.issue_no))">
      {{ progress.issue_no }}
    </a-link>
    <a-tag size="small" :color="display.color">
      {{ display.label }}
    </a-tag>
    <div class="meta">
      <span>{{ progress.process_owner || '无处理人' }}</span>
      <span v-if="planDate" :class="{ overdue: progress.overdue }">
        · {{ planDate }}<template v-if="progress.overdue">（已逾期）</template>
      </span>
      <span v-else class="muted"> · 无计划日期</span>
    </div>
  </div>
  <span v-else class="muted">--</span>
</template>

<style scoped>
.issue-progress { line-height: 1.6; }
.issue-no { margin-right: 4px; padding: 0; }
.meta { font-size: 12px; color: var(--color-text-3); }
.overdue { color: rgb(var(--danger-6)); }
.muted { color: var(--color-text-4); }
</style>
