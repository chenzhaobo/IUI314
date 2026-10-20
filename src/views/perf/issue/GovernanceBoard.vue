<script setup lang="ts">
/**
 * 达标治理看板：按项目组一行，串起「达标率 → 分析覆盖 → 台账处置 → 缺陷承诺 → 验证」。
 * 点项目组打开方案初稿；带 `?project_group_code=` 进入（云之家周报的详情链接）时自动打开。
 */
import type { GovernanceQuery, GovernanceRow } from '@/types/perf-governance'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import ListPage from '@/components/common/ListPage.vue'
import GovernancePlanDrawer from '@/views/perf/components/GovernancePlanDrawer.vue'
import { fmtRate, useGovernanceBoard } from '@/views/perf/composables/useGovernance'

// name 必须等于 sys_menu.path：keep-alive 按它匹配缓存
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'governance-board' })

const { query, board, loading, periods, domains, load, changePeriodType, init } = useGovernanceBoard()

const rows = computed<GovernanceRow[]>(() => {
  const b = board.value
  return b ? [...b.rows, b.summary] : []
})

/** 后端合计行的哨兵编码，不可点开方案 */
const TOTAL_CODE = '__total__'

const drawerVisible = ref(false)
const planQuery = ref<GovernanceQuery | null>(null)
function openPlan(code: string) {
  if (!code)
    return
  planQuery.value = { ...query.value, project_group_code: code, only_failing: undefined }
  drawerVisible.value = true
}

const route = useRoute()
onMounted(() => {
  init()
  const code = route.query.project_group_code
  if (typeof code === 'string' && code)
    openPlan(code)
})
</script>

<template>
  <div class="p-4">
    <ListPage>
      <template #filter>
        <a-space wrap>
          <a-select v-model="query.product_domain" placeholder="产品领域" allow-clear class="gb-sel" @change="load">
            <a-option v-for="o in domains" :key="o.code" :value="o.code">
              {{ o.name }}
            </a-option>
          </a-select>
          <a-radio-group :model-value="query.period_type" type="button" @change="v => changePeriodType(String(v))">
            <a-radio value="weekly">
              周
            </a-radio>
            <a-radio value="monthly">
              月
            </a-radio>
          </a-radio-group>
          <a-select v-model="query.period" placeholder="周期" class="gb-sel" @change="load">
            <a-option v-for="p in periods" :key="p.period" :value="p.period">
              {{ p.label }}
            </a-option>
          </a-select>
          <a-checkbox v-model="query.only_failing" @change="load">
            只看不达标
          </a-checkbox>
          <a-button type="primary" :loading="loading" @click="load">
            刷新
          </a-button>
        </a-space>
      </template>
      <template #toolbar>
        <span v-if="board" class="muted">
          {{ board.period_start }} ~ {{ board.period_end }}，目标 {{ board.target_rate }}%；点项目组查看治理方案初稿
        </span>
      </template>
      <template #default="{ tableHeight }">
        <a-table :data="rows" :loading="loading" :pagination="false" row-key="project_group_code" :scroll="{ minWidth: 1500, y: tableHeight }" :bordered="{ cell: true }">
          <template #columns>
            <a-table-column title="项目组" :width="180" fixed="left">
              <template #cell="{ record }">
                <a-link v-if="record.project_group_code !== TOTAL_CODE" @click="openPlan(record.project_group_code)">
                  {{ record.project_group_name || record.project_group_code }}
                </a-link>
                <b v-else>{{ record.project_group_name }}</b>
              </template>
            </a-table-column>
            <a-table-column title="业务领域" data-index="business_area" :width="110" ellipsis tooltip />
            <a-table-column title="达标率">
              <a-table-column title="达标率" :width="96">
                <template #cell="{ record }">
                  <span :class="record.pass ? '' : 'fail'">{{ fmtRate(record.rate) }}</span>
                </template>
              </a-table-column>
              <a-table-column title="请求数" data-index="total" :width="90" />
              <a-table-column title="超3s" data-index="over" :width="80" />
              <a-table-column title="需削减" data-index="over_to_cut" :width="80" />
            </a-table-column>
            <a-table-column title="分析覆盖">
              <a-table-column title="未达标表单" data-index="failing_forms" :width="96" />
              <a-table-column title="已分析" data-index="analyzed_forms" :width="80" />
            </a-table-column>
            <a-table-column title="台账处置">
              <a-table-column title="总数" data-index="ledger_total" :width="70" />
              <a-table-column title="待处置" data-index="ledger_pending" :width="76" />
              <a-table-column title="已转缺陷" data-index="ledger_issued" :width="86" />
              <a-table-column title="观察中" data-index="ledger_observing" :width="76" />
              <a-table-column title="不处理" data-index="ledger_wont_fix" :width="76" />
            </a-table-column>
            <a-table-column title="缺陷承诺">
              <a-table-column title="缺陷数" data-index="issue_total" :width="76" />
              <a-table-column title="有计划" data-index="issue_with_plan" :width="76" />
              <a-table-column title="未认领" data-index="issue_unclaimed" :width="76" />
              <a-table-column title="处理中" data-index="issue_in_progress" :width="76" />
              <a-table-column title="逾期" :width="70">
                <template #cell="{ record }">
                  <span :class="record.issue_overdue > 0 ? 'fail' : ''">{{ record.issue_overdue }}</span>
                </template>
              </a-table-column>
            </a-table-column>
            <a-table-column title="验证">
              <a-table-column title="已发版" data-index="issue_released" :width="76" />
              <a-table-column title="已验证" data-index="issue_verified" :width="76" />
              <a-table-column title="不处理" data-index="issue_wont_fix" :width="76" />
            </a-table-column>
          </template>
        </a-table>
      </template>
    </ListPage>
    <GovernancePlanDrawer v-model:visible="drawerVisible" :query="planQuery" />
  </div>
</template>

<style scoped>
.gb-sel { width: 180px; }
.muted { color: var(--color-text-3); font-size: 13px; }
.fail { color: rgb(var(--danger-6)); font-weight: 600; }
</style>
