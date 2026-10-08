<script setup lang="ts">
/**
 * 统一扫描的扫描方式（契约 D）：全量 / 增量，外加自动选取的基线卡片。
 *
 * 基线 = 该 仓库+分支 最近一次已定稿的全量统一 run（后端 unified-preview 自动给出，没有人工采纳）。
 * 没有可用基线时「增量扫描」置灰，悬浮给出 baseline_unavailable_reason。
 */
import { computed } from 'vue'
import { formatTime } from '@/hooks'
import { shortSha } from './labels'
import { useNewScanContext } from './useNewScan'

const ctx = useNewScanContext()

const incrementalTip = computed(() => ctx.incrementalDisabledReason
  ? `不可选：${ctx.incrementalDisabledReason}`
  : '对比基线 commit 与目标 commit，只扫改动文件及受影响范围；规则目录相对基线新增/变更的规则额外跑全部文件')
const ruleChanges = computed(() => ctx.unifiedPreview?.rule_changes_since_baseline ?? 0)
</script>

<template>
  <a-form-item label="扫描方式">
    <div class="strategy-wrap">
      <a-radio-group v-model="ctx.strategy" type="button">
        <a-tooltip content="扫全部在用资产与全仓文件；完成并定稿后成为后续增量的基线" mini>
          <a-radio value="full">
            全量扫描
          </a-radio>
        </a-tooltip>
        <a-tooltip :content="incrementalTip" mini>
          <a-radio value="incremental" :disabled="Boolean(ctx.incrementalDisabledReason)">
            增量扫描
          </a-radio>
        </a-tooltip>
      </a-radio-group>
      <div class="baseline-card">
        <div class="baseline-title">
          增量基线
          <a-spin v-if="ctx.loadingUnifiedPreview" :size="12" />
        </div>
        <template v-if="ctx.baseline">
          <div class="baseline-grid">
            <span class="baseline-label">基线运行</span>
            <a-tooltip :content="ctx.baseline.run_id" mini>
              <span class="font-mono">{{ ctx.baseline.run_id.slice(0, 8) }}</span>
            </a-tooltip>
            <span class="baseline-label">基线 commit</span>
            <a-tooltip :content="ctx.baseline.commit_sha || '-'" mini>
              <span class="font-mono">{{ shortSha(ctx.baseline.commit_sha) || '-' }}</span>
            </a-tooltip>
            <span class="baseline-label">完成时间</span>
            <span>{{ formatTime(ctx.baseline.finished_at) }}</span>
            <span class="baseline-label">确认问题</span>
            <span>{{ ctx.baseline.confirmed }}</span>
            <span class="baseline-label">缺陷数</span>
            <span>{{ ctx.baseline.issue_count }}</span>
            <span class="baseline-label">基线后规则变更</span>
            <span>
              {{ ruleChanges }} 条
              <span v-if="ruleChanges > 0" class="baseline-meta">（增量时这些规则额外跑全部文件）</span>
            </span>
          </div>
        </template>
        <div v-else-if="!ctx.loadingUnifiedPreview" class="baseline-meta">
          <a-tag color="orange" size="small">
            无可用基线
          </a-tag>
          {{ ctx.incrementalDisabledReason }}
        </div>
      </div>
      <div v-if="ctx.strategy === 'incremental'" class="baseline-meta">
        增量结果：范围内没再检出的缺陷进复核（定位丢失 / 随代码删除），不自动置已修复；范围外缺陷不动；增量运行不作为基线。
      </div>
    </div>
  </a-form-item>
</template>

<style scoped>
.strategy-wrap { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.baseline-card { padding: 8px 12px; border: 1px solid var(--color-border-2); border-radius: 4px; background: var(--color-fill-1); }
.baseline-title { display: flex; gap: 6px; align-items: center; margin-bottom: 6px; font-weight: 500; }
.baseline-grid { display: grid; grid-template-columns: max-content 1fr max-content 1fr; gap: 4px 12px; font-size: 13px; }
.baseline-label { color: var(--color-text-3); }
.baseline-meta { color: var(--color-text-3); font-size: 12px; }
</style>
