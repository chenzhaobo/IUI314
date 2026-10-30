<script setup lang="ts">
/**
 * 用例最近执行历史（接口详情 / 表单详情两个抽屉共用）。
 *
 * 只渲染后端给的最近 5 次结果（`cases[].results`），每行带运行 / 任务 / 套件
 * 与触发方式，便于判断一次失败是手动试跑还是回归套件定时跑的。
 */
import type { TableColumnData } from '@arco-design/web-vue'
import type { CaseResultItem } from '@/types/sechub-test-results'
import { formatTime } from '@/hooks'
import { verdictColor } from '../composables/testResultsRules'

defineProps<{ results: CaseResultItem[] }>()

const columns: TableColumnData[] = [
  { title: '执行时间', slotName: 'testedAt', width: 160 },
  { title: '判定', slotName: 'verdict', width: 90 },
  { title: '说明', dataIndex: 'detail', ellipsis: true, tooltip: true },
  { title: '执行记录', slotName: 'run', width: 220, ellipsis: true },
  { title: '触发方式', slotName: 'trigger', width: 90 },
  { title: '任务', dataIndex: 'task_name', width: 160, ellipsis: true, tooltip: true },
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
      {{ record.run_name || record.run_id || '--' }}
    </template>
    <template #trigger="{ record }">
      {{ triggerText(record.trigger_mode) }}
    </template>
    <template #suite="{ record }">
      {{ record.suite_name || record.suite_code || '--' }}
    </template>
  </a-table>
</template>
