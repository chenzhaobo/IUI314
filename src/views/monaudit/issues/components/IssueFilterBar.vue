<script setup lang="ts">
/** 问题清单右侧筛选：所有条件均由后端生效，左树同步沿用（不含左树范围本身）。 */
import type { IssueOptions, LabelValue } from '../../shared/types'
import type { IssueFilter } from '../types'
import { computed } from 'vue'
import { ISSUE_LEVEL, ISSUE_STATUS, REPRO_STATE, tagOptions } from '../../shared/types'

const props = defineProps<{
  options: IssueOptions
}>()

const emit = defineEmits<{
  (e: 'search'): void
  (e: 'reset'): void
}>()

const filter = defineModel<IssueFilter>('filter', { required: true })

const statusOptions = tagOptions(ISSUE_STATUS)
const reproOptions = tagOptions(REPRO_STATE)
const levelOptions = tagOptions(ISSUE_LEVEL)
const overdueOptions: LabelValue[] = [
  { value: '1', label: '仅超期' },
  { value: '0', label: '未超期' },
]
const projectGroupOptions = computed(() => [
  ...props.options.project_groups,
  { value: '__none__', label: '未归类' },
])
const handlerOptions = computed(() => [
  ...props.options.handlers,
  { value: '__none__', label: '未分派' },
])
const planFinishRange = computed<string[]>({
  get: () => filter.value.plan_finish_start && filter.value.plan_finish_end
    ? [filter.value.plan_finish_start, filter.value.plan_finish_end]
    : [],
  set: (values) => {
    filter.value.plan_finish_start = values?.[0] ?? ''
    filter.value.plan_finish_end = values?.[1] ?? ''
  },
})
</script>

<template>
  <div class="issue-filter">
    <a-select
      v-model="filter.round_id"
      :options="options.rounds"
      placeholder="轮次"
      allow-clear
      allow-search
      class="round-select"
      @change="emit('search')"
    />
    <a-select
      v-model="filter.source_id"
      :options="options.sources"
      placeholder="同步源"
      allow-clear
      allow-search
      class="source-select"
      @change="emit('search')"
    />
    <a-select
      v-model="filter.audit_type"
      :options="options.audit_types"
      placeholder="审计类型（数据字典）"
      multiple
      allow-clear
      allow-search
      :max-tag-count="1"
      class="audit-select"
      @change="emit('search')"
    />
    <a-select
      v-model="filter.project_group_id"
      :options="projectGroupOptions"
      placeholder="项目组"
      allow-clear
      allow-search
      class="group-select"
      @change="emit('search')"
    />
    <a-select
      v-model="filter.level"
      :options="levelOptions"
      placeholder="优先级"
      allow-clear
      class="level-select"
      @change="emit('search')"
    />
    <a-select
      v-model="filter.repro_state"
      :options="reproOptions"
      placeholder="复现状态"
      allow-clear
      class="repro-select"
      @change="emit('search')"
    />
    <a-select
      v-model="filter.status"
      :options="statusOptions"
      placeholder="状态"
      multiple
      allow-clear
      :max-tag-count="2"
      class="status-select"
      @change="emit('search')"
    />
    <a-select
      v-model="filter.handler_id"
      :options="handlerOptions"
      placeholder="处理人"
      allow-clear
      allow-search
      class="handler-select"
      @change="emit('search')"
    />
    <a-range-picker
      v-model="planFinishRange"
      value-format="YYYY-MM-DD"
      :placeholder="['预计完成开始', '预计完成结束']"
      allow-clear
      class="date-range"
      @change="emit('search')"
    />
    <a-select
      v-model="filter.overdue"
      :options="overdueOptions"
      placeholder="超期状态"
      allow-clear
      class="overdue-select"
      @change="emit('search')"
    />
    <a-input
      v-model="filter.keyword"
      placeholder="标题 / 调用类 / 领域 / 用户故事 / 缺陷编码 / 指纹"
      allow-clear
      class="keyword-input"
      @press-enter="emit('search')"
      @clear="emit('search')"
    />
    <a-button type="primary" size="small" @click="emit('search')">
      查询
    </a-button>
    <a-button size="small" @click="emit('reset')">
      重置
    </a-button>
  </div>
</template>

<style scoped>
.issue-filter { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px 10px; align-items: center; }
.issue-filter > * { min-width: 0; width: auto; }
.issue-filter .date-range,
.issue-filter .keyword-input { grid-column: span 2; }
@media (max-width: 720px) {
  .issue-filter { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .issue-filter .date-range,
  .issue-filter .keyword-input { grid-column: span 2; }
}
</style>
