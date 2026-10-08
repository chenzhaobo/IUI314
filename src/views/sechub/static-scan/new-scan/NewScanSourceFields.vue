<script setup lang="ts">
/**
 * 统一扫描的代码来源：分支（默认仓库主分支）+ 目标 commit（可选，留空 = 分支最新）。
 * 换分支会联动重查 commit 列表与增量基线（基线按 仓库+分支 取）。
 */
import { computed } from 'vue'
import { formatCommitLabel, shortSha } from './labels'
import { useNewScanContext } from './useNewScan'

const ctx = useNewScanContext()

/** 留空时的提示：带上预览返回的分支最新 commit，用户知道「留空」实际扫哪一版 */
const commitPlaceholder = computed(() => {
  const latest = shortSha(ctx.unifiedPreview?.target_commit)
  return latest ? `留空 = 分支最新（${latest}）` : '留空 = 分支最新提交'
})
</script>

<template>
  <div class="source-fields">
    <a-form-item label="分支" class="source-field">
      <a-space style="width: 100%">
        <a-select
          v-model="ctx.branch"
          :loading="ctx.loadingBranches"
          placeholder="选择要扫描的分支"
          allow-search
          style="flex: 1; min-width: 0"
          @change="ctx.onBranchChange"
        >
          <a-option v-for="br in ctx.branches" :key="br.name" :value="br.name">
            {{ br.name }}{{ br.is_default ? '（默认）' : '' }}
          </a-option>
        </a-select>
        <!-- 显式刷新分支：仅点此按钮才触发 git fetch（慢），打开弹窗默认用缓存 -->
        <a-button size="small" :loading="ctx.refreshingBranches" title="刷新分支（会执行 git fetch，较慢）" @click="ctx.refreshBranches">
          <template #icon>
            <icon-refresh />
          </template>
        </a-button>
      </a-space>
    </a-form-item>
    <a-form-item label="目标 commit（可选）" class="source-field">
      <!-- 支持搜索 + 手工输入不在列表中的 sha（提交时校验 7~40 位 hex）；清空 = 分支最新 -->
      <a-select
        v-model="ctx.commit"
        :loading="ctx.loadingCommits"
        :placeholder="commitPlaceholder"
        allow-search
        allow-create
        allow-clear
        style="width: 100%"
      >
        <a-option v-for="c in ctx.commits" :key="c.sha" :value="c.sha">
          {{ formatCommitLabel(c) }}
        </a-option>
      </a-select>
    </a-form-item>
  </div>
</template>

<style scoped>
.source-fields { display: flex; gap: 12px; }
.source-field { flex: 1; min-width: 0; }
</style>
