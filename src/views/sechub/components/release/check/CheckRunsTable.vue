<script setup lang="ts">
/** 发版检查：最近 5 次套件运行 + 回归后 AI 复核状态与操作。 */
import type { ReleaseRunReview, ReleaseSuiteRun } from '@/types/sechub-release'
import { formatTime } from '@/hooks'

import { reviewStatusMeta, runStatusMeta } from '../../../composables/releaseDashboardRules'

defineProps<{
  runs: ReleaseSuiteRun[]
  reviews: Record<string, ReleaseRunReview | null>
  reviewStarting: string
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'review', run: ReleaseSuiteRun): void
  (e: 'view'): void
}>()

function reviewMeta(runId: string, reviews: Record<string, ReleaseRunReview | null>) {
  return reviewStatusMeta(reviews[runId]?.status)
}

function reviewError(runId: string, reviews: Record<string, ReleaseRunReview | null>): string {
  return reviews[runId]?.error_message ?? ''
}
</script>

<template>
  <a-table
    :data="runs"
    :loading="loading"
    :pagination="false"
    row-key="id"
    :scroll="{ minWidth: 1320 }"
    size="small"
  >
    <template #columns>
      <a-table-column title="运行" :width="220" ellipsis tooltip>
        <template #cell="{ record }">
          <div>{{ record.run_name || record.id }}</div>
          <div class="sub-text">
            {{ record.task_name || record.task_id }}
          </div>
        </template>
      </a-table-column>
      <a-table-column title="状态" :width="100">
        <template #cell="{ record }">
          <a-tag :color="runStatusMeta(record.status).color" size="small">
            {{ runStatusMeta(record.status).label }}
          </a-tag>
        </template>
      </a-table-column>
      <a-table-column title="开始时间" :width="170">
        <template #cell="{ record }">
          {{ formatTime(record.started_at) }}
        </template>
      </a-table-column>
      <a-table-column title="结束时间" :width="170">
        <template #cell="{ record }">
          {{ formatTime(record.finished_at) }}
        </template>
      </a-table-column>
      <a-table-column title="用例数" data-index="total_cases" :width="80" />
      <a-table-column title="结果" :width="260">
        <template #cell="{ record }">
          <a-space :size="8">
            <span class="verdict pass">PASS {{ record.pass_cnt }}</span>
            <span class="verdict fail">FAIL {{ record.fail_cnt }}</span>
            <span class="verdict review">REVIEW {{ record.review_cnt }}</span>
            <span class="verdict blocked">BLOCKED {{ record.block_cnt }}</span>
            <span class="verdict error">ERROR {{ record.error_cnt }}</span>
          </a-space>
        </template>
      </a-table-column>
      <a-table-column title="复核" :width="120">
        <template #cell="{ record }">
          <a-tooltip
            v-if="reviewError(record.id, reviews)"
            :content="reviewError(record.id, reviews)"
          >
            <a-tag :color="reviewMeta(record.id, reviews).color" size="small">
              {{ reviewMeta(record.id, reviews).label }}
            </a-tag>
          </a-tooltip>
          <a-tag
            v-else
            :color="reviewMeta(record.id, reviews).color"
            size="small"
          >
            {{ reviewMeta(record.id, reviews).label }}
          </a-tag>
        </template>
      </a-table-column>
      <a-table-column title="操作" :width="180">
        <template #cell="{ record }">
          <a-space>
            <a-button
              :disabled="reviews[record.id]?.status === 'running'"
              :loading="reviewStarting === record.id"
              size="small"
              type="outline"
              @click="emit('review', record)"
            >
              AI 复核
            </a-button>
            <a-button
              size="small"
              type="text"
              @click="emit('view')"
            >
              查看结果
            </a-button>
          </a-space>
        </template>
      </a-table-column>
    </template>
  </a-table>
</template>

<style scoped>
.sub-text {
  color: var(--color-text-3);
  font-size: 12px;
}
.verdict {
  font-size: 12px;
  white-space: nowrap;
}
.verdict.pass {
  color: rgb(var(--green-6));
}
.verdict.fail,
.verdict.error {
  color: rgb(var(--red-6));
}
.verdict.review {
  color: rgb(var(--orange-6));
}
.verdict.blocked {
  color: rgb(var(--gray-7));
}
</style>
