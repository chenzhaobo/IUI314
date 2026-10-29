<script setup lang="ts">
import type { ExemptFormInput } from './composables/configCheckRules'
/**
 * 发版质量 → 白名单（菜单 sys_menu.component = 'sechub/release-waivers'）。
 *
 * 页面只做组装：筛选栏 + 白名单表 + 新增接口免测 / 撤销弹窗。
 * 取数与提交在 `useWaivers`。
 */
import type { ReleaseWaiver } from '@/types/sechub-release'
import { computed, onMounted, ref } from 'vue'

import ApiExemptModal from './components/release/config/ApiExemptModal.vue'
import WaiverRevokeModal from './components/release/config/WaiverRevokeModal.vue'
import WaiverTable from './components/release/config/WaiverTable.vue'
import { useWaivers } from './composables/useWaivers'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive :include 按它对上缓存
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'release-waivers' })

const {
  loading,
  submitting,
  revoking,
  filters,
  ruleOptions,
  list,
  pagination,
  init,
  handleSearch,
  handleReset,
  handlePageChange,
  handlePageSizeChange,
  addApiExempt,
  revoke,
} = useWaivers()

const exemptVisible = ref(false)
const revokeVisible = ref(false)
const currentWaiver = ref<ReleaseWaiver | null>(null)

const ruleSelectOptions = computed(() => [{ value: '', label: '全部规则' }, ...ruleOptions.value])

function openRevoke(waiver: ReleaseWaiver) {
  currentWaiver.value = waiver
  revokeVisible.value = true
}

async function confirmRevoke(reason: string) {
  if (!currentWaiver.value)
    return
  const ok = await revoke(currentWaiver.value, reason)
  if (ok)
    revokeVisible.value = false
}

async function confirmExempt(form: ExemptFormInput) {
  const ok = await addApiExempt(form)
  if (ok)
    exemptVisible.value = false
}

onMounted(() => {
  void init()
})
</script>

<template>
  <div class="release-waivers">
    <a-card :bordered="false">
      <a-space wrap>
        <a-select
          v-model="filters.ruleCode"
          :options="ruleSelectOptions"
          style="width: 260px"
          @change="handleSearch"
        />
        <span class="switch-label">
          <a-switch v-model="filters.activeOnly" size="small" @change="handleSearch" />
          <span>只看有效</span>
        </span>
        <a-input-search
          v-model="filters.keyword"
          allow-clear
          placeholder="对象 / 原因 / 创建人 / 规则"
          style="width: 280px"
          @search="handleSearch"
          @clear="handleSearch"
        />
        <a-button @click="handleReset">
          重置
        </a-button>
        <a-button type="primary" @click="exemptVisible = true">
          新增接口免测
        </a-button>
      </a-space>
    </a-card>

    <a-card :bordered="false">
      <div class="toolbar">
        <div class="section-title">
          白名单
        </div>
        <span class="hint">共 {{ pagination.total }} 条；加白 / 撤销即时作用于配置检查结果</span>
      </div>
      <WaiverTable
        :list="list"
        :loading="loading"
        :pagination="pagination"
        @page-change="handlePageChange"
        @page-size-change="handlePageSizeChange"
        @revoke="openRevoke"
      />
    </a-card>

    <ApiExemptModal
      v-model:visible="exemptVisible"
      :loading="submitting"
      @submit="confirmExempt"
    />
    <WaiverRevokeModal
      v-model:visible="revokeVisible"
      :waiver="currentWaiver"
      :loading="revoking"
      @confirm="confirmRevoke"
    />
  </div>
</template>

<style scoped>
.release-waivers {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.section-title {
  color: var(--color-text-1);
  font-size: 14px;
  font-weight: 600;
}
.hint {
  color: var(--color-text-3);
  font-size: 12px;
}
.switch-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text-2);
  font-size: 13px;
}
</style>
