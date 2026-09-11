<script setup lang="ts">
/**
 * 安全扫描 — 迭代阶段看板
 *
 * 数据来源：GET /sechub/scan/dashboard/iterations（api/src/sechub/sec_dashboard.rs
 * + service/src/sechub/sec_dashboard.rs）：
 *   - overall     运行总数 / 通过运行数 / 通过率 / 最近执行时间
 *   - phases      每个迭代阶段的运行数、最近一次运行、用例统计（总-通过-失败-复核）、新增资产
 *   - recent_runs 最近 N 次运行（含任务名 / 迭代阶段 / 总-通过-失败用例数）
 *
 * 菜单：安全测试 → 安全扫描 → 迭代看板（sys_menu.path = sec-scan-dashboard，
 * 迁移 m20260912_000002_sechub_dashboard_menu）。组件名必须与 path 一致
 * （keep-alive :include 按它对上缓存）；不能叫 scan-dashboard —— 该名字已被
 * 「静态扫描→扫描看板」占用，而路由 name 全局唯一。
 */
import { computed, onMounted, ref } from 'vue'

import { ApiSecScan } from '@/api/sechubApis'
import { formatTime, getAction } from '@/hooks'

// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'sec-scan-dashboard' })

// 运行状态取值域与 sec_sec_run.status 一致；色值映射与 DomainScanView.vue 保持同一套
const RUN_STATUS: Record<string, { label: string, color: string }> = {
  pending: { label: '待执行', color: 'gray' },
  running: { label: '运行中', color: 'blue' },
  success: { label: 'PASS', color: 'green' },
  failed: { label: 'FAIL', color: 'red' },
  partial: { label: '部分通过', color: 'orange' },
  cancelled: { label: '已取消', color: 'gray' },
}
function statusMeta(status?: string | null) {
  return RUN_STATUS[status || ''] ?? { label: status || '--', color: 'gray' }
}

const loading = ref(false)
const overall = ref<any>(null)
const phases = ref<any[]>([])
const recentRuns = ref<any[]>([])

const passRateValue = computed(() => (overall.value?.pass_rate || 0) * 100)
const lastRunAtText = computed(() => formatTime(overall.value?.last_run_at))
/** 阶段/运行行的通过率展示：后端已保留 3 位小数，这里统一成百分比 */
function rateText(rate?: number | null) {
  return `${((rate || 0) * 100).toFixed(1)}%`
}

async function fetchData() {
  loading.value = true
  try {
    const res = await getAction<any>(ApiSecScan.iterationDashboard, { limit: 10 })
    overall.value = res?.overall || null
    phases.value = res?.phases || []
    recentRuns.value = res?.recent_runs || []
  }
  finally {
    loading.value = false
  }
}

onMounted(fetchData)
</script>

<template>
  <div class="p-4">
    <a-spin :loading="loading" style="width: 100%">
      <!-- 顶部统计卡 -->
      <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <a-card class="text-center">
          <a-statistic title="运行总数" :value="overall?.run_count ?? 0" />
        </a-card>
        <a-card class="text-center">
          <a-statistic title="通过运行数" :value="overall?.pass_count ?? 0" />
        </a-card>
        <a-card class="text-center">
          <a-statistic title="通过率" :value="passRateValue" :precision="1" suffix="%" />
        </a-card>
        <a-card class="text-center">
          <div class="stat-title">
            最近执行时间
          </div>
          <div class="stat-time">
            {{ lastRunAtText }}
          </div>
        </a-card>
      </div>

      <!-- 按迭代阶段 -->
      <a-card title="按迭代阶段" class="mt-4">
        <a-table
          :data="phases"
          :pagination="false"
          row-key="phase"
          :scroll="{ minWidth: 1000 }"
        >
          <template #columns>
            <a-table-column title="迭代阶段" data-index="phase" :width="220" ellipsis tooltip />
            <a-table-column title="运行数" data-index="run_count" :width="90" />
            <a-table-column title="最近运行" :width="300">
              <template #cell="{ record }">
                <template v-if="record.last_run">
                  <a-tag :color="statusMeta(record.last_run.status).color">
                    {{ statusMeta(record.last_run.status).label }}
                  </a-tag>
                  <span class="cell-strong">{{ record.last_run.run_name }}</span>
                  <div class="cell-sub">
                    {{ formatTime(record.last_run.started_at || record.last_run.finished_at) }}
                  </div>
                </template>
                <span v-else class="cell-sub">--</span>
              </template>
            </a-table-column>
            <a-table-column title="用例统计（总-通过-失败-复核）" :width="240">
              <template #cell="{ record }">
                {{ record.totals?.total ?? 0 }}-{{ record.totals?.pass ?? 0 }}-{{ record.totals?.fail ?? 0 }}-{{ record.totals?.review ?? 0 }}
                <div class="cell-sub">
                  通过率 {{ rateText(record.pass_rate) }}
                </div>
              </template>
            </a-table-column>
            <a-table-column title="新增资产（表单/按钮/API）" :width="200">
              <template #cell="{ record }">
                {{ record.new_forms ?? 0 }} / {{ record.new_buttons ?? 0 }} / {{ record.new_apis ?? 0 }}
              </template>
            </a-table-column>
          </template>
          <template #empty>
            <a-empty description="暂无扫描运行记录：在「扫描任务」执行任务后按迭代阶段汇总" />
          </template>
        </a-table>
      </a-card>

      <!-- 最近运行 -->
      <a-card title="最近运行" class="mt-4">
        <a-table
          :data="recentRuns"
          :pagination="false"
          row-key="id"
          :scroll="{ minWidth: 960 }"
        >
          <template #columns>
            <a-table-column title="运行名称" data-index="run_name" :width="220" ellipsis tooltip />
            <a-table-column title="任务" data-index="task_name" :width="180" ellipsis tooltip>
              <template #cell="{ record }">
                {{ record.task_name || '--' }}
              </template>
            </a-table-column>
            <a-table-column title="迭代阶段" :width="160" ellipsis tooltip>
              <template #cell="{ record }">
                {{ record.iteration_phase || '未标记' }}
              </template>
            </a-table-column>
            <a-table-column title="状态" :width="110">
              <template #cell="{ record }">
                <a-tag :color="statusMeta(record.status).color">
                  {{ statusMeta(record.status).label }}
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column title="开始时间" :width="170">
              <template #cell="{ record }">
                {{ formatTime(record.started_at) }}
              </template>
            </a-table-column>
            <a-table-column title="用例（总-通过-失败）" :width="180">
              <template #cell="{ record }">
                {{ record.total_cases ?? 0 }}-{{ record.pass_cnt ?? 0 }}-{{ record.fail_cnt ?? 0 }}
              </template>
            </a-table-column>
          </template>
          <template #empty>
            <a-empty description="暂无运行记录" />
          </template>
        </a-table>
      </a-card>
    </a-spin>
  </div>
</template>

<style scoped>
.stat-title {
  margin-bottom: 8px;
  color: var(--color-text-2);
}

.stat-time {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.4;
}

.cell-strong {
  margin-left: 8px;
  font-weight: 600;
}

.cell-sub {
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
