<script setup lang="ts">
/** 问题详情 · 开发诊断信息：默认展示最近原始记录，日志优先于 Monitor 执行日志。 */
import type { RawSampleRow } from '../types'
import { Message } from '@arco-design/web-vue'
import { computed, ref, watch } from 'vue'
import { formatTime } from '@/hooks'

const props = defineProps<{
  samples: RawSampleRow[]
  auditTypeLabel: string
}>()

const selectedId = ref('')
const selected = computed(() => props.samples.find(sample => sample.id === selectedId.value) ?? props.samples[0])
const options = computed(() => props.samples.map(sample => ({
  value: sample.id,
  label: `${formatTime(sample.src_created_at)} · ${sample.audit_type} · 实际值 ${sample.act_value ?? '-'}`,
})))

watch(
  () => props.samples,
  (samples) => {
    if (!samples.some(sample => sample.id === selectedId.value))
      selectedId.value = samples[0]?.id ?? ''
  },
  { immediate: true },
)

const prettyLog = computed(() => {
  const text = selected.value?.audit_log
  if (!text)
    return '-'
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  }
  catch {
    return text
  }
})

async function copy(value: string | null | undefined, label: string) {
  if (!value)
    return
  try {
    await navigator.clipboard.writeText(value)
    Message.success(`${label}已复制`)
  }
  catch {
    Message.error('复制失败，请手动选择文本')
  }
}
</script>

<template>
  <section class="diagnosis">
    <div class="section-head">
      <span class="section-title">问题诊断</span>
      <a-select
        v-if="samples.length > 1"
        v-model="selectedId"
        :options="options"
        class="raw-select"
        size="small"
      />
    </div>

    <a-empty v-if="!selected" description="暂无原始记录" />
    <template v-else>
      <a-descriptions :column="3" size="small" bordered>
        <a-descriptions-item label="审计类型">
          {{ auditTypeLabel }}（{{ selected.audit_type }}）
        </a-descriptions-item>
        <a-descriptions-item label="领域">
          {{ selected.domain || '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="创建日期">
          {{ formatTime(selected.src_created_at) }}
        </a-descriptions-item>
        <a-descriptions-item label="实际值 / 阈值">
          <strong>{{ selected.act_value ?? '-' }}</strong> / {{ selected.threshold ?? '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="创建人">
          {{ selected.src_creator || '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="单据编号">
          {{ selected.src_number || '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="同步源 / 轮次">
          {{ selected.source_name }} / {{ selected.round_no }}
        </a-descriptions-item>
        <a-descriptions-item label="traceId" :span="2">
          <span class="mono">{{ selected.trace_id || '-' }}</span>
          <a-button v-if="selected.trace_id" type="text" size="mini" @click="copy(selected.trace_id, 'traceId')">
            复制
          </a-button>
        </a-descriptions-item>
        <a-descriptions-item label="唯一标记">
          <span class="mono">{{ selected.src_identity || '-' }}</span>
          <a-button v-if="selected.src_identity" type="text" size="mini" @click="copy(selected.src_identity, '唯一标记')">
            复制
          </a-button>
        </a-descriptions-item>
        <a-descriptions-item label="调用类" :span="3">
          <span class="mono">{{ selected.invoke_class || '-' }}</span>
        </a-descriptions-item>
      </a-descriptions>

      <div class="code-block">
        <div class="code-head">
          <span>调用参数</span>
          <a-button v-if="selected.invoke_param" type="text" size="mini" @click="copy(selected.invoke_param, '调用参数')">
            复制
          </a-button>
        </div>
        <pre class="code">{{ selected.invoke_param || '-' }}</pre>
      </div>

      <div class="code-block">
        <div class="code-head">
          <span>原始日志</span>
          <a-button v-if="selected.audit_log" type="text" size="mini" @click="copy(selected.audit_log, '原始日志')">
            复制
          </a-button>
        </div>
        <pre class="code log">{{ prettyLog }}</pre>
      </div>
    </template>
  </section>
</template>

<style scoped>
.diagnosis { margin-top: 12px; }
.section-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.section-title { flex-shrink: 0; font-weight: 600; white-space: nowrap; }
.raw-select { width: min(420px, 70%); }
.mono { font-family: var(--font-family-mono, monospace); font-size: 12px; word-break: break-all; }
.code-block { margin-top: 10px; }
.code-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; color: var(--color-text-2); font-size: 12px; font-weight: 600; }
.code {
  max-height: 320px;
  margin: 0;
  padding: 10px;
  overflow: auto;
  font-family: var(--font-family-mono, monospace);
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  background: var(--color-fill-2);
  border-radius: 4px;
}
.log { max-height: 420px; }
</style>
