<script setup lang="ts">
/**
 * 配置检查明细表：规则 / 对象 / 应用 / 项目组 / 级别 / 状态 / 时间 / 新增标记 + 行操作。
 *
 * 行操作：变更记录（抽屉）、加白名单（仅待处理项可加，后端只在 open 时转 waived）。
 */
import type { PaginationProps, TableData } from '@arco-design/web-vue'
import type { ConfigItem } from '@/types/sechub-release'

import { formatTime } from '@/hooks'
import { configSeverityMeta, configStateMeta } from '../../../composables/configCheckRules'

defineProps<{
  list: ConfigItem[]
  loading: boolean
  pagination: PaginationProps
}>()

const emit = defineEmits<{
  (e: 'viewEvents', item: ConfigItem): void
  (e: 'addWaiver', item: ConfigItem): void
  (e: 'pageChange', page: number): void
  (e: 'pageSizeChange', size: number): void
}>()

function asItem(record: TableData): ConfigItem {
  return record as unknown as ConfigItem
}

function objectName(item: ConfigItem): string {
  return item.object_name || item.object_key || '-'
}

function appText(item: ConfigItem): string {
  return item.app_name || item.app_number || '-'
}

function groupText(item: ConfigItem): string {
  return item.project_group_name || item.project_group_code || '未分类'
}
</script>

<template>
  <a-table
    :data="list"
    :loading="loading"
    :pagination="pagination"
    :scroll="{ minWidth: 1260 }"
    row-key="id"
    size="small"
    @page-change="(page: number) => emit('pageChange', page)"
    @page-size-change="(size: number) => emit('pageSizeChange', size)"
  >
    <template #columns>
      <a-table-column title="规则" :width="170">
        <template #cell="{ record }">
          <div class="rule-code">
            {{ record.rule_code }}
          </div>
          <div class="secondary">
            {{ record.rule_title || '-' }}
          </div>
        </template>
      </a-table-column>
      <a-table-column title="对象" :width="240" ellipsis tooltip>
        <template #cell="{ record }">
          <div>{{ objectName(asItem(record)) }}</div>
          <div class="secondary mono">
            {{ record.object_key }}
          </div>
        </template>
      </a-table-column>
      <a-table-column title="应用" :width="150" ellipsis tooltip>
        <template #cell="{ record }">
          {{ appText(asItem(record)) }}
        </template>
      </a-table-column>
      <a-table-column title="项目组" :width="150" ellipsis tooltip>
        <template #cell="{ record }">
          {{ groupText(asItem(record)) }}
        </template>
      </a-table-column>
      <a-table-column title="级别" :width="80">
        <template #cell="{ record }">
          <a-tag :color="configSeverityMeta(record.severity).color" size="small">
            {{ configSeverityMeta(record.severity).label }}
          </a-tag>
        </template>
      </a-table-column>
      <a-table-column title="状态" :width="90">
        <template #cell="{ record }">
          <a-tag :color="configStateMeta(record.state).color" size="small">
            {{ configStateMeta(record.state).label }}
          </a-tag>
        </template>
      </a-table-column>
      <a-table-column title="首次发现" :width="160">
        <template #cell="{ record }">
          {{ formatTime(record.first_seen_at) }}
        </template>
      </a-table-column>
      <a-table-column title="最近发现" :width="160">
        <template #cell="{ record }">
          {{ formatTime(record.last_seen_at) }}
        </template>
      </a-table-column>
      <a-table-column title="本迭代新增" :width="100">
        <template #cell="{ record }">
          <a-tag v-if="record.is_new" color="arcoblue" size="small">
            新增
          </a-tag>
          <span v-else class="secondary">-</span>
        </template>
      </a-table-column>
      <a-table-column title="操作" :width="170" fixed="right">
        <template #cell="{ record }">
          <a-space>
            <a-button size="mini" @click="emit('viewEvents', asItem(record))">
              变更记录
            </a-button>
            <a-button
              size="mini"
              type="primary"
              :disabled="record.state !== 'open'"
              @click="emit('addWaiver', asItem(record))"
            >
              加白名单
            </a-button>
          </a-space>
        </template>
      </a-table-column>
    </template>
    <template #empty>
      <a-empty description="当前筛选下没有检查项" />
    </template>
  </a-table>
</template>

<style scoped>
.rule-code {
  color: var(--color-text-1);
  font-weight: 500;
  font-family: var(--font-mono);
}
.secondary {
  color: var(--color-text-3);
  font-size: 12px;
}
.mono {
  font-family: var(--font-mono);
}
</style>
