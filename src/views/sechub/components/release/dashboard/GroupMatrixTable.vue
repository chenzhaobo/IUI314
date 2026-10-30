<script setup lang="ts">
/**
 * 项目组矩阵：覆盖率 / 新增覆盖率 / 执行率 / 通过率 / FAIL / 未处理高危缺陷 / 高危配置 / 结论。
 *
 * 行序沿用后端（Blocked → 未覆盖多 → 编码）；点项目组名交给页面按项目组设置范围，
 * 「看接口」带当前产品线 / 迭代 / 项目组跳接口覆盖页。
 */
import type { ReleaseGroupRow } from '@/types/sechub-release'
import { computed } from 'vue'

import { conclusionMeta, rateText } from '../../../composables/releaseDashboardRules'

const props = defineProps<{
  rows: ReleaseGroupRow[]
  productLine: string
  iterationId: string
}>()

const emit = defineEmits<{
  (e: 'selectGroup', code: string): void
}>()

const coveragePath = '/sechub/release/release-coverage'
const tableData = computed(() => props.rows)

function coverageLink(code: string) {
  const query: Record<string, string> = {}
  if (props.productLine)
    query.product_line = props.productLine
  if (props.iterationId)
    query.iteration_id = props.iterationId
  if (code)
    query.project_group = code
  return { path: coveragePath, query }
}
</script>

<template>
  <a-table
    :data="tableData"
    :pagination="false"
    :scroll="{ minWidth: 1120 }"
    row-key="project_group_code"
    size="small"
  >
    <template #columns>
      <a-table-column title="项目组" :width="240" ellipsis tooltip>
        <template #cell="{ record }">
          <a-link @click="emit('selectGroup', record.project_group_code || '')">
            {{ record.project_group_name || record.project_group_code || '未分类' }}
          </a-link>
          <router-link class="api-link" :to="coverageLink(record.project_group_code || '')">
            看接口
          </router-link>
          <div class="group-code">
            {{ record.project_group_code || '-' }}
          </div>
        </template>
      </a-table-column>
      <a-table-column title="覆盖率" :width="90">
        <template #cell="{ record }">
          {{ rateText(record.coverage.coverage_rate) }}
        </template>
      </a-table-column>
      <a-table-column title="新增覆盖率" :width="100">
        <template #cell="{ record }">
          {{ rateText(record.coverage.new_coverage_rate) }}
        </template>
      </a-table-column>
      <a-table-column title="执行率" :width="90">
        <template #cell="{ record }">
          {{ rateText(record.execution.exec_rate) }}
        </template>
      </a-table-column>
      <a-table-column title="通过率" :width="90">
        <template #cell="{ record }">
          {{ rateText(record.execution.pass_rate) }}
        </template>
      </a-table-column>
      <a-table-column title="FAIL" :width="70">
        <template #cell="{ record }">
          {{ record.execution.verdicts.fail }}
        </template>
      </a-table-column>
      <a-table-column title="未处理高危缺陷" :width="130">
        <template #cell="{ record }">
          {{ record.issues.open_high_defects }}
        </template>
      </a-table-column>
      <a-table-column title="高危配置（新增 / 存量）" :width="160">
        <template #cell="{ record }">
          {{ record.issues.new_high_config_open }} / {{ record.issues.legacy_high_config_open }}
        </template>
      </a-table-column>
      <a-table-column title="结论" :width="90">
        <template #cell="{ record }">
          <a-tag :color="conclusionMeta(record.conclusion).color" size="small">
            {{ conclusionMeta(record.conclusion).label }}
          </a-tag>
        </template>
      </a-table-column>
    </template>
  </a-table>
</template>

<style scoped>
.group-code {
  color: var(--color-text-3);
  font-size: 12px;
}
.api-link {
  margin-left: 8px;
  font-size: 12px;
}
</style>
