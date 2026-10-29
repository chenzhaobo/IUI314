<script setup lang="ts">
/** 发版报告预览抽屉：快照元信息 + Markdown 报告原文。 */
import type { ReleaseSnapshotDetail } from '@/types/sechub-release'
import { MdPreview } from 'md-editor-v3'
import { formatTime } from '@/hooks'

import { conclusionMeta } from '../../../composables/releaseDashboardRules'

import 'md-editor-v3/lib/style.css'

defineProps<{
  loading: boolean
  detail: ReleaseSnapshotDetail | null
}>()

const visible = defineModel<boolean>('visible', { default: false })

function finalText(isFinal: string): string {
  return isFinal === '1' ? '已定稿' : '未定稿'
}
</script>

<template>
  <a-drawer
    v-model:visible="visible"
    :footer="false"
    :width="900"
    title="发版报告"
    unmount-on-close
  >
    <a-spin :loading="loading" style="width: 100%">
      <template v-if="detail">
        <a-descriptions
          :column="{ xs: 1, md: 2, xl: 3 }"
          bordered
          size="small"
          style="margin-bottom: 12px"
        >
          <a-descriptions-item label="迭代">
            {{ detail.iteration_name || detail.iteration_id }}
          </a-descriptions-item>
          <a-descriptions-item label="结论">
            <a-tag :color="conclusionMeta(detail.conclusion).color" size="small">
              {{ conclusionMeta(detail.conclusion).label }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="定稿">
            {{ finalText(detail.is_final) }}
          </a-descriptions-item>
          <a-descriptions-item label="产品线">
            {{ detail.product_line }}
          </a-descriptions-item>
          <a-descriptions-item label="生成人">
            {{ detail.generated_by || '-' }}
          </a-descriptions-item>
          <a-descriptions-item label="生成时间">
            {{ formatTime(detail.created_at) }}
          </a-descriptions-item>
        </a-descriptions>
        <MdPreview v-if="detail.report_md" :model-value="detail.report_md" />
        <a-empty v-else description="该快照没有报告内容" />
      </template>
      <a-empty v-else-if="!loading" description="未获取到报告" />
    </a-spin>
  </a-drawer>
</template>
