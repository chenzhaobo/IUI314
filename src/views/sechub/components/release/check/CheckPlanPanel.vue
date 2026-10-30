<script setup lang="ts">
/**
 * 发版检查：本次检查计划（范围 / 会执行 / 本次不执行 / 耗时 / 提示）。
 *
 * 文案与测试项全部来自 `GET /sechub/release/check/plan`，组件不另写清单；
 * 执行按钮的确认框由页面负责。
 */
import type { ReleaseCheckPlanResponse, ReleaseCheckPlanRule } from '@/types/sechub-release'
import { computed } from 'vue'
import { formatTime } from '@/hooks'

import {
  durationText,
  estimateText,
  excludedPlanItems,
  includedPlanItems,
  planItemDetail,
  planRangeParts,
  ruleMap,
  ruleTip,
} from '../../../composables/releaseCheckPlanRules'
import { runStatusMeta } from '../../../composables/releaseDashboardRules'

const props = defineProps<{
  plan: ReleaseCheckPlanResponse | null
  loading: boolean
  checking: boolean
  running: boolean
}>()

const emit = defineEmits<{
  (e: 'execute'): void
}>()

const rangeParts = computed(() => (props.plan ? planRangeParts(props.plan) : []))
const included = computed(() => (props.plan ? includedPlanItems(props.plan) : []))
const excluded = computed(() => (props.plan ? excludedPlanItems(props.plan) : []))
const ruleIndex = computed<Record<string, ReleaseCheckPlanRule>>(() => ruleMap(props.plan?.rules ?? []))
const estimate = computed(() => estimateText(props.plan?.estimate_minutes))
const canExecute = computed(() => Boolean(props.plan) && !props.plan?.env_error && !props.running && !props.checking)
const footerHint = computed(() => {
  if (props.plan?.env_error)
    return '缺少测试环境，无法执行'
  if (props.running)
    return '已有发版检查运行中，结束后可再次执行'
  if (!props.plan)
    return '计划加载完成后可执行'
  return '执行前会再次确认本次执行项'
})
</script>

<template>
  <div class="plan-panel" :class="{ 'plan-panel--error': plan?.env_error }">
    <div class="plan-head">
      <div>
        <div class="section-title">
          本次检查计划
        </div>
        <span class="hint">一键检查 = 下方「会执行」项 + 后台清单配置规则。</span>
      </div>
      <a-spin v-if="loading && !plan" :size="20" />
    </div>

    <a-alert
      v-if="plan?.env_error"
      :content="plan.env_error"
      show-icon
      type="warning"
    />

    <template v-if="plan">
      <div class="plan-range">
        <div
          v-for="part in rangeParts"
          :key="part.label"
          class="range-item"
        >
          <span class="range-label">{{ part.label }}</span>
          <span class="range-value">{{ part.value }}</span>
        </div>
      </div>

      <div class="plan-section">
        <div class="section-title">
          会执行（{{ included.length }} 项）
        </div>
        <div
          v-for="item in included"
          :key="item.code"
          class="plan-item"
        >
          <div class="item-head">
            <a-tag color="blue" size="small">
              {{ item.code }}
            </a-tag>
            <span class="item-name">{{ item.name }}</span>
            <span class="item-detail">{{ planItemDetail(item) }}</span>
          </div>
          <div class="item-desc">
            {{ item.description }}
          </div>
          <div v-if="item.verdicts" class="item-sub">
            判定口径：{{ item.verdicts }}
          </div>
          <a-space
            v-if="item.rules?.length"
            :size="4"
            class="item-rules"
            wrap
          >
            <a-tooltip
              v-for="code in item.rules"
              :key="code"
              :content="ruleTip(ruleIndex[code])"
            >
              <a-tag color="arcoblue" size="small">
                {{ code }}
              </a-tag>
            </a-tooltip>
          </a-space>
        </div>
      </div>

      <div class="plan-section">
        <div class="section-title muted">
          本次不执行（{{ excluded.length }} 项）
        </div>
        <div
          v-for="item in excluded"
          :key="item.code"
          class="plan-item excluded"
        >
          <div class="item-head">
            <a-tag size="small">
              {{ item.code }}
            </a-tag>
            <span class="item-name">{{ item.name }}</span>
            <span class="item-detail">{{ item.reason }}</span>
          </div>
        </div>
      </div>

      <div class="plan-meta">
        <span>预计耗时：<strong>{{ estimate }}</strong></span>
        <span v-if="plan.last_run">
          上次执行：
          <a-tag :color="runStatusMeta(plan.last_run.status).color" size="small">
            {{ runStatusMeta(plan.last_run.status).label }}
          </a-tag>
          {{ formatTime(plan.last_run.started_at) }} · {{ durationText(plan.last_run.duration_ms) }}
        </span>
        <span v-else>上次执行：暂无</span>
      </div>

      <a-alert
        v-for="(note, index) in plan.notes"
        :key="index"
        :content="note"
        class="plan-note"
        type="info"
      />
    </template>

    <a-empty
      v-else-if="!loading"
      description="暂无检查计划"
    />

    <div class="plan-footer">
      <span class="hint">{{ footerHint }}</span>
      <a-button
        :disabled="!canExecute"
        :loading="checking"
        type="primary"
        @click="emit('execute')"
      >
        {{ running ? '检查执行中…' : '立即执行发版检查' }}
      </a-button>
    </div>
  </div>
</template>

<style scoped>
.plan-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.plan-panel--error {
  padding: 12px;
  background: var(--color-warning-light-1);
  border-radius: 4px;
}
.plan-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.section-title {
  color: var(--color-text-1);
  font-size: 14px;
  font-weight: 600;
}
.plan-head .section-title {
  margin-bottom: 4px;
}
.section-title.muted {
  color: var(--color-text-2);
}
.plan-range {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  padding: 8px 12px;
  background: var(--color-fill-1);
  border-radius: 4px;
}
.range-label {
  margin-right: 6px;
  color: var(--color-text-3);
}
.range-value {
  color: var(--color-text-1);
}
.plan-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.plan-item {
  padding: 8px 12px;
  border: 1px solid var(--color-border-2);
  border-radius: 4px;
}
.plan-item.excluded {
  color: var(--color-text-3);
  background: var(--color-fill-1);
}
.item-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.item-name {
  font-weight: 500;
}
.item-detail {
  color: var(--color-text-2);
  font-size: 12px;
}
.item-desc {
  margin-top: 4px;
  color: var(--color-text-2);
  font-size: 12px;
}
.item-sub {
  margin-top: 2px;
  color: var(--color-text-3);
  font-size: 12px;
}
.item-rules {
  margin-top: 6px;
}
.plan-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 24px;
  color: var(--color-text-2);
  font-size: 12px;
}
.plan-note {
  padding: 4px 8px;
}
.plan-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 8px;
  border-top: 1px solid var(--color-border-2);
}
.hint {
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
