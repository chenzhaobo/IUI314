<script setup lang="ts">
/**
 * 详情抽屉「请求与响应」Tab：请求行 / 角色 / 请求头 / 请求体 / curl / 状态码 / 耗时 / 响应体。
 *
 * `from_evidence=false` 时顶部提示「以下为用例定义」；没有 request 时显示空状态。
 * 请求 / 响应内容均来自后端已脱敏证据，页面不再二次处理。
 */
import type { ReleaseRequestEvidence } from '@/types/sechub-release'
import { computed } from 'vue'

import { copyDefectText } from '../../../composables/defectClipboard'
import { hasActualEvidence, requestLine } from '../../../composables/defectEvidenceRules'

const props = defineProps<{
  request: ReleaseRequestEvidence | null
  url: string
  curl: string
}>()

interface HeaderRow {
  name: string
  value: string
}

const line = computed(() => requestLine(props.request, props.url))
const fromEvidence = computed(() => hasActualEvidence(props.request))
const headerRows = computed<HeaderRow[]>(
  () => (props.request?.headers ?? []).map(([name, value]) => ({ name, value })),
)
const statusText = computed(() => {
  const status = props.request?.http_status
  return status === null || status === undefined ? '未记录' : String(status)
})
const elapsedText = computed(() => {
  const elapsed = props.request?.elapsed_ms
  return elapsed === null || elapsed === undefined ? '-' : `${elapsed} ms`
})
const bodyText = computed(() => props.request?.body || '（无请求体）')
const responseText = computed(() => props.request?.response || '（无响应内容）')
const curlText = computed(() => props.curl || '（无 curl）')

function copy(text: string, label: string) {
  void copyDefectText(text, label)
}
</script>

<template>
  <a-empty v-if="!request" description="该缺陷没有请求与响应记录" />
  <div v-else class="request-tab">
    <a-alert
      v-if="!fromEvidence"
      type="warning"
      show-icon
      style="margin-bottom: 12px"
    >
      未取到实际请求记录，以下为用例定义
    </a-alert>

    <a-descriptions :column="2" bordered size="small" style="margin-bottom: 12px">
      <a-descriptions-item label="请求" :span="2">
        <div class="line-with-action">
          <code class="request-line">{{ line }}</code>
          <a-link @click="copy(line, '请求行')">
            复制
          </a-link>
        </div>
      </a-descriptions-item>
      <a-descriptions-item label="角色">
        {{ request.role || '-' }}
      </a-descriptions-item>
      <a-descriptions-item label="状态码">
        {{ statusText }}
      </a-descriptions-item>
      <a-descriptions-item label="耗时">
        {{ elapsedText }}
      </a-descriptions-item>
    </a-descriptions>

    <section class="block">
      <div class="block-head">
        <span class="block-title">请求头</span>
      </div>
      <a-table
        v-if="headerRows.length"
        :data="headerRows"
        :pagination="false"
        :bordered="{ cell: true }"
        size="small"
      >
        <template #columns>
          <a-table-column title="名称" data-index="name" :width="220" />
          <a-table-column title="值" data-index="value" />
        </template>
      </a-table>
      <a-empty v-else description="无请求头记录" />
    </section>

    <section class="block">
      <div class="block-head">
        <span class="block-title">请求体</span>
        <a-link @click="copy(bodyText, '请求体')">
          复制
        </a-link>
      </div>
      <pre class="code-block">{{ bodyText }}</pre>
    </section>

    <section class="block">
      <div class="block-head">
        <span class="block-title">curl</span>
        <a-link @click="copy(curlText, 'curl')">
          复制
        </a-link>
      </div>
      <pre class="code-block">{{ curlText }}</pre>
    </section>

    <section class="block">
      <div class="block-head">
        <span class="block-title">响应体</span>
        <a-link @click="copy(responseText, '响应体')">
          复制
        </a-link>
      </div>
      <pre class="code-block">{{ responseText }}</pre>
    </section>
  </div>
</template>

<style scoped>
.line-with-action {
  display: flex;
  align-items: center;
  gap: 8px;
}
.request-line {
  word-break: break-all;
}
.block {
  margin-bottom: 16px;
}
.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.block-title {
  color: var(--color-text-1);
  font-size: 13px;
  font-weight: 600;
}
.code-block {
  margin: 0;
  padding: 10px 12px;
  overflow: auto;
  color: var(--color-text-1);
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  background: var(--color-fill-2);
  border-radius: 4px;
}
</style>
