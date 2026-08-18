<script setup lang="ts">
defineOptions({ name: 'ScopePreviewPanel' })

defineProps<{
  preview: any
  completePreflight: any
  loading: boolean
}>()
</script>

<template>
  <div class="scope-preview-panel">
    <a-spin :loading="loading">
      <a-empty v-if="!preview" description="暂无预览数据" />
      <pre v-else style="white-space: pre-wrap; word-break: break-all;">{{ JSON.stringify(preview, null, 2) }}</pre>
    </a-spin>
  </div>
</template>
