<script setup lang="ts">
/**
 * 运行行的「扫描方式」标签（契约 C/D）：全量 / 增量 · 对比 <基线短 sha> / 部分 · N 条规则。
 *
 * scan_scope 为空（历史 run / 旧后端）时什么都不显示，由调用方退回旧的策略文案。
 * 增量的对比基线取行上的 base_commit（统一增量 run 沿用该列记录基线 commit；缺失时只显示「增量」）。
 */
import { computed } from 'vue'

const props = defineProps<{
  scanScope?: string | null
  ruleCount?: number | null
  baseCommit?: string | null
}>()

const tag = computed<{ label: string, color: string, tip: string } | null>(() => {
  const scope = props.scanScope?.trim() ?? ''
  if (scope === 'full')
    return { label: '全量', color: 'green', tip: '全量扫描：全部在用资产与全仓文件；定稿后可作为增量基线' }
  if (scope === 'incremental') {
    const sha = props.baseCommit?.slice(0, 8) ?? ''
    return {
      label: sha ? `增量 · 对比 ${sha}` : '增量',
      color: 'cyan',
      tip: `增量扫描：只扫基线以来改动的文件及受影响范围；不作为基线、不自动关闭缺陷${props.baseCommit ? `\n基线 commit：${props.baseCommit}` : ''}`,
    }
  }
  if (scope === 'partial') {
    const count = props.ruleCount
    return {
      label: count != null ? `部分 · ${count} 条规则` : '部分',
      color: 'orange',
      tip: '部分扫描：只跑所选规则；不作为基线、不自动关闭缺陷，未选规则的缺陷不受影响',
    }
  }
  return scope ? { label: scope, color: 'gray', tip: `扫描方式：${scope}` } : null
})
</script>

<template>
  <a-tooltip v-if="tag" :content="tag.tip" mini>
    <a-tag :color="tag.color" size="small" class="scan-scope-tag">
      {{ tag.label }}
    </a-tag>
  </a-tooltip>
</template>

<style scoped>
.scan-scope-tag { margin-right: 4px; vertical-align: middle; }
</style>
