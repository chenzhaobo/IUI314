<script setup lang="ts">
import ScanModeTip from '../components/ScanModeTip.vue'
/**
 * 新建扫描第 1 步：扫描范围（整仓 / 表单资产 / 微服务资产）、目标分支与 commit、
 * 扫描策略与差量基准、规则目录。
 *
 * 各 form-item 的显示条件与原看板弹窗逐条对应（导航空白步骤组件由单根 div 承载）。
 */
import { baselineMetaText, formatCommitLabel, ruleSetLabel } from './labels'
import { useNewScanContext } from './useNewScan'

const ctx = useNewScanContext()
</script>

<template>
  <div>
    <a-form-item v-if="!ctx.isDeltaWizard || ctx.step === 0" label="扫描范围">
      <a-radio-group v-model="ctx.scanTargetType" type="button" :disabled="ctx.isLocalRepository" @change="ctx.onScanTargetChange">
        <a-radio value="repository">
          整个仓库
        </a-radio>
        <a-radio value="form">
          表单资产
        </a-radio>
        <a-radio value="microservice">
          微服务资产
        </a-radio>
      </a-radio-group>
    </a-form-item>
    <a-form-item v-if="ctx.isDomainTarget" :label="ctx.scanTargetType === 'form' ? '表单资产' : '微服务资产'">
      <a-space style="width: 100%">
        <a-select
          v-model="ctx.selectedAssetIds"
          multiple
          allow-search
          :loading="ctx.loadingDomainAssets"
          :placeholder="ctx.assetOptions.length ? '选择本次要扫描的资产' : '当前仓库暂无可扫描资产'"
          :max-tag-count="4"
          style="flex: 1"
        >
          <a-option v-for="asset in ctx.assetOptions" :key="asset.value" :value="asset.value" :disabled="asset.disabled">
            {{ asset.label }}（{{ asset.fileCount }} 文件）
          </a-option>
        </a-select>
        <!-- 资产常有几十上百个，逐个点不现实：一键全选 / 清空 -->
        <a-button size="small" :disabled="!ctx.assetOptions.length || ctx.selectedAssetIds.length === ctx.assetOptions.length" @click="ctx.selectAllAssets">
          全选（{{ ctx.assetOptions.length }}）
        </a-button>
        <a-button size="small" :disabled="!ctx.selectedAssetIds.length" @click="ctx.selectedAssetIds = []">
          清空
        </a-button>
        <span v-if="ctx.selectedAssetIds.length" class="text-xs text-gray">已选 {{ ctx.selectedAssetIds.length }}</span>
      </a-space>
      <a-checkbox v-model="ctx.includeAmbiguous" style="margin-top: 8px">
        包含匹配证据存在歧义的资产文件
      </a-checkbox>
      <div class="text-xs text-gray" style="margin-top: 4px">
        仅展示当前仓库内 active、in_scope 资产；源码证据与同步批次会在执行时由后端严格冻结校验。
      </div>
    </a-form-item>
    <a-alert v-if="ctx.isLocalRepository" type="info" style="margin-bottom: 12px">
      当前为反编译源码库，将直接扫描登记目录；不读取 Git 分支、Commit 或差量基线。
    </a-alert>
    <a-form-item v-if="ctx.isDeltaWizard && ctx.step === 0" label="目标分支">
      <!-- 分支选择行：下拉 + 显式刷新按钮（点击才 refresh=true 真正 git fetch） -->
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
        <a-button
          size="small"
          :loading="ctx.refreshingBranches"
          title="刷新分支（会执行 git fetch，较慢）"
          @click="ctx.refreshBranches"
        >
          <template #icon>
            <icon-refresh />
          </template>
        </a-button>
      </a-space>
    </a-form-item>
    <a-form-item v-if="ctx.isDeltaWizard && ctx.step === 0" label="目标 Commit（可选，留空则使用分支最新提交）">
      <!-- commit 下拉：支持搜索 + 手工输入不在列表中的 sha，保留 7~40 位 hex 校验。
           allow-clear 允许清空回「使用分支最新提交」语义；清空后 commit 为空串，
           confirmScope 中 commit || undefined 会转成 undefined，后端取分支最新 commit。 -->
      <a-select
        v-model="ctx.commit"
        :loading="ctx.loadingCommits"
        placeholder="留空则使用分支最新提交"
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
    <a-form-item v-if="ctx.isDeltaWizard && ctx.step === 0" label="扫描策略">
      <template #label>
        扫描策略
        <ScanModeTip />
      </template>
      <a-select v-model="ctx.deltaScanMode" style="width: 100%" @change="ctx.deltaPreview = null">
        <a-option value="auto_delta">
          推荐：自动增量
        </a-option>
        <a-option value="code_delta">
          仅代码差量
        </a-option>
        <a-option value="rule_delta">
          仅规则差量
        </a-option>
        <a-option value="hybrid_delta">
          代码 + 规则混合差量
        </a-option>
        <a-option value="full_baseline">
          完整基线
        </a-option>
        <a-option value="reconfirm">
          仅重新 AI 确认
        </a-option>
        <a-option value="hunk_quick">
          高级：新增行快速检查（不关闭问题）
        </a-option>
      </a-select>
    </a-form-item>
    <a-form-item v-if="ctx.isDeltaWizard && ctx.step === 0" label="差量基准">
      <a-radio-group v-model="ctx.scanScope" type="button" @change="ctx.deltaPreview = null">
        <a-radio value="diff_last">
          自动选择可信基线
        </a-radio>
        <a-radio value="diff_commit">
          指定基准 commit
        </a-radio>
      </a-radio-group>
    </a-form-item>
    <!-- 当前差量基线：「自动选择可信基线」用的就是它；没有时给人工采纳兜底 -->
    <a-form-item v-if="ctx.isDeltaWizard && ctx.step === 0" label="当前差量基线">
      <div class="baseline-row">
        <a-spin v-if="ctx.baselineLoading" :size="14" />
        <template v-else-if="ctx.baseline">
          <a-tag color="green" size="small">
            可用
          </a-tag>
          <span class="font-mono">{{ ctx.baseline.commit_short || '（无 commit）' }}</span>
          <span class="baseline-meta">{{ baselineMetaText(ctx.baseline) }}</span>
        </template>
        <template v-else>
          <a-tag color="orange" size="small">
            无
          </a-tag>
          <span class="baseline-meta">先跑一次「完整基线」建立；跑完（AI 确认 + 写回完成）平台会自动登记</span>
        </template>
        <a-button size="mini" :loading="ctx.baselineAdopting" @click="ctx.adoptCurrentBaseline">
          采纳最近成功扫描为基线
        </a-button>
      </div>
      <div class="text-xs text-gray" style="margin-top: 4px">
        没有基线时「自动增量」会报「找不到可信的差量基线」——先跑「完整基线」，或把上面的「差量基准」改成「指定基准 commit」。
      </div>
    </a-form-item>
    <a-form-item v-if="ctx.isDeltaWizard && ctx.step === 0 && ctx.scanScope === 'diff_commit'" label="基准 Commit SHA">
      <!-- 差量基准 commit：支持下拉选同分支 commit，保留手工输入与 7~40 位 hex 校验。
           allow-clear 允许清空；只有 scanScope === 'diff_commit' 时此 form-item 才渲染。 -->
      <a-select
        v-model="ctx.baseCommitInput"
        :loading="ctx.loadingCommits"
        placeholder="选择或输入基准 7~40 位 hex commit SHA"
        allow-search
        allow-create
        allow-clear
        style="width: 100%"
      >
        <a-option v-for="c in ctx.baseCommits" :key="c.sha" :value="c.sha">
          {{ formatCommitLabel(c) }}
        </a-option>
      </a-select>
    </a-form-item>
    <a-alert v-if="ctx.isDeltaWizard && ctx.step === 0 && ctx.deltaScanMode === 'hunk_quick'" type="warning" style="margin-bottom: 8px">
      新增行快速检查固定 may_auto_close=false，不会关闭任何历史问题。
    </a-alert>
    <a-form-item v-if="ctx.isLocalRepository || (ctx.isDeltaWizard && ctx.step === 0)" label="规则目录">
      <a-select
        v-model="ctx.ruleSetId"
        allow-clear
        placeholder="平台默认（安全 + 性能合并目录）"
        style="width: 100%"
        @change="ctx.deltaPreview = null"
      >
        <a-option v-for="item in ctx.ruleSets" :key="item.id" :value="item.id">
          {{ ruleSetLabel(item) }}
        </a-option>
      </a-select>
      <div class="text-xs text-gray" style="margin-top: 4px">
        留空用平台默认规则目录（当前为「安全 + 性能合并目录」，一次完整基线同时覆盖两个域）；
        只有明确要单独扫某个域时才在这里指定对应的规则目录。
      </div>
    </a-form-item>
  </div>
</template>

<style scoped>
/* 当前差量基线：状态标签 + commit + 来源说明 + 采纳按钮一行排开 */
.baseline-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.baseline-meta {
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
