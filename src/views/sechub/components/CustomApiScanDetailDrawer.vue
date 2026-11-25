<script setup lang="ts">
import type { CustomApiScanDetailItem } from '@/types/sechub-test-results'
import { MdPreview } from 'md-editor-v3'
import { computed, ref, watch } from 'vue'
import { buildCustomApiReportIndex, reportSectionsForItem } from '../composables/customApiScanReport'

const props = defineProps<{
  item: CustomApiScanDetailItem | null
  report?: string | null
  taskName?: string
}>()
const visible = defineModel<boolean>('visible', { default: false })

const VERDICT_LABELS: Record<string, { text: string, color: string }> = {
  not_found: { text: '未找到API', color: 'gray' },
  excluded: { text: '已排除', color: 'green' },
  confirmed: { text: '确认问题', color: 'red' },
}
const SEVERITY_LABELS: Record<string, string> = { high: '高', medium: '中', low: '低', none: '无' }
const ROLE_LABELS: Record<string, string> = {
  api_plugin: 'API 插件',
  controller: '自定义API类',
  op_plugin: '操作插件',
  service_impl: '服务实现',
}

const detailTab = ref('findings')
const reportIndex = computed(() => buildCustomApiReportIndex(props.report))
const sections = computed(() => props.item ? reportSectionsForItem(reportIndex.value, props.item) : null)

watch(() => props.item?.id, () => {
  detailTab.value = 'findings'
})

function roleText(role: string): string {
  return ROLE_LABELS[role] || role
}
</script>

<template>
  <a-drawer v-model:visible="visible" :width="960" :footer="false" title="自定义 API 扫描详情" unmount-on-close>
    <template v-if="item">
      <a-descriptions :column="2" bordered size="small">
        <a-descriptions-item v-if="taskName" label="扫描任务" :span="2">
          {{ taskName }}
        </a-descriptions-item>
        <a-descriptions-item label="接口" :span="2">
          <a-tag v-if="item.http_method" size="small" color="arcoblue">
            {{ item.http_method }}
          </a-tag>
          <span class="mono">{{ item.call_path }}</span>
        </a-descriptions-item>
        <a-descriptions-item label="应用" :span="2">
          {{ item.app_name || item.app_number || '未归属应用' }}
        </a-descriptions-item>
        <a-descriptions-item label="扫描结论">
          <a-tag v-if="item.verdict" :color="VERDICT_LABELS[item.verdict]?.color || 'gray'">
            {{ VERDICT_LABELS[item.verdict]?.text || item.verdict }}
          </a-tag>
          <span v-else>未判定</span>
        </a-descriptions-item>
        <a-descriptions-item label="风险级别">
          {{ SEVERITY_LABELS[item.severity || ''] || item.severity || '--' }}
        </a-descriptions-item>
      </a-descriptions>

      <div class="section-title">
        扫描问题说明
      </div>
      <div class="summary-text">
        {{ item.ai_summary || item.locate_note || '暂无说明' }}
      </div>

      <a-tabs v-model:active-key="detailTab" class="detail-tabs">
        <a-tab-pane key="findings" title="发现的问题与证据">
          <MdPreview v-if="sections?.findings" :editor-id="`custom-findings-${item.id}`" :model-value="sections.findings" />
          <a-empty v-else description="原报告中没有该接口的问题与证据小节" />
        </a-tab-pane>
        <a-tab-pane key="callChain" title="调用链">
          <MdPreview v-if="sections?.callChain" :editor-id="`custom-call-chain-${item.id}`" :model-value="sections.callChain" />
          <a-empty v-else description="原报告中没有该接口的调用链小节" />
        </a-tab-pane>
        <a-tab-pane key="excluded" title="已排除项">
          <MdPreview v-if="sections?.excluded" :editor-id="`custom-excluded-${item.id}`" :model-value="sections.excluded" />
          <a-empty v-else description="原报告中没有该接口的已排除项小节" />
        </a-tab-pane>
        <a-tab-pane key="fixSuggestions" title="修复建议">
          <MdPreview v-if="sections?.fixSuggestions" :editor-id="`custom-fix-${item.id}`" :model-value="sections.fixSuggestions" />
          <a-empty v-else description="原报告中没有该接口的修复建议小节" />
        </a-tab-pane>
        <a-tab-pane key="locations" :title="`代码定位（${item.impl_json?.length || 0}）`">
          <a-table :data="item.impl_json || []" :pagination="false" size="small">
            <template #columns>
              <a-table-column title="角色" :width="120">
                <template #cell="{ record }">
                  {{ roleText(record.role) }}
                </template>
              </a-table-column>
              <a-table-column title="类 / 方法" :min-width="240">
                <template #cell="{ record }">
                  <div class="mono">
                    {{ record.class_name }}
                  </div>
                  <div class="muted">
                    {{ record.method || record.operation || '--' }}
                  </div>
                </template>
              </a-table-column>
              <a-table-column title="文件" data-index="file" :min-width="260" ellipsis tooltip />
            </template>
            <template #empty>
              <a-empty description="没有定位到实现代码" />
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </template>
  </a-drawer>
</template>

<style scoped>
.mono { word-break: break-all; }
.muted { color: var(--color-text-3); font-size: 12px; }
.section-title { margin: 16px 0 8px; font-weight: 600; }
.summary-text { white-space: pre-wrap; word-break: break-word; line-height: 1.7; }
.detail-tabs { margin-top: 16px; }
</style>
