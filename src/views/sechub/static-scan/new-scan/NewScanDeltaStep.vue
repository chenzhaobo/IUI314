<script setup lang="ts">
/**
 * 新建扫描第 2 步：冻结计划预览（指标三列网格 + 复用/截断/自动关闭资格提示）。
 * 只在 `step === 1 && deltaPreview` 时由壳渲染，所以这里可以直接读 deltaPreview（仍带可选链兜类型）。
 */
import { useNewScanContext } from './useNewScan'

const ctx = useNewScanContext()
</script>

<template>
  <a-card title="冻结计划预览" size="small" style="margin-bottom: 8px">
    <!-- 指标三列网格：标签 / 取值 / 口径说明（原两列 descriptions 在长值下换行错位） -->
    <div class="delta-preview">
      <div v-for="row in ctx.previewRows" :key="row.key" class="delta-preview-row">
        <span class="delta-preview-label">{{ row.label }}</span>
        <span class="delta-preview-value">{{ row.value }}</span>
        <span class="delta-preview-hint">{{ row.hint || '' }}</span>
      </div>
      <div v-if="ctx.deltaPreview?.estimate_basis.length" class="delta-preview-basis">
        估算口径：{{ ctx.deltaPreview?.estimate_basis.join('；') }}
      </div>
    </div>
    <!-- 复用了同参数的未执行计划：说清楚，并给"按当前代码重新生成"的出口 -->
    <a-alert v-if="ctx.deltaPreview?.reused" type="info" style="margin-top: 8px">
      <div>输入与一条未执行计划完全一致，已复用那条计划（没有新建运行记录）。</div>
      <a-button size="mini" :loading="ctx.previewingDelta" style="margin-top: 6px" @click="ctx.regeneratePreview">
        重新生成计划
      </a-button>
    </a-alert>
    <a-alert v-if="ctx.deltaPreview?.call_graph_truncated" type="warning" style="margin-top: 8px">
      调用图已截断，禁止自动关闭。
    </a-alert>
    <a-alert v-if="ctx.autoCloseAlert" :type="ctx.autoCloseAlert.type" style="margin-top: 8px">
      <div>{{ ctx.autoCloseAlert.title }}</div>
      <div class="delta-preview-basis" style="margin-top: 2px">
        {{ ctx.autoCloseAlert.detail }}
      </div>
    </a-alert>
  </a-card>
</template>

<style scoped>
/* 冻结计划预览：标签 / 取值 / 口径说明三列网格，长值换行也不再串行错位 */
.delta-preview {
  display: flex;
  flex-direction: column;
}

.delta-preview-row {
  display: grid;
  grid-template-columns: 104px minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid var(--color-border-1);
  align-items: baseline;
}

.delta-preview-row:last-child {
  border-bottom: none;
}

.delta-preview-label {
  color: var(--color-text-3);
}

.delta-preview-value {
  font-variant-numeric: tabular-nums;
  word-break: break-word;
}

.delta-preview-hint {
  color: var(--color-text-3);
  font-size: 12px;
}

.delta-preview-basis {
  margin-top: 8px;
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
