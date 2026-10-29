<script setup lang="ts">
/** 发版检查：套件摘要（编码 / 名称 / 定时 / 启用状态）。 */
import type { ReleaseSuiteSummary } from '@/types/sechub-release'

import { suiteEnabledText } from '../../../composables/releaseDashboardRules'

defineProps<{
  suite: ReleaseSuiteSummary | null
  suiteCode: string
  running: boolean
}>()
</script>

<template>
  <a-descriptions
    v-if="suite"
    :column="{ xs: 1, md: 2, xl: 4 }"
    bordered
    size="small"
  >
    <a-descriptions-item label="套件编码">
      {{ suite.suite_code }}
    </a-descriptions-item>
    <a-descriptions-item label="套件名称">
      {{ suite.name }}
    </a-descriptions-item>
    <a-descriptions-item label="定时">
      {{ suite.schedule_cron || '-' }}（{{ suiteEnabledText(suite.schedule_enabled) }}）
    </a-descriptions-item>
    <a-descriptions-item label="状态">
      <a-tag
        v-if="running"
        color="blue"
      >
        执行中
      </a-tag>
      <a-tag
        v-else
        color="gray"
      >
        空闲
      </a-tag>
    </a-descriptions-item>
  </a-descriptions>
  <a-empty
    v-else
    :description="suiteCode ? `尚未创建发版回归套件（${suiteCode}）` : '尚未创建发版回归套件'"
  />
</template>
