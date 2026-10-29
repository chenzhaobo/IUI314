<script setup lang="ts">
/**
 * 配置检查概览：规则统计卡 + 项目组统计卡（含生成缺陷草稿入口）。
 *
 * 两张卡都由页面传入的 by_rule / by_group 渲染；
 * 同时选中规则与项目组时才显示「生成缺陷草稿」。
 */
import type { ConfigGroupStat, ConfigRuleDef, ConfigRuleStat } from '@/types/sechub-release'

import ConfigGroupTable from './ConfigGroupTable.vue'
import ConfigRuleTable from './ConfigRuleTable.vue'

defineProps<{
  ruleStats: ConfigRuleStat[]
  defs: Record<string, ConfigRuleDef>
  activeRule: string
  groupStats: ConfigGroupStat[]
  activeGroup: string
  loading: boolean
  canCreateDefect: boolean
  defectLoading: boolean
  defectCreated: boolean
  /** 「规则 M01 · 项目组 GL」形式的选择提示 */
  selectedHint: string
}>()

const emit = defineEmits<{
  (e: 'selectRule', ruleCode: string): void
  (e: 'selectGroup', projectGroupCode: string): void
  (e: 'createDefect'): void
}>()
</script>

<template>
  <div class="overview">
    <a-card :bordered="false">
      <div class="title">
        规则统计（点击行按规则过滤；编号悬停看说明）
      </div>
      <ConfigRuleTable
        :rows="ruleStats"
        :defs="defs"
        :active-rule="activeRule"
        :loading="loading"
        @select="code => emit('selectRule', code)"
      />
    </a-card>

    <a-card :bordered="false">
      <div class="toolbar">
        <div class="title">
          项目组统计（点击行按项目组过滤）
        </div>
        <a-space v-if="canCreateDefect">
          <span class="hint">{{ selectedHint }}</span>
          <a-button type="primary" :loading="defectLoading" @click="emit('createDefect')">
            生成缺陷草稿
          </a-button>
        </a-space>
        <span v-else-if="selectedHint" class="hint">{{ selectedHint }}</span>
      </div>
      <a-alert v-if="defectCreated" type="success" :show-icon="false" style="margin-bottom: 8px">
        缺陷草稿已生成 / 更新。
        <router-link to="/sechub/release/release-defects">
          去缺陷草稿
        </router-link>
      </a-alert>
      <ConfigGroupTable
        :rows="groupStats"
        :active-group="activeGroup"
        :loading="loading"
        @select="code => emit('selectGroup', code)"
      />
    </a-card>
  </div>
</template>

<style scoped>
.overview {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.title {
  color: var(--color-text-1);
  font-size: 14px;
  font-weight: 600;
}
.toolbar .title {
  margin-bottom: 0;
}
.hint {
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
