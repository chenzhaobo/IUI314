<script setup lang="ts">
/**
 * 问题分布：缺陷（新增 / 遗留 / 未处理高危）与配置问题（待处理 / 新增 / 已修复 / 已加白）。
 *
 * 两块各自链到缺陷草稿、配置检查，跳转路径与菜单一致。
 */
import type { ReleaseIssueInputs } from '@/types/sechub-release'
import { computed } from 'vue'

const props = defineProps<{
  issues: ReleaseIssueInputs
}>()

const defectCells = computed(() => [
  { label: '新增缺陷', value: props.issues.new_defects },
  { label: '遗留缺陷', value: props.issues.legacy_defects },
  { label: '未处理高危缺陷', value: props.issues.open_high_defects },
])

const configCells = computed(() => [
  { label: '待处理', value: props.issues.config_open },
  { label: '本迭代新增', value: props.issues.config_new },
  { label: '本迭代修复', value: props.issues.config_fixed },
  { label: '已加白', value: props.issues.config_waived },
])
</script>

<template>
  <div class="issue-distribution">
    <a-card :bordered="false">
      <div class="head">
        <span class="title">缺陷</span>
        <router-link to="/sechub/release/release-defects">
          去缺陷草稿
        </router-link>
      </div>
      <div class="cells">
        <div v-for="cell in defectCells" :key="cell.label" class="cell">
          <div class="cell-label">
            {{ cell.label }}
          </div>
          <div class="cell-value">
            {{ cell.value }}
          </div>
        </div>
      </div>
    </a-card>
    <a-card :bordered="false">
      <div class="head">
        <span class="title">配置问题</span>
        <router-link to="/sechub/release/release-config-check">
          去配置检查
        </router-link>
      </div>
      <div class="cells">
        <div v-for="cell in configCells" :key="cell.label" class="cell">
          <div class="cell-label">
            {{ cell.label }}
          </div>
          <div class="cell-value">
            {{ cell.value }}
          </div>
        </div>
      </div>
    </a-card>
  </div>
</template>

<style scoped>
.issue-distribution {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 12px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.title {
  color: var(--color-text-1);
  font-size: 14px;
  font-weight: 600;
}
.cells {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 12px;
}
.cell {
  padding: 10px 12px;
  border: 1px solid var(--color-border-2);
  border-radius: 6px;
}
.cell-label {
  color: var(--color-text-3);
  font-size: 12px;
}
.cell-value {
  margin-top: 4px;
  color: var(--color-text-1);
  font-size: 20px;
  font-weight: 600;
}
</style>
