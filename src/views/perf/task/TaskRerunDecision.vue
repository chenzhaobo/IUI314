<script lang="ts" setup>
/**
 * 批次观测 →「复跑结论」：每个脚本的复跑裁决表（spec R9）。
 *
 * 原跑与最优 run 直接链到报告页（run_id 查询参数，report.vue 的 onMounted 会打开明细）。
 */
import type { TaskRerunView } from './types'
import { computed } from 'vue'
import { withTableDefaults } from '@/hooks'
import { PERF_REPORT_PATH } from '../routes'
import { sortDecisions, verdictColor, verdictText } from './types'

defineOptions({ name: 'TaskRerunDecision' })

const props = defineProps<{ view: TaskRerunView | null }>()

const rows = computed(() => sortDecisions(props.view))

const columns = withTableDefaults([
  { title: '脚本', dataIndex: 'script_name', slotName: 'script', width: 260, fixed: 'left' as const },
  { title: '复跑轮数', dataIndex: 'rounds', width: 100 },
  { title: '结论', slotName: 'verdict', width: 120 },
  { title: '原跑', slotName: 'origin', width: 140 },
  { title: '最优 run', slotName: 'best', width: 140 },
])

function shortId(id?: string | null): string {
  if (!id)
    return '—'
  return id.length > 10 ? `${id.slice(0, 8)}…` : id
}
</script>

<template>
  <div class="trd-wrap">
    <a-alert v-if="view && !view.decisions.length" type="info">
      {{ view.observe_state === 'env_suspect' ? '疑似环境异常，复跑已暂停' : '本批次没有需要复跑的脚本' }}
    </a-alert>
    <a-table
      v-else
      :data="rows"
      :columns="columns"
      :pagination="false"
      row-key="script_id"
      size="small"
      :scroll="{ minWidth: 820 }"
    >
      <template #script="{ record }">
        {{ record.script_name || record.script_id }}
      </template>
      <template #verdict="{ record }">
        <a-tag :color="verdictColor(record.verdict)" size="small">
          {{ verdictText(record.verdict) }}
        </a-tag>
      </template>
      <template #origin="{ record }">
        <router-link :to="{ path: PERF_REPORT_PATH, query: { run_id: record.origin_run_id } }">
          {{ shortId(record.origin_run_id) }}
        </router-link>
      </template>
      <template #best="{ record }">
        <router-link v-if="record.best_run_id" :to="{ path: PERF_REPORT_PATH, query: { run_id: record.best_run_id } }">
          {{ shortId(record.best_run_id) }}
        </router-link>
        <span v-else>—</span>
      </template>
    </a-table>
  </div>
</template>

<style scoped>
.trd-wrap {
  width: 100%;
}
</style>
