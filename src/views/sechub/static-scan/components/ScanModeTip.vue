<script setup lang="ts">
/**
 * 「扫描策略」旁的问号提示：说明各差量策略怎么选（扫描任务页的表单在用）。
 */
</script>

<template>
  <a-tooltip position="tl">
    <icon-question-circle class="scan-mode-tip-icon" />
    <template #content>
      <div class="scan-mode-tip">
        <div class="scan-mode-tip-title">
          扫描策略怎么选
        </div>
        <div>· <b>第一次扫某个仓库/分支</b>：选「完整基线」—— 全量扫描，建立可比对的起点。</div>
        <div>· <b>日常重扫</b>：选「推荐：自动增量」，服务端按代码变更 / 规则变更自动决定扫描范围，最省时间和 AI 调用。</div>
        <div>· <b>自动增量报「找不到可信的差量基线」</b>：该仓库/分支还没有差量基线 —— 先跑一次「完整基线」（跑完且 AI 确认/写回完成后平台会自动登记为基线）；也可以把「差量基准」改成「指定基准 commit」立即走增量。</div>
        <div>· <b>只更新了规则</b>（规则目录升级、改了规则知识）：选「仅规则差量」，按受影响范围重扫，不必全量。</div>
        <div>· <b>代码和规则都变了</b>：可选「代码 + 规则混合差量」；不确定就交回「自动增量」由服务端判定。</div>
        <div>· <b>只想按最新模型/提示词重跑 AI 确认</b>（不重新扫代码）：选「仅重新 AI 确认」。</div>
        <div>· <b>高级：新增行快速检查</b>：只查本次新增/变更的行，且固定不关闭历史问题，用于快速校验新代码。</div>
        <div class="scan-mode-tip-note">
          差量扫描只覆盖变更范围，未覆盖范围的历史问题原样保留（不会自动关闭）；需要全量收口时跑「完整基线」。
        </div>
      </div>
    </template>
  </a-tooltip>
</template>

<style scoped>
.scan-mode-tip-icon { margin-left: 4px; color: var(--color-text-3); cursor: help; }
.scan-mode-tip { max-width: 420px; line-height: 1.7; white-space: normal; }
.scan-mode-tip-title { margin-bottom: 4px; font-weight: 600; }
.scan-mode-tip-note { margin-top: 6px; color: var(--color-text-3); }
</style>
