<script setup lang="ts">
/**
 * 未覆盖 Top 20 + 阻塞原因汇总。
 *
 * 未覆盖面已按「新增 > 高风险 > 变更 > 路径」排序并截断（后端），这里只展示；
 * 阻塞原因按归类汇总接口数，空表显示提示。
 */
import type { ReleaseApi } from '@/types/sechub-release'
import { computed } from 'vue'

import { coverageStatusColor, coverageStatusLabel } from '../../../composables/releaseCoverageRules'
import { blockReasonRows } from '../../../composables/releaseDashboardRules'

const props = defineProps<{
  apis: ReleaseApi[]
  blockReasons: Record<string, number>
}>()

const reasons = computed(() => blockReasonRows(props.blockReasons))
const totalBlocked = computed(() => reasons.value.reduce((sum, row) => sum + row.count, 0))

/** 同一路径可能有多方法：行键用「路径 + 方法」（Arco 的 row-key 只认字段名） */
const rows = computed(() => props.apis.map(api => ({
  ...api,
  row_key: `${api.api_path}|${api.http_method ?? ''}`,
})))
</script>

<template>
  <div class="uncovered-panel">
    <a-card :bordered="false">
      <div class="title">
        未覆盖 Top {{ apis.length }}
      </div>
      <a-table
        :data="rows"
        :pagination="false"
        row-key="row_key"
        :scroll="{ minWidth: 960 }"
        size="small"
      >
        <template #columns>
          <a-table-column title="接口路径" :width="300" ellipsis tooltip>
            <template #cell="{ record }">
              {{ record.api_path }}
            </template>
          </a-table-column>
          <a-table-column title="方法" :width="80">
            <template #cell="{ record }">
              {{ record.http_method || '-' }}
            </template>
          </a-table-column>
          <a-table-column title="名称" :width="220" ellipsis tooltip>
            <template #cell="{ record }">
              {{ record.name || '-' }}
            </template>
          </a-table-column>
          <a-table-column title="项目组" :width="140" ellipsis tooltip>
            <template #cell="{ record }">
              {{ record.project_group_name || record.project_group_code }}
            </template>
          </a-table-column>
          <a-table-column title="标签" :width="140">
            <template #cell="{ record }">
              <a-space size="mini">
                <a-tag v-if="record.tags.is_new" color="arcoblue" size="small">
                  新增
                </a-tag>
                <a-tag v-if="record.tags.is_changed" color="orange" size="small">
                  变更
                </a-tag>
                <a-tag v-if="record.high_risk" color="red" size="small">
                  高风险
                </a-tag>
              </a-space>
            </template>
          </a-table-column>
          <a-table-column title="覆盖状态" :width="100">
            <template #cell="{ record }">
              <a-tag :color="coverageStatusColor(record.coverage)" size="small">
                {{ coverageStatusLabel(record.coverage) }}
              </a-tag>
            </template>
          </a-table-column>
        </template>
      </a-table>
      <a-empty v-if="!apis.length" description="没有未覆盖接口" />
    </a-card>

    <a-card :bordered="false">
      <div class="title">
        阻塞原因汇总（{{ totalBlocked }} 个接口）
      </div>
      <a-table :data="reasons" :pagination="false" row-key="code" size="small">
        <template #columns>
          <a-table-column title="归类" :width="260">
            <template #cell="{ record }">
              {{ record.label }}
            </template>
          </a-table-column>
          <a-table-column title="接口数" :width="100">
            <template #cell="{ record }">
              {{ record.count }}
            </template>
          </a-table-column>
        </template>
      </a-table>
      <a-empty v-if="!reasons.length" description="没有阻塞用例" />
    </a-card>
  </div>
</template>

<style scoped>
.uncovered-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.title {
  margin-bottom: 8px;
  color: var(--color-text-1);
  font-size: 14px;
  font-weight: 600;
}
</style>
