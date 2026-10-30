<script setup lang="ts">
/**
 * 缺陷草稿详情抽屉：缺陷内容 / 请求与响应 / 自测脚本三个 Tab。
 *
 * 列表行先展示；打开后按 id 拉详情，补齐实际请求证据、完整地址与 curl。
 */
import type { ReleaseDefect } from '@/types/sechub-release'
import { computed, watch } from 'vue'
import { formatTime } from '@/hooks'

import { copyDefectText } from '../../../composables/defectClipboard'
import {
  defectContentText,
  defectPriorityColor,
  defectPriorityLabel,
  defectSourceLabel,
  defectStatusColor,
  defectStatusLabel,
  defectTitleText,
} from '../../../composables/defectDraftRules'
import { evidenceUrl } from '../../../composables/defectEvidenceRules'
import { useDefectDetail } from '../../../composables/useDefectDetail'

import DefectContentTab from './DefectContentTab.vue'
import DefectRequestTab from './DefectRequestTab.vue'
import DefectVerifyScriptTab from './DefectVerifyScriptTab.vue'

const props = defineProps<{
  defect: ReleaseDefect | null
  scriptDownloading?: boolean
}>()
const emit = defineEmits<{ (e: 'downloadScript'): void }>()
const visible = defineModel<boolean>('visible', { default: false })

const { loading, detail, load, reset } = useDefectDetail()

const current = computed<ReleaseDefect | null>(() => detail.value ?? props.defect)
const title = computed(() => (current.value ? defectTitleText(current.value) : ''))
const content = computed(() => (current.value ? defectContentText(current.value) : ''))
const request = computed(() => detail.value?.request ?? null)
const fullUrl = computed(() => evidenceUrl(detail.value))
const curl = computed(() => detail.value?.curl ?? '')

watch(
  () => [visible.value, props.defect?.id] as const,
  ([open, id]) => {
    if (open && id)
      void load(id)
    else
      reset()
  },
)

function copyTitle() {
  void copyDefectText(title.value, '标题')
}
</script>

<template>
  <a-drawer
    v-model:visible="visible"
    :width="900"
    :footer="false"
    title="缺陷草稿详情"
    unmount-on-close
  >
    <template v-if="current">
      <div class="title-row">
        <span class="defect-title">{{ current.title }}</span>
        <a-button size="mini" @click="copyTitle">
          复制标题
        </a-button>
      </div>

      <a-descriptions :column="3" bordered size="small" style="margin-bottom: 12px">
        <a-descriptions-item label="编号">
          {{ current.defect_code }}
        </a-descriptions-item>
        <a-descriptions-item label="状态">
          <a-tag :color="defectStatusColor(current.status)" size="small">
            {{ defectStatusLabel(current.status) }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="级别">
          <a-tag :color="defectPriorityColor(current.priority)" size="small">
            {{ defectPriorityLabel(current.priority) }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="项目组">
          {{ current.project_group_name || '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="应用">
          {{ current.app_name || '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="来源">
          {{ defectSourceLabel(current.source) }}
        </a-descriptions-item>
        <a-descriptions-item label="迭代">
          {{ current.iteration_code || '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="外部编号">
          {{ current.external_no || '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="发现时间">
          {{ formatTime(current.discovered_at) }}
        </a-descriptions-item>
      </a-descriptions>

      <a-spin :loading="loading" style="width: 100%">
        <a-tabs default-active-key="content">
          <a-tab-pane key="content" title="缺陷内容">
            <DefectContentTab :content="content" />
          </a-tab-pane>
          <a-tab-pane key="request" title="请求与响应">
            <DefectRequestTab :request="request" :url="fullUrl" :curl="curl" />
          </a-tab-pane>
          <a-tab-pane key="script" title="自测脚本">
            <DefectVerifyScriptTab
              :defect-code="current.defect_code"
              :downloading="Boolean(scriptDownloading)"
              @download="emit('downloadScript')"
            />
          </a-tab-pane>
        </a-tabs>
      </a-spin>
    </template>
  </a-drawer>
</template>

<style scoped>
.title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.defect-title {
  color: var(--color-text-1);
  font-size: 15px;
  font-weight: 600;
  word-break: break-word;
}
</style>
