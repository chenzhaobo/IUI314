<script setup lang="ts">
/**
 * 统一扫描的自动资产摘要：展示 unified-preview 自动选中的表单/微服务资产数，
 * 阻断原因非空时给出说明（提交按钮由弹窗底部按 unifiedCanSubmit 禁用）。
 */
import { useNewScanContext } from './useNewScan'

const ctx = useNewScanContext()
</script>

<template>
  <a-form-item label="自动选取的资产">
    <div class="unified-summary">
      <a-spin v-if="ctx.loadingUnifiedPreview" :size="14" />
      <template v-else-if="ctx.unifiedPreview">
        <a-tag color="arcoblue" size="small">
          表单资产 {{ ctx.unifiedPreview.form_assets }}
        </a-tag>
        <a-tag color="purple" size="small">
          微服务资产 {{ ctx.unifiedPreview.microservice_assets }}
        </a-tag>
        <span class="unified-meta">全部在用资产 + 全仓文件，一次扫描一个 run</span>
      </template>
      <span v-else class="unified-meta">未取到自动资产摘要（接口失败时不可提交，可稍后重新打开弹窗）</span>
    </div>
    <a-alert v-if="ctx.unifiedBlockedReason" type="warning" style="margin-top: 8px">
      暂不能统一扫描：{{ ctx.unifiedBlockedReason }}
    </a-alert>
  </a-form-item>
</template>

<style scoped>
.unified-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.unified-meta {
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
