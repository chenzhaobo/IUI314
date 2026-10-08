<script setup lang="ts">
/**
 * 规则目录下拉（契约 E）：`名称 · 安全+性能 · N 条规则`，默认目录带「默认」标签；
 * 不能用于扫描（runnable=false）的目录置灰并在悬浮里给出原因。留空 = 默认目录（名称取后端）。
 */
import { ruleSetBlockersText, ruleSetLabel, ruleSetSelectable } from './labels'
import { useNewScanContext } from './useNewScan'

const ctx = useNewScanContext()
</script>

<template>
  <a-form-item label="规则目录">
    <a-select
      v-model="ctx.ruleSetId"
      allow-clear
      :placeholder="ctx.ruleSetPlaceholder"
      style="width: 100%"
      @change="ctx.onRuleSetChange"
    >
      <a-option v-for="item in ctx.ruleSets" :key="item.id" :value="item.id" :label="ruleSetLabel(item)" :disabled="!ruleSetSelectable(item)">
        <a-tooltip v-if="!ruleSetSelectable(item)" :content="ruleSetBlockersText(item)" position="left" mini>
          <span class="rule-set-option">{{ ruleSetLabel(item) }}</span>
        </a-tooltip>
        <span v-else class="rule-set-option">{{ ruleSetLabel(item) }}</span>
        <a-tag v-if="item.is_default" color="arcoblue" size="small" class="rule-set-default">
          默认
        </a-tag>
      </a-option>
    </a-select>
    <div class="text-xs text-gray" style="margin-top: 4px">
      留空即用平台默认目录{{ ctx.defaultRuleSetName ? `「${ctx.defaultRuleSetName}」` : '' }}；只有明确要单独扫某个域时才指定其他目录。
    </div>
  </a-form-item>
</template>

<style scoped>
.rule-set-option { margin-right: 6px; }
.rule-set-default { vertical-align: middle; }
</style>
