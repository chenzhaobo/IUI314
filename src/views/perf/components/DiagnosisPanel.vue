<script lang="ts" setup>
/**
 * 资源四步诊断卡片（101i）：四步按固定顺序展示结论与证据，命中可转缺陷，顶部可发起 AI 解读。
 *
 * 挂在 run（报告页资源数据 → 诊断）与 task（批次观测 → 诊断）两处，
 * scope / scopeId 由宿主传入，组件自身不感知页面上下文。
 * 数字由平台计算，AI 只做解读（spec R14）。
 */
import { computed } from 'vue'
import { evidenceText, verdictColor, verdictText } from './diagnosis/types'
import { useDiagnosisPanel } from './diagnosis/useDiagnosisPanel'

defineOptions({ name: 'DiagnosisPanel' })

const props = defineProps<{
  /** run | task */
  scope: string
  scopeId: string
}>()

const {
  loading,
  steps,
  hasDiagnosis,
  aiReportId,
  aiRunning,
  convertingStep,
  toIssue,
  runAi,
  reload,
} = useDiagnosisPanel(props.scope, computed(() => props.scopeId))

const emptyText = computed(() => props.scopeId
  ? '暂无诊断结果（指标回填完成后平台自动执行四步诊断）'
  : '请先选择范围（先在「报告列表」点击查看明细，再回到本页签）')
</script>

<template>
  <div class="dp-wrap">
    <a-card :bordered="false" size="small" class="m-b-8px">
      <a-space wrap>
        <a-tooltip :content="hasDiagnosis ? '基于已落库的诊断与证据生成分析报告（需数分钟）' : '暂无诊断结果，AI 解读不可用'">
          <a-button type="primary" size="small" :loading="aiRunning" :disabled="!hasDiagnosis" @click="runAi">
            AI 解读
          </a-button>
        </a-tooltip>
        <a-button size="small" :loading="loading" @click="reload">
          刷新
        </a-button>
        <span class="dp-hint">顺序固定：容器重启 → CPU 限流 → 中间件与主机 → 应用侧。</span>
      </a-space>
      <a-alert v-if="aiReportId" type="success" class="m-t-8px">
        已生成分析报告（{{ aiReportId }}），可在分析报告中查看完整解读。
      </a-alert>
    </a-card>

    <a-spin :loading="loading" class="dp-body">
      <a-empty v-if="!loading && !hasDiagnosis" :description="emptyText" />
      <div v-else>
        <a-card v-for="(s, i) in steps" :key="s.step" :bordered="false" size="small" class="m-b-8px">
          <div class="dp-head">
            <span class="dp-step">第 {{ i + 1 }} 步 · {{ s.name }}</span>
            <a-tag :color="verdictColor(s.verdict)" size="small">
              {{ verdictText(s.verdict) }}
            </a-tag>
            <a-tag v-if="s.issueId" color="arcoblue" size="small">
              已转缺陷 {{ s.issueId }}
            </a-tag>
            <span class="dp-spacer" />
            <a-button
              v-if="s.verdict === 'hit' && !s.issueId"
              type="primary"
              size="mini"
              :loading="convertingStep === s.step"
              @click="toIssue(s)"
            >
              转缺陷
            </a-button>
          </div>
          <div class="dp-summary">
            {{ s.summary }}
          </div>
          <a-collapse v-if="s.diagnosisId" class="dp-evidence" :bordered="false">
            <a-collapse-item key="evidence" header="证据 JSON">
              <pre class="dp-json">{{ evidenceText(s.evidence) }}</pre>
            </a-collapse-item>
          </a-collapse>
        </a-card>
      </div>
    </a-spin>
  </div>
</template>

<style scoped>
.dp-wrap {
  display: block;
  width: 100%;
}

.dp-hint {
  color: var(--color-text-3);
  font-size: 12px;
}

.dp-body {
  display: block;
  width: 100%;
}

.dp-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dp-step {
  font-weight: 600;
}

.dp-spacer {
  flex: 1;
}

.dp-summary {
  margin-top: 8px;
  color: var(--color-text-1);
}

.dp-evidence {
  margin-top: 8px;
}

.dp-json {
  margin: 0;
  max-height: 320px;
  overflow: auto;
  padding: 8px;
  background: var(--color-fill-1);
  font-size: 12px;
  word-break: break-all;
  white-space: pre-wrap;
}
</style>
