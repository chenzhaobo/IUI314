<script setup lang="ts">
/** 发版检查：最近快照摘要 + 生成报告。 */
import type { ReleaseSnapshotRow } from '@/types/sechub-release'
import { formatTime } from '@/hooks'

import { conclusionMeta } from '../../../composables/releaseDashboardRules'

defineProps<{
  snapshot: ReleaseSnapshotRow | null
  generating: boolean
}>()

const emit = defineEmits<{
  (e: 'generate'): void
}>()

function finalText(isFinal: string): string {
  return isFinal === '1' ? '已定稿' : '未定稿'
}
</script>

<template>
  <div class="snapshot-panel">
    <div
      v-if="snapshot"
      class="snapshot-body"
    >
      <a-descriptions
        :column="{ xs: 1, md: 2, xl: 4 }"
        size="small"
      >
        <a-descriptions-item label="迭代">
          {{ snapshot.iteration_name || snapshot.iteration_id }}
        </a-descriptions-item>
        <a-descriptions-item label="结论">
          <a-tag :color="conclusionMeta(snapshot.conclusion).color" size="small">
            {{ conclusionMeta(snapshot.conclusion).label }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="定稿状态">
          {{ finalText(snapshot.is_final) }}
        </a-descriptions-item>
        <a-descriptions-item label="生成时间">
          {{ formatTime(snapshot.created_at) }}
        </a-descriptions-item>
      </a-descriptions>
    </div>
    <a-empty
      v-else
      description="暂无发版快照"
    />
    <div class="snapshot-actions">
      <span class="hint">
        生成报告会先重算派生检查，并把当前看板指标冻结为快照。
      </span>
      <a-button
        :loading="generating"
        type="outline"
        @click="emit('generate')"
      >
        生成报告
      </a-button>
    </div>
  </div>
</template>

<style scoped>
.snapshot-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.snapshot-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.hint {
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
