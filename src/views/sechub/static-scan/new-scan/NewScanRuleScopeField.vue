<script setup lang="ts">
/**
 * 规则范围（契约 C）：全部规则 / 自选。自选 = 部分扫描：
 * 树（域 → 分类 → 扫描点 → 规则）可在扫描点与规则两级勾选，带计数与搜索；
 * 整选的扫描点提交 scan_point_ids，零散规则提交 rule_version_ids。
 */
import type { TreeNodeData } from '@arco-design/web-vue'
import { useNewScanContext } from './useNewScan'

const ctx = useNewScanContext()

/** 节点右侧计数（RuleScopeNode.hint；a-tree 插槽只给 TreeNodeData，按字段收窄取值） */
function hintOf(node: TreeNodeData): string {
  return 'hint' in node && typeof node.hint === 'string' ? node.hint : ''
}

function onCheck(_keys: (string | number)[], event: { checked?: boolean, node?: TreeNodeData }) {
  const key = event.node?.key
  if (key !== undefined)
    ctx.onRuleCheck(key, Boolean(event.checked))
}
</script>

<template>
  <a-form-item label="规则范围">
    <div class="scope-wrap">
      <a-radio-group :model-value="ctx.ruleScopeMode" type="button" @change="ctx.onRuleScopeModeChange">
        <a-radio value="all">
          全部规则
        </a-radio>
        <a-radio value="custom">
          自选
        </a-radio>
      </a-radio-group>
      <template v-if="ctx.isPartialScope">
        <a-alert type="warning">
          部分扫描只跑所选规则：不作为增量基线、不自动关闭缺陷，覆盖报告标注「部分扫描」；未选规则的缺陷完全不受影响。
        </a-alert>
        <div class="scope-toolbar">
          <a-input-search v-model="ctx.ruleKeyword" placeholder="搜索分类 / 扫描点 / 规则" allow-clear size="small" style="flex: 1" />
          <span class="scope-count">已选 {{ ctx.selectedRuleCount }} / {{ ctx.ruleIndex.totalRules }} 条规则</span>
          <a-button size="mini" :disabled="ctx.selectedRuleCount === 0" @click="ctx.clearRuleSelection">
            清空
          </a-button>
        </div>
        <a-spin :loading="ctx.loadingRuleTree" class="scope-tree">
          <a-tree
            v-if="ctx.ruleTreeNodes.length"
            v-model:expanded-keys="ctx.ruleExpandedKeys"
            :data="ctx.ruleTreeNodes"
            checkable
            check-strictly
            :selectable="false"
            :checked-keys="ctx.ruleTreeKeys.checked"
            :half-checked-keys="ctx.ruleTreeKeys.half"
            size="small"
            block-node
            @check="onCheck"
          >
            <template #extra="node">
              <span class="scope-hint">{{ hintOf(node) }}</span>
            </template>
          </a-tree>
          <a-empty v-else-if="!ctx.loadingRuleTree" :description="ctx.ruleKeyword ? '没有匹配的规则' : '该目录没有可选规则'" />
        </a-spin>
      </template>
    </div>
  </a-form-item>
</template>

<style scoped>
.scope-wrap { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.scope-toolbar { display: flex; gap: 8px; align-items: center; }
.scope-count { flex-shrink: 0; color: var(--color-text-2); font-size: 12px; }
.scope-tree { display: block; max-height: 320px; overflow-x: hidden; overflow-y: auto; padding: 4px 8px; border: 1px solid var(--color-border-2); border-radius: 4px; }
.scope-hint { margin-right: 8px; color: var(--color-text-3); font-size: 12px; }
</style>
