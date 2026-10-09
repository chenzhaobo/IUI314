<script lang="ts" setup>
/**
 * 并发模式下的「固化条件摘要」（task.vue / test-plan.vue 触发表单共用）。
 *
 * 只做展示：并发基准的执行参数（并发数、爬坡、时长）由平台按 profile 下发，
 * 表单里的线程/爬坡/循环/时长会被忽略，所以这里把「将实际使用的条件」提前摊开；
 * 缺 profile 的脚本会被后端**整单拒绝**（service/src/perf/exec/task.rs 的
 * required_profiles），用红字提前暴露而不是等提交失败。
 */
import type { ConcScriptProfile } from './useConcMode'
import { profileSummary } from './types'

defineOptions({ name: 'ConcProfileSummary' })

defineProps<{ rows: ConcScriptProfile[], loading: boolean, missing: number }>()
</script>

<template>
  <div class="conc-sum">
    <div class="conc-sum-head">
      <span class="conc-sum-title">并发固化条件（执行参数按 profile 下发）</span>
      <a-tag v-if="missing > 0" color="red" size="small">
        {{ missing }} 个脚本未固化，触发会被整单拒绝
      </a-tag>
    </div>
    <a-spin :loading="loading" style="width: 100%">
      <div v-if="!loading && rows.length === 0" class="conc-sum-empty">
        选择脚本后显示各脚本的固化并发条件
      </div>
      <ul v-else class="conc-sum-list">
        <li v-for="row in rows" :key="row.scriptId" class="conc-sum-item">
          <span class="conc-sum-name">{{ row.scriptName }}</span>
          <span v-if="row.profile" class="conc-sum-meta">{{ profileSummary(row.profile) }}</span>
          <span v-else class="conc-sum-bad">未固化并发 profile —— 在报告或摸底稳定档点「固化为并发基准」后再触发</span>
        </li>
      </ul>
    </a-spin>
  </div>
</template>

<style scoped>
.conc-sum {
  margin-bottom: 12px;
  padding: 8px 10px;
  background: var(--color-fill-1);
  border-radius: 4px;
}

.conc-sum-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.conc-sum-title {
  color: var(--color-text-2);
  font-size: 13px;
}

.conc-sum-empty {
  color: var(--color-text-3);
  font-size: 12px;
}

.conc-sum-list {
  margin: 0;
  padding-left: 16px;
  color: var(--color-text-1);
  font-size: 12px;
  line-height: 1.9;
}

.conc-sum-item {
  word-break: break-all;
}

.conc-sum-name {
  margin-right: 8px;
  font-weight: 600;
}

.conc-sum-meta {
  color: var(--color-text-2);
}

.conc-sum-bad {
  color: rgb(var(--danger-6));
}
</style>
