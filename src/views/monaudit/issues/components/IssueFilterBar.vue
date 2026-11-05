<script setup lang="ts">
/** 问题清单右侧筛选：轮次 / 同步源 / 审计类型 / 状态 / 复现 / 优先级 / 仅超期 / 关键字 */
import type { IssueOptions } from '../../shared/types'
import type { IssueFilter } from '../types'
import { ISSUE_LEVEL, ISSUE_STATUS, REPRO_STATE, tagOptions } from '../../shared/types'

defineProps<{
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

function onOverdue(checked: boolean | (string | number | boolean)[]) {
  filter.value.overdue = checked === true ? '1' : ''
  emit('search')
}
</script>

<template>
  <div class="issue-filter">
    <a-select
      v-model="filter.round_id"
      :options="options.rounds"
      placeholder="轮次"
      allow-clear
      allow-search
      style="width: 180px"
      @change="emit('search')"
    />
    <a-select
      v-model="filter.source_id"
      :options="options.sources"
      placeholder="同步源"
      allow-clear
      allow-search
      style="width: 160px"
      @change="emit('search')"
    />
    <a-select
      v-model="filter.audit_type"
      :options="options.audit_types"
      placeholder="审计类型"
      multiple
      allow-clear
      allow-search
      :max-tag-count="1"
      style="width: 220px"
      @change="emit('search')"
    />
    <a-select
      v-model="filter.status"
      :options="statusOptions"
      placeholder="状态"
      multiple
      allow-clear
      :max-tag-count="2"
      style="width: 200px"
      @change="emit('search')"
    />
    <a-select
      v-model="filter.repro_state"
      :options="reproOptions"
      placeholder="复现状态"
      allow-clear
      style="width: 120px"
      @change="emit('search')"
    />
    <a-select
      v-model="filter.level"
      :options="levelOptions"
      placeholder="优先级"
      allow-clear
      style="width: 100px"
      @change="emit('search')"
    />
    <a-checkbox :model-value="filter.overdue === '1'" @change="onOverdue">
      仅超期
    </a-checkbox>
    <a-input
      v-model="filter.keyword"
      placeholder="标题 / 调用类 / 领域 / 用户故事 / 缺陷编码 / 指纹"
      allow-clear
      style="width: 280px"
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
.issue-filter { display: flex; flex-wrap: wrap; gap: 8px 10px; align-items: center; }
</style>
