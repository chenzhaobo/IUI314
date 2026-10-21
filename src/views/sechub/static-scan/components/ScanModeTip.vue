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
        <div>· <b>默认勾选「表单资产 + 微服务资产」+「完整基线」</b>：按统一扫描自动选全部在用资产并全量执行，和页面「新建扫描」口径一致。</div>
        <div>· <b>扫描前自动刷新资产</b>：先索引该仓库源码，再同步表单匹配 / 微服务发现；任一步失败则该仓库预扫描失败，不会拿旧资产结果继续扫。</div>
        <div>· <b>第一次扫某个仓库/分支</b>：选「完整基线」—— 全量扫描，建立可比对的起点。</div>
        <div>· <b>日常重扫</b>：已有全量基线后可改选「自动增量」，服务端按代码 / 规则变更自动决定扫描范围，最省时间和 AI 调用。</div>
        <div>· <b>资产类型全部不勾选</b>：只跑仓库通用规则，不同步资产、不跑表单/微服务领域证据检测，候选数会明显更少。</div>
        <div>· <b>自动增量报「找不到可信的差量基线」</b>：该仓库/分支还没有差量基线 —— 先跑一次「完整基线」（跑完且 AI 确认/写回完成后平台会自动登记为基线）。</div>
        <div>· <b>高级：新增行快速检查</b>：只查本次新增/变更的行，且固定不关闭历史问题，用于快速校验新代码。</div>
        <div>· <b>仅规则差量 / 代码+规则混合差量 / 仅重新 AI 确认</b> 在定时任务里没有独立入口：规则变更会由「自动增量」自动纳入；只想按最新模型重跑确认，请到「扫描运行」页使用 AI 确认。</div>
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
