<script setup lang="ts">
/**
 * 详情抽屉「缺陷内容」Tab：Markdown 预览 + 复制按钮（沿用原抽屉的展示方式）。
 */
import { MdPreview } from 'md-editor-v3'

import { copyDefectText } from '../../../composables/defectClipboard'

import 'md-editor-v3/lib/style.css'

const props = defineProps<{ content: string }>()

function copyContent() {
  void copyDefectText(props.content, '内容')
}
</script>

<template>
  <div class="content-tab">
    <div v-if="content" class="toolbar">
      <a-button size="mini" type="primary" @click="copyContent">
        复制内容
      </a-button>
    </div>
    <MdPreview v-if="content" :model-value="content" />
    <a-empty v-else description="该缺陷没有 Markdown 内容" />
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}
</style>
