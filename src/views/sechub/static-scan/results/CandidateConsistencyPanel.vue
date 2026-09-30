<script setup lang="ts">
/**
 * 结果页展开行的「同位置一致性」区块（009a / 009b）：
 * - 同类结论冲突：对端候选跳转；
 * - 同位置其他规则结论：同 run 同文件同行的其他候选及其状态（多规则命中同一处时对照）；
 * - 并入的证据：证据型规则（如 ASTQ-DB-QUERY）并入本候选的命中。
 *
 * 只读展示，不隐藏任何结论行；三项都为空时不渲染。
 */
import type { CandidateDetailRow } from '@/types/static-scan'
import { computed } from 'vue'
import { aiStatusLabels } from '../labels'

const props = defineProps<{ row: CandidateDetailRow }>()
const emit = defineEmits<{ locate: [string] }>()

const conflict = computed(() => props.row.verdict_conflict ?? null)
const sameLocation = computed(() => props.row.same_location_candidates ?? [])
const evidence = computed(() => props.row.evidence_candidates ?? [])
const visible = computed(() => Boolean(conflict.value) || sameLocation.value.length > 0 || evidence.value.length > 0)
</script>

<template>
  <div v-if="visible" class="consistency-panel">
    <div v-if="conflict" class="consistency-block">
      <a-tag color="magenta" size="small">
        同类结论冲突
      </a-tag>
      <span class="consistency-meta">问题类别 {{ conflict.category_code }}，对端候选：</span>
      <a-link v-for="peerId in conflict.peer_candidate_ids" :key="peerId" @click="emit('locate', peerId)">
        {{ peerId.slice(0, 8) }}
      </a-link>
    </div>
    <div v-if="sameLocation.length" class="consistency-block">
      <div class="consistency-title">
        同位置其他规则结论（{{ sameLocation.length }}）
      </div>
      <div v-for="peer in sameLocation" :key="peer.candidate_id" class="consistency-item">
        <a-tag :color="aiStatusLabels[peer.ai_status]?.color ?? 'gray'" size="small">
          {{ aiStatusLabels[peer.ai_status]?.label ?? peer.ai_status }}
        </a-tag>
        <span class="consistency-rule">{{ peer.rule_key }}</span>
        <span class="consistency-meta">{{ peer.rule_name }}</span>
        <a-link @click="emit('locate', peer.candidate_id)">
          定位
        </a-link>
      </div>
    </div>
    <div v-if="evidence.length" class="consistency-block">
      <div class="consistency-title">
        并入的证据（{{ evidence.length }}）
        <span class="consistency-meta">证据型规则命中已并入本候选，不单独判定、不单独提缺陷</span>
      </div>
      <div v-for="item in evidence" :key="item.candidate_id" class="consistency-item">
        <a-tag :color="aiStatusLabels.evidence?.color ?? 'gray'" size="small">
          {{ aiStatusLabels.evidence?.label ?? 'evidence' }}
        </a-tag>
        <span class="consistency-rule">{{ item.rule_key }}</span>
        <span class="consistency-code" :title="item.matched_text ?? ''">{{ item.matched_text || '-' }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.consistency-panel { margin-bottom: 8px; padding: 8px 12px; background: var(--color-fill-1); border-radius: 4px; font-size: 12px; }
.consistency-block { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 6px; }
.consistency-block:last-child { margin-bottom: 0; }
.consistency-title { width: 100%; color: var(--color-text-2); font-weight: 500; }
.consistency-item { display: flex; gap: 6px; align-items: center; width: 100%; min-width: 0; }
.consistency-rule { font-family: var(--font-mono, monospace); }
.consistency-meta { color: var(--color-text-3); }
.consistency-code { overflow: hidden; color: var(--color-text-2); font-family: var(--font-mono, monospace); white-space: nowrap; text-overflow: ellipsis; }
</style>
