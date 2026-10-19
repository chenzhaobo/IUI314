<script setup lang="ts">
/**
 * 流转记录时间线：问题台账详情与问题列表共用。
 *
 * 台账事件（发现 / 处置 / 转缺陷 / 改归属 / 标重复 / 废弃 / 复发）与缺陷流转
 * （建单 / 认领 / 修复 / 发版 / 验证 / 不处理 / 生产状态变更 / 数据复核 / 归因打回）
 * 合成一条，新的在前。每条都写清谁、何时、从什么到什么、为什么。
 *
 * `refreshKey` 变化时重新加载 —— 父页面做完一次流转后递增它即可。
 */
import type { FlowItem } from '@/types/perf-flow'
import { computed, watch } from 'vue'
import { formatTime, useDicts } from '@/hooks'
import { attributionChanges, changeText, flowEventMeta, flowStatusText, issueStatusText, useFlowTimeline } from '@/views/perf/composables/useFlowTimeline'

defineOptions({ name: 'FlowTimeline' })

const props = withDefaults(defineProps<{
  /** 台账 id 或 pattern_no */
  patternId?: string
  /** 缺陷 issue_no 或 id */
  issue?: string
  active?: boolean
  refreshKey?: number
}>(), {
  patternId: '',
  issue: '',
  active: true,
  refreshKey: 0,
})

const { items, loading, load, reset } = useFlowTimeline()

const wontFixDicts = useDicts('perf_issue_wontfix_type')
function wontFixText(v?: string | null): string {
  if (!v)
    return ''
  const raw: unknown = wontFixDicts.value.perf_issue_wontfix_type
  const list = Array.isArray(raw) ? (raw as Array<{ value: string, label: string }>) : []
  return list.find(d => d.value === v)?.label || v
}

const trigger = computed(() => ({ patternId: props.patternId, issue: props.issue, active: props.active, key: props.refreshKey }))
watch(trigger, (next) => {
  if (!next.active) {
    reset()
    return
  }
  load({ patternId: next.patternId, issue: next.issue })
}, { immediate: true, deep: true })

function statusChange(item: FlowItem): string {
  return changeText(flowStatusText(item, item.from_status), flowStatusText(item, item.to_status))
}
function issueStatusChange(item: FlowItem): string {
  return changeText(issueStatusText(item.from_issue_status), issueStatusText(item.to_issue_status))
}
function masterNo(item: FlowItem): string {
  const v = item.meta?.master_pattern_no
  return typeof v === 'string' ? v : ''
}
function issueNo(item: FlowItem): string {
  const v = item.meta?.issue_no
  return typeof v === 'string' ? v : ''
}
</script>

<template>
  <a-spin :loading="loading" style="display: block; min-height: 40px">
    <a-timeline v-if="items.length">
      <a-timeline-item v-for="item in items" :key="`${item.source}-${item.id}`" :label="formatTime(item.created_at)">
        <div class="flow-row">
          <a-tag size="small" :color="item.source === 'pattern' ? 'arcoblue' : 'purple'" bordered>
            {{ item.source === 'pattern' ? '台账' : '缺陷' }}
          </a-tag>
          <a-tag size="small" :color="flowEventMeta(item).color">
            {{ flowEventMeta(item).text }}
          </a-tag>
          <span v-if="statusChange(item)" class="flow-change">{{ statusChange(item) }}</span>
        </div>
        <div v-if="issueStatusChange(item)" class="flow-meta">
          生产侧：{{ issueStatusChange(item) }}
        </div>
        <div v-if="changeText(item.from_owner, item.to_owner)" class="flow-meta">
          责任人：{{ changeText(item.from_owner, item.to_owner) }}
        </div>
        <div v-if="changeText(item.from_project_group, item.to_project_group)" class="flow-meta">
          项目组：{{ changeText(item.from_project_group, item.to_project_group) }}
        </div>
        <div v-for="line in item.event_type === 'attribution_edited' ? attributionChanges(item.meta) : []" :key="line" class="flow-meta">
          {{ line }}
        </div>
        <div v-if="item.wontfix_type" class="flow-meta">
          不处理类型：{{ wontFixText(item.wontfix_type) }}
        </div>
        <div v-if="issueNo(item)" class="flow-meta">
          问题单：{{ issueNo(item) }}
        </div>
        <div v-if="masterNo(item)" class="flow-meta">
          主台账：{{ masterNo(item) }}
        </div>
        <div v-if="item.reason" class="flow-reason">
          {{ item.reason }}
        </div>
        <div class="flow-operator">
          操作人：{{ item.operator || '—' }}
        </div>
      </a-timeline-item>
    </a-timeline>
    <a-empty v-else-if="!loading" description="暂无流转记录" />
  </a-spin>
</template>

<style scoped>
.flow-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.flow-change {
  color: var(--color-text-2);
  font-size: 12px;
}
.flow-meta {
  margin-top: 2px;
  color: var(--color-text-2);
  font-size: 12px;
}
.flow-reason {
  margin-top: 4px;
  font-size: 12px;
  white-space: pre-wrap;
}
.flow-operator {
  margin-top: 2px;
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
