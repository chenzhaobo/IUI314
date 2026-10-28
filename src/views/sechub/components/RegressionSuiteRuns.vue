<script setup lang="ts">
/**
 * 回归套件运行记录（按环境过滤、服务端分页）
 *
 * 父组件通过 refreshKey 触发刷新；defineExpose.showEnv 供环境行「查看运行」下钻。
 */
import type { SecRegressionSuiteEnv, SecRegressionSuiteRun } from '@/api/sechubApis'
import { computed, ref, watch } from 'vue'

import { ApiSecRegressionSuite, resolveStaticScanApi } from '@/api/sechubApis'
import { formatTime, getAction } from '@/hooks'

const props = defineProps<{
  suiteId: string
  envs: SecRegressionSuiteEnv[]
  refreshKey: number
}>()

const RUN_STATUS: Record<string, { label: string, color: string }> = {
  pending: { label: '待执行', color: 'gray' },
  running: { label: '运行中', color: 'blue' },
  success: { label: 'PASS', color: 'green' },
  failed: { label: 'FAIL', color: 'red' },
  partial: { label: '部分通过', color: 'orange' },
  cancelled: { label: '已取消', color: 'gray' },
}

const PAGE_SIZE = 8

const runs = ref<SecRegressionSuiteRun[]>([])
const loading = ref(false)
const page = ref(1)
const total = ref(0)
const envFilter = ref('')

const pagination = computed(() => ({
  current: page.value,
  pageSize: PAGE_SIZE,
  total: total.value,
  showTotal: true,
}))

function runStatusMeta(status?: string | null) {
  return RUN_STATUS[status || ''] ?? { label: status || '--', color: 'gray' }
}

function envLabel(envId: string) {
  return props.envs.find(env => env.sec_env_id === envId)?.env_name || envId
}

async function load(target = 1) {
  if (!props.suiteId)
    return
  loading.value = true
  page.value = target
  try {
    const res = await getAction<{ list?: SecRegressionSuiteRun[], total?: number }>(
      resolveStaticScanApi(ApiSecRegressionSuite.runs, { id: props.suiteId }),
      { page_num: target, page_size: PAGE_SIZE, env_id: envFilter.value || undefined },
    )
    runs.value = Array.isArray(res?.list) ? res.list : []
    total.value = res?.total || 0
  }
  finally {
    loading.value = false
  }
}

function showEnv(envId: string) {
  envFilter.value = envId
  load(1)
}

defineExpose({ showEnv })

watch(() => [props.suiteId, props.refreshKey] as const, () => {
  envFilter.value = ''
  runs.value = []
  total.value = 0
  load(1)
}, { immediate: true })
</script>

<template>
  <div class="suite-runs">
    <a-space class="suite-runs__filter">
      <a-select v-model="envFilter" placeholder="全部环境" allow-clear style="width: 240px" @change="load(1)">
        <a-option v-for="env in envs" :key="env.sec_env_id" :value="env.sec_env_id">
          {{ env.env_name || env.sec_env_id }}
        </a-option>
      </a-select>
      <a-button @click="load(page)">
        刷新
      </a-button>
    </a-space>

    <a-table
      :data="runs"
      :loading="loading"
      :pagination="pagination"
      row-key="id"
      size="small"
      :scroll="{ minWidth: 820 }"
      @page-change="load"
    >
      <template #columns>
        <a-table-column title="运行名称" data-index="run_name" :width="220" ellipsis tooltip />
        <a-table-column title="环境" data-index="env_id" :width="130" ellipsis tooltip>
          <template #cell="{ record }">
            {{ record.env_id ? envLabel(record.env_id) : '--' }}
          </template>
        </a-table-column>
        <a-table-column title="状态" data-index="status" :width="90">
          <template #cell="{ record }">
            <a-tag :color="runStatusMeta(record.status).color">
              {{ runStatusMeta(record.status).label }}
            </a-tag>
          </template>
        </a-table-column>
        <a-table-column title="触发方式" data-index="trigger_mode" :width="90">
          <template #cell="{ record }">
            {{ record.trigger_mode === 'scheduled' ? '定时' : '手动' }}
          </template>
        </a-table-column>
        <a-table-column title="通过/失败" :width="100">
          <template #cell="{ record }">
            <span class="pass">{{ record.pass_cnt }}</span> / <span class="fail">{{ record.fail_cnt }}</span>
          </template>
        </a-table-column>
        <a-table-column title="开始时间" data-index="started_at" :width="160">
          <template #cell="{ record }">
            {{ formatTime(record.started_at) }}
          </template>
        </a-table-column>
      </template>
    </a-table>
  </div>
</template>

<style scoped>
.suite-runs__filter {
  margin-bottom: 8px;
}

.pass {
  color: var(--color-success-6);
}
.fail {
  color: var(--color-danger-6);
}
</style>
