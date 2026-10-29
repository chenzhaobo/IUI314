<script setup lang="ts">
/**
 * 缺陷草稿详情抽屉：标题 + Markdown 原文 + 元信息，抽屉内同样可复制标题 / 内容。
 */
import type { ReleaseDefect } from '@/types/sechub-release'
import { MdPreview } from 'md-editor-v3'
import { computed } from 'vue'
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

import 'md-editor-v3/lib/style.css'

const props = defineProps<{ defect: ReleaseDefect | null }>()
const visible = defineModel<boolean>('visible', { default: false })

const title = computed(() => (props.defect ? defectTitleText(props.defect) : ''))
const content = computed(() => (props.defect ? defectContentText(props.defect) : ''))

function copyTitle() {
  void copyDefectText(title.value, '标题')
}

function copyContent() {
  void copyDefectText(content.value, '内容')
}
</script>

<template>
  <a-drawer
    v-model:visible="visible"
    :width="820"
    :footer="false"
    title="缺陷草稿详情"
    unmount-on-close
  >
    <template v-if="defect">
      <div class="title-row">
        <span class="defect-title">{{ defect.title }}</span>
        <a-space>
          <a-button size="mini" @click="copyTitle">
            复制标题
          </a-button>
          <a-button size="mini" type="primary" @click="copyContent">
            复制内容
          </a-button>
        </a-space>
      </div>

      <a-descriptions :column="3" bordered size="small" style="margin-bottom: 12px">
        <a-descriptions-item label="编号">
          {{ defect.defect_code }}
        </a-descriptions-item>
        <a-descriptions-item label="状态">
          <a-tag :color="defectStatusColor(defect.status)" size="small">
            {{ defectStatusLabel(defect.status) }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="级别">
          <a-tag :color="defectPriorityColor(defect.priority)" size="small">
            {{ defectPriorityLabel(defect.priority) }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="项目组">
          {{ defect.project_group_name || '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="应用">
          {{ defect.app_name || '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="来源">
          {{ defectSourceLabel(defect.source) }}
        </a-descriptions-item>
        <a-descriptions-item label="迭代">
          {{ defect.iteration_code || '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="外部编号">
          {{ defect.external_no || '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="发现时间">
          {{ formatTime(defect.discovered_at) }}
        </a-descriptions-item>
      </a-descriptions>

      <MdPreview v-if="content" :model-value="content" />
      <a-empty v-else description="该缺陷没有 Markdown 内容" />
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
