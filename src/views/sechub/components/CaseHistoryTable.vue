<script setup lang="ts">
/**
 * 用例最近执行历史（接口详情 / 表单详情两个抽屉共用）。
 *
 * 只渲染后端给的最近 5 次结果（`cases[].results`），每行带运行 / 任务 / 套件
 * 与触发方式，便于判断一次失败是手动试跑还是回归套件定时跑的。
 */
import type { TableColumnData } from '@arco-design/web-vue'
import type { CaseResultItem } from '@/types/sechub-test-results'
import { useRouter } from 'vue-router'

import { formatTime } from '@/hooks'
import { toRunResults, toSuite, toTask } from '../composables/secNavigation'
import { verdictColor } from '../composables/testResultsRules'

defineProps<{ results: CaseResultItem[] }>()

const router = useRouter()

const columns: TableColumnData[] = [
  { title: '执行时间', slotName: 'testedAt', width: 160 },
  { title: '判定', slotName: 'verdict', width: 90 },
  { title: '说明', dataIndex: 'detail', ellipsis: true, tooltip: true },
  { title: '执行记录', slotName: 'run', width: 220, ellipsis: true },
  { title: '触发方式', slotName: 'trigger', width: 90 },
  { title: '任务', slotName: 'task', width: 160, ellipsis: true },
  { title: '套件', slotName: 'suite', width: 160, ellipsis: true },
]

function triggerText(mode?: string | null): string {
  if (mode === 'scheduled')
    return '定时'
  if (mode === 'manual')
    return '手动'
  return mode || '--'
}
</script>

<template>
  <a-empty v-if="!results.length" description="暂无执行记录" />
  <a-table
    v-else
    :data="results"
    :columns="columns"
    :pagination="false"
    row-key="id"
    size="mini"
  >
    <template #testedAt="{ record }">
      {{ formatTime(record.tested_at) }}
    </template>
    <template #verdict="{ record }">
      <a-tag :color="verdictColor(record.verdict)" size="small">
        {{ record.verdict || '--' }}
      </a-tag>
    </template>
    <template #run="{ record }">
      <a-link v-if="record.run_id" @click="router.push(toRunResults(record.run_id))">
        {{ record.run_name || record.run_id }}
      </a-link>
      <span v-else>--</span>
    </template>
    <template #trigger="{ record }">
      {{ triggerText(record.trigger_mode) }}
    </template>
    <template #task="{ record }">
      <a-link v-if="record.task_id" @click="router.push(toTask(record.task_id))">
        {{ record.task_name || record.task_id }}
      </a-link>
      <span v-else>{{ record.task_name || '--' }}</span>
    </template>
    <template #suite="{ record }">
      <a-link v-if="record.suite_code" @click="router.push(toSuite(record.suite_code))">
        {{ record.suite_name || record.suite_code }}
      </a-link>
      <span v-else>{{ record.suite_name || '--' }}</span>
    </template>
  </a-table>
</template>
