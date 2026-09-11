<script setup lang="ts">
/**
 * 执行摘要面板（OPT-2）
 *
 * 从「执行记录」抽屉里抽出来的展示组件：4 万条明细翻不动，先给聚合视图。
 * 数据由父组件拉取（GET /sechub/scan/runs/{id}/summary），本组件只负责渲染与交互：
 *   · 结果总数 + 判定分布
 *   · 按「用例类型×测试类型」分组卡片（rule_label、判定计数、样例实体）
 *   · 点分组卡片 → emit drill（父组件把该组灌进结果筛选并刷新明细）
 */
import { computed } from 'vue'

const props = defineProps<{
  summary: any
  loading: boolean
  exporting?: boolean
}>()

const emit = defineEmits<{
  (e: 'drill', group: any): void
  (e: 'export'): void
}>()

const VERDICT_COLORS: Record<string, string> = {
  PASS: 'green',
  FAIL: 'red',
  REVIEW: 'orange',
  BLOCKED: 'gray',
  ERROR: 'orangered',
}
const verdictColor = (v: string) => VERDICT_COLORS[v] ?? 'gray'

/** 判定分布（固定顺序渲染，与结果表格的判定色一致） */
const verdictStats = computed(() => {
  const counts = props.summary?.verdict_counts || {}
  return ['PASS', 'FAIL', 'REVIEW', 'BLOCKED', 'ERROR']
    .filter(v => counts[v])
    .map(v => ({ label: v, value: counts[v] as number, color: verdictColor(v) }))
})

const groups = computed<any[]>(() => {
  const g = props.summary?.groups
  return Array.isArray(g) ? g : []
})

/** 分组卡片 key：case_type + test_type（test_type 可能为空） */
function groupKey(g: any) {
  return `${g.case_type || ''}-${g.test_type || ''}`
}

/** 样例形如「1122（R02a 权限未配置）」，卡片上只显示实体标识，完整内容进 tooltip */
function sampleEntity(sample: string) {
  const idx = String(sample).indexOf('（')
  return idx > 0 ? String(sample).slice(0, idx) : sample
}
</script>

<template>
  <div>
    <div class="summary-header">
      <span class="summary-title">执行摘要</span>
      <a-button size="small" :loading="exporting" @click="emit('export')">
        导出报告
      </a-button>
    </div>
    <a-spin :loading="loading" style="display: block; min-height: 60px">
      <div class="domain-summary">
        <div class="summary-item">
          <span class="summary-label">结果总数</span>
          <span class="summary-value">{{ summary?.total ?? 0 }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">判定分布</span>
          <template v-if="verdictStats.length">
            <a-tag v-for="s in verdictStats" :key="s.label" :color="s.color">
              {{ s.label }}: {{ s.value }}
            </a-tag>
          </template>
          <span v-else class="summary-sub">暂无结果</span>
        </div>
      </div>
      <div v-if="groups.length" class="summary-groups">
        <div
          v-for="g in groups"
          :key="groupKey(g)"
          class="summary-group"
          @click="emit('drill', g)"
        >
          <div class="group-head">
            <span class="group-title">{{ g.rule_label }}</span>
            <span class="group-total">{{ g.total }} 条</span>
          </div>
          <div class="group-counts">
            <a-tag v-for="(cnt, v) in g.counts" :key="v" :color="verdictColor(String(v))">
              {{ v }}: {{ cnt }}
            </a-tag>
          </div>
          <div class="group-samples">
            <a-tooltip v-for="s in (g.samples || []).slice(0, 3)" :key="s" :content="s" mini>
              <span class="sample-tag">{{ sampleEntity(s) }}</span>
            </a-tooltip>
          </div>
        </div>
      </div>
    </a-spin>
  </div>
</template>

<style scoped>
.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.summary-title {
  font-weight: 600;
}

.domain-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: center;
  padding: 12px 16px;
  margin-bottom: 12px;
  background: var(--color-fill-1);
  border-radius: 4px;
}

.summary-item {
  display: flex;
  gap: 8px;
  align-items: center;
}

.summary-label {
  color: var(--color-text-3);
}

.summary-value {
  font-weight: 600;
}

.summary-sub {
  color: var(--color-text-3);
  font-size: 12px;
}

.summary-groups {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.summary-group {
  padding: 10px 12px;
  cursor: pointer;
  background: var(--color-fill-1);
  border: 1px solid var(--color-border-1);
  border-radius: 4px;
  transition: border-color 0.2s;
}

.summary-group:hover {
  border-color: var(--color-border-3);
}

.group-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.group-title {
  font-weight: 600;
}

.group-total {
  color: var(--color-text-3);
  font-size: 12px;
}

.group-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}

.group-samples {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.sample-tag {
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
