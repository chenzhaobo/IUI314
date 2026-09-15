<script setup lang="ts">
/**
 * 影响面构成（详情抽屉版）：四个口径并排的对比表 + 修复收益。
 *
 * 为什么要对比表：这三个来源窗口、统计量、粒度都不同，平铺成一列数字时
 * 617ms（整表单 30 天平均）和 5.2s（本问题段中位）会被读成互相矛盾。
 * 并排之后每一格都挂在自己的口径上，且"修完能提升多少"一眼可见。
 *
 * tooltip 空间不够放七列，用 `impactSections`（同源数据、分段展示）。
 */
import type { AnalysisRecord } from './analysisFields'
import { computed } from 'vue'
import { impactComparison, impactFormula, impactPendingNote, impactRecovery } from './analysisFields'

const props = defineProps<{ record: AnalysisRecord }>()

const rows = computed(() => impactComparison(props.record))
const formula = computed(() => impactFormula(props.record))
const recovery = computed(() => impactRecovery(props.record))
const pendingNote = computed(() => impactPendingNote(props.record))
</script>

<template>
  <div class="impact-breakdown">
    <!-- 待补证排在最前：它决定这些数能不能拿来排期 -->
    <div v-if="pendingNote" class="ib-pending">
      {{ pendingNote }}
    </div>
    <div v-if="formula" class="ib-formula">
      折算算式：{{ formula }}
    </div>
    <table class="ib-table">
      <thead>
        <tr>
          <th>口径</th>
          <th>时间窗</th>
          <th>客户</th>
          <th>总请求</th>
          <th>慢请求 (&gt;3s)</th>
          <th>达标率</th>
          <th>平均耗时</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, idx) in rows" :key="idx">
          <td>{{ row.label }}</td>
          <td>{{ row.window }}</td>
          <td>{{ row.customers }}</td>
          <td>{{ row.requests }}</td>
          <td>{{ row.slow }}</td>
          <td>{{ row.meetRate }}</td>
          <td>{{ row.avgCost }}</td>
        </tr>
      </tbody>
    </table>
    <div v-if="recovery.length" class="ib-recovery">
      <div class="ib-recovery-title">
        修复收益（估算）
      </div>
      <div v-for="(line, idx) in recovery" :key="idx">
        {{ line }}
      </div>
    </div>
    <div class="ib-foot">
      达标率 = 1 − 慢请求 ÷ 总请求（快照口径）；「日志桶」只有慢请求样本，算不出达标率。
      折算自抽样、达标上限是乐观值；平均耗时按请求数加权；客户数待接入 Superset。
    </div>
  </div>
</template>

<style scoped>
.impact-breakdown {
  line-height: 1.7;
}

.ib-pending {
  margin-bottom: 6px;
  color: #f77234;
}

.ib-formula {
  margin-bottom: 6px;
  color: var(--color-text-2);
  font-size: 12px;
}

/* 七列在详情抽屉里放得下；tooltip 走 impactSections 的分段版 */
.ib-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.ib-table th,
.ib-table td {
  padding: 4px 6px;
  border: 1px solid var(--color-border-2);
  text-align: left;
  vertical-align: top;
}

.ib-table th {
  font-weight: 600;
  background: var(--color-fill-2);
}

.ib-recovery {
  margin-top: 8px;
}

.ib-recovery-title {
  font-weight: 600;
}

.ib-foot {
  margin-top: 8px;
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
