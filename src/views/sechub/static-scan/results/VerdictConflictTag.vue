<script setup lang="ts">
/**
 * 结果页 AI 状态列的「同类结论冲突」标签（009a）。
 *
 * 同文件同位置、同问题类别的候选结论对立（确认 vs 排除 / 确认 vs 需人工）时后端写入冲突标记；
 * 这里只做标记与跳转，不改任何结论 —— 结论行全部保留展示，由人工对照裁定。
 */
import type { CandidateVerdictConflict } from '@/types/static-scan'

defineProps<{ conflict: CandidateVerdictConflict }>()
const emit = defineEmits<{ locate: [string] }>()
</script>

<template>
  <a-popover trigger="click" position="bottom">
    <a-tag color="magenta" size="small" class="conflict-tag">
      同类结论冲突
    </a-tag>
    <template #content>
      <div class="conflict-pop">
        <div class="conflict-head">
          问题类别 <b>{{ conflict.category_code }}</b>：同位置其他规则给出了相反结论，建议对照后人工裁定。
        </div>
        <div class="conflict-peers">
          <span class="conflict-label">对端候选：</span>
          <a-link v-for="peerId in conflict.peer_candidate_ids" :key="peerId" @click="emit('locate', peerId)">
            {{ peerId.slice(0, 8) }}
          </a-link>
          <span v-if="!conflict.peer_candidate_ids.length" class="conflict-label">（无）</span>
        </div>
      </div>
    </template>
  </a-popover>
</template>

<style scoped>
.conflict-tag { margin-left: 4px; cursor: pointer; }
.conflict-pop { max-width: 360px; font-size: 12px; line-height: 1.7; }
.conflict-head { margin-bottom: 4px; }
.conflict-peers { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.conflict-label { color: var(--color-text-3); }
</style>
