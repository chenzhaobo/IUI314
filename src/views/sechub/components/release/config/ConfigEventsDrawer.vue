<script setup lang="ts">
/**
 * 检查项变更记录抽屉：时间倒序展示 opened / resolved / reopened / waived 等事件。
 */
import type { ConfigEvent, ConfigItem } from '@/types/sechub-release'

import { formatTime } from '@/hooks'
import { configEventLabel, configStateMeta } from '../../../composables/configCheckRules'

defineProps<{
  item: ConfigItem | null
  events: ConfigEvent[]
  loading: boolean
}>()

const visible = defineModel<boolean>('visible', { default: false })
</script>

<template>
  <a-drawer
    v-model:visible="visible"
    :footer="false"
    :width="760"
    title="变更记录"
    unmount-on-close
  >
    <template v-if="item">
      <a-descriptions :column="2" bordered size="small" style="margin-bottom: 12px">
        <a-descriptions-item label="规则">
          {{ item.rule_code }} · {{ item.rule_title || '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="对象">
          {{ item.object_name || item.object_key }}
        </a-descriptions-item>
        <a-descriptions-item label="当前状态">
          {{ configStateMeta(item.state).label }}
        </a-descriptions-item>
        <a-descriptions-item label="项目组">
          {{ item.project_group_name || item.project_group_code || '未分类' }}
        </a-descriptions-item>
      </a-descriptions>
      <a-table
        :data="events"
        :loading="loading"
        :pagination="false"
        row-key="id"
        size="small"
      >
        <template #columns>
          <a-table-column title="时间" :width="180">
            <template #cell="{ record }">
              {{ formatTime(record.created_at) }}
            </template>
          </a-table-column>
          <a-table-column title="事件" :width="120">
            <template #cell="{ record }">
              {{ configEventLabel(record.event) }}
            </template>
          </a-table-column>
          <a-table-column title="状态变化" :width="160">
            <template #cell="{ record }">
              <span v-if="record.old_state">
                {{ configStateMeta(record.old_state).label }} →
              </span>
              {{ configStateMeta(record.new_state).label }}
            </template>
          </a-table-column>
          <a-table-column title="操作人">
            <template #cell="{ record }">
              {{ record.actor || '扫描任务' }}
            </template>
          </a-table-column>
        </template>
        <template #empty>
          <a-empty description="暂无变更记录" />
        </template>
      </a-table>
    </template>
  </a-drawer>
</template>
