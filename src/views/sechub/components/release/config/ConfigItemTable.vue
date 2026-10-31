<script setup lang="ts">
/**
 * 配置检查明细表：对象（含类型）/ 规则 / 级别 / 处理状态 / 处理人 / 应用 / 项目组 / 时间 / 新增标记 + 行操作。
 *
 * 列头说明来自 `GET /config-check/fields`；行操作为生成缺陷（已提缺陷时改为查看）、
 * 加白名单、历史（变更记录抽屉）。未归属项目组的检查项无法生成缺陷。
 */
import type { PaginationProps, TableData } from '@arco-design/web-vue'
import type { ConfigFieldDef, ConfigItem } from '@/types/sechub-release'

import { formatTime } from '@/hooks'
import {
  configDefectLink,
  configHandlingMeta,
  configSeverityMeta,
} from '../../../composables/configCheckRules'
import ConfigFieldTitle from './ConfigFieldTitle.vue'

const props = defineProps<{
  list: ConfigItem[]
  loading: boolean
  pagination: PaginationProps
  fieldDefs: Record<string, ConfigFieldDef>
  productLine: string
  defectLoadingId: string
}>()

const emit = defineEmits<{
  (e: 'createDefect', item: ConfigItem): void
  (e: 'viewDefect', item: ConfigItem): void
  (e: 'addWaiver', item: ConfigItem): void
  (e: 'viewEvents', item: ConfigItem): void
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

function defectPath(item: ConfigItem): string {
  return configDefectLink(item.defect?.defect_code ?? '', props.productLine)
}

/** 只有待处理且归属项目组的检查项可以生成缺陷 */
function canCreate(item: ConfigItem): boolean {
  return item.handling === 'pending' && Boolean(item.project_group_code?.trim())
}
</script>

<template>
  <a-table
    :data="list"
    :loading="loading"
    :pagination="pagination"
    :scroll="{ minWidth: 1640 }"
    row-key="id"
    size="small"
    @page-change="(page: number) => emit('pageChange', page)"
    @page-size-change="(size: number) => emit('pageSizeChange', size)"
  >
    <template #columns>
      <a-table-column :width="230">
        <template #title>
          <ConfigFieldTitle :defs="fieldDefs" fallback="对象" field="object" />
        </template>
        <template #cell="{ record }">
          <div>{{ objectName(asItem(record)) }}</div>
          <div class="secondary">
            <span class="mono">{{ record.object_key }}</span>
            <span class="type-label">{{ record.object_type_label }}</span>
          </div>
        </template>
      </a-table-column>

      <a-table-column :width="170">
        <template #title>
          规则
        </template>
        <template #cell="{ record }">
          <a-tooltip :content="record.rule_description || ''" :disabled="!record.rule_description" position="top">
            <span class="rule-code">{{ record.rule_code }}</span>
          </a-tooltip>
          <div class="secondary">
            {{ record.rule_title || '-' }}
          </div>
        </template>
      </a-table-column>

      <a-table-column :width="80">
        <template #title>
          <ConfigFieldTitle :defs="fieldDefs" fallback="级别" field="severity" />
        </template>
        <template #cell="{ record }">
          <a-tag :color="configSeverityMeta(record.severity).color" size="small">
            {{ configSeverityMeta(record.severity).label }}
          </a-tag>
        </template>
      </a-table-column>

      <a-table-column :width="160">
        <template #title>
          <ConfigFieldTitle :defs="fieldDefs" fallback="处理状态" field="handling" />
        </template>
        <template #cell="{ record }">
          <a-tag :color="configHandlingMeta(record.handling).color" size="small">
            {{ record.handling_label || configHandlingMeta(record.handling).label }}
          </a-tag>
          <router-link
            v-if="record.defect"
            class="defect-link"
            :to="defectPath(asItem(record))"
          >
            {{ record.defect.defect_code }}
          </router-link>
        </template>
      </a-table-column>

      <a-table-column :width="100" ellipsis title="处理人">
        <template #cell="{ record }">
          {{ asItem(record).handler || '--' }}
        </template>
      </a-table-column>

      <a-table-column :width="140" ellipsis>
        <template #title>
          <ConfigFieldTitle :defs="fieldDefs" fallback="应用" field="app" />
        </template>
        <template #cell="{ record }">
          {{ appText(asItem(record)) }}
        </template>
      </a-table-column>

      <a-table-column :width="140" ellipsis>
        <template #title>
          <ConfigFieldTitle :defs="fieldDefs" fallback="项目组" field="project_group" />
        </template>
        <template #cell="{ record }">
          {{ groupText(asItem(record)) }}
        </template>
      </a-table-column>

      <a-table-column :width="150">
        <template #title>
          <ConfigFieldTitle :defs="fieldDefs" fallback="首次发现" field="first_seen_at" />
        </template>
        <template #cell="{ record }">
          {{ formatTime(record.first_seen_at) }}
        </template>
      </a-table-column>

      <a-table-column :width="150">
        <template #title>
          <ConfigFieldTitle :defs="fieldDefs" fallback="最近一次命中" field="last_seen_at" />
        </template>
        <template #cell="{ record }">
          {{ formatTime(record.last_seen_at) }}
        </template>
      </a-table-column>

      <a-table-column :width="90">
        <template #title>
          <ConfigFieldTitle :defs="fieldDefs" fallback="本迭代新增" field="is_new" />
        </template>
        <template #cell="{ record }">
          <a-tag v-if="record.is_new" color="arcoblue" size="small">
            是
          </a-tag>
          <span v-else class="secondary">否</span>
        </template>
      </a-table-column>

      <a-table-column :width="210" fixed="right" title="操作">
        <template #cell="{ record }">
          <a-space :size="4">
            <a-button
              v-if="record.handling === 'defect_filed' && record.defect"
              size="mini"
              @click="emit('viewDefect', asItem(record))"
            >
              查看缺陷
            </a-button>
            <a-button
              v-else
              :disabled="!canCreate(asItem(record))"
              :loading="defectLoadingId === record.id"
              size="mini"
              @click="emit('createDefect', asItem(record))"
            >
              生成缺陷
            </a-button>
            <a-button size="mini" @click="emit('addWaiver', asItem(record))">
              加白名单
            </a-button>
            <a-button size="mini" @click="emit('viewEvents', asItem(record))">
              历史
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
  font-family: var(--font-mono);
  font-weight: 500;
  cursor: help;
}
.secondary {
  color: var(--color-text-3);
  font-size: 12px;
}
.mono {
  font-family: var(--font-mono);
}
.type-label {
  margin-left: 6px;
  padding: 0 4px;
  border-radius: 2px;
  background: var(--color-fill-2);
}
.defect-link {
  margin-left: 6px;
  font-size: 12px;
}
</style>
