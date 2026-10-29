<script setup lang="ts">
/**
 * 「批量通过 / 批量驳回」工具条（API 测试用例页）
 *
 * 只渲染按钮与弹窗：校验、请求、提示都在 useCaseBatchReview 里。
 * 提交成功但有条目被跳过时弹窗保留并列出原因，用户关闭后才 emit done
 * （父组件据此刷新列表并清空勾选）；全部成功则关闭弹窗并立即 emit done。
 */
import type { CaseBatchVerdict } from '@/types/sechub'
import { computed, ref } from 'vue'

import { useCaseBatchReview } from '../composables/useCaseBatchReview'

const props = defineProps<{
  /** 当前勾选的用例 id（由页面持有） */
  selectedIds: string[]
}>()

const emit = defineEmits<{
  (e: 'done'): void
}>()

const { visible, verdict, comment, submitting, lastResult, open, reset, submit } = useCaseBatchReview()

const count = computed(() => props.selectedIds.length)
/** 打开时快照的条数：emit done 后父组件会清空勾选，弹窗文案不能跟着变 0 */
const pendingCount = ref(0)
let doneNotified = false

const rejected = computed(() => verdict.value === 'rejected')
const actionText = computed(() => (rejected.value ? '批量驳回' : '批量通过'))
const tip = computed(() => {
  const head = `将对 ${pendingCount.value} 条用例${actionText.value}`
  return rejected.value ? `${head}，驳回意见会记入每条用例的评审记录` : head
})
const skipped = computed(() => lastResult.value?.skipped ?? [])

function openWith(next: CaseBatchVerdict) {
  pendingCount.value = count.value
  doneNotified = false
  open(next)
}

function notifyDone() {
  if (doneNotified)
    return
  doneNotified = true
  emit('done')
}

/** 返回 true 时弹窗关闭（arco before-ok 语义）；校验不过、请求失败、有跳过都保持打开 */
async function handleBeforeOk(): Promise<boolean> {
  if (lastResult.value) {
    notifyDone()
    return true
  }
  const ok = await submit(props.selectedIds)
  if (!ok)
    return false
  if (skipped.value.length)
    return false
  notifyDone()
  return true
}

/** 关闭（取消 / 右上角 / 遮罩）：看过跳过原因再关也算完成，需要刷新 */
function handleClose() {
  const submitted = Boolean(lastResult.value)
  reset()
  if (submitted)
    notifyDone()
}
</script>

<template>
  <a-button :disabled="!count" @click="openWith('approved')">
    批量通过{{ count ? `（${count}）` : '' }}
  </a-button>
  <a-button :disabled="!count" @click="openWith('rejected')">
    批量驳回{{ count ? `（${count}）` : '' }}
  </a-button>

  <a-modal
    v-model:visible="visible"
    :title="actionText"
    :ok-text="lastResult ? '关闭' : '确认'"
    :hide-cancel="Boolean(lastResult)"
    :ok-loading="submitting"
    :on-before-ok="handleBeforeOk"
    :width="560"
    @close="handleClose"
  >
    <p class="batch-review-tip">
      {{ tip }}
    </p>
    <a-textarea
      v-if="!lastResult"
      v-model="comment"
      :placeholder="rejected ? '驳回意见（必填）' : '评审意见（选填）'"
      :auto-size="{ minRows: 3, maxRows: 6 }"
      :max-length="500"
      show-word-limit
    />
    <template v-else>
      <p class="batch-review-tip">
        以下 {{ skipped.length }} 条未处理：
      </p>
      <a-table :data="skipped" :pagination="false" size="small" row-key="id">
        <template #columns>
          <a-table-column title="用例 ID" data-index="id" :width="200" ellipsis tooltip />
          <a-table-column title="跳过原因" data-index="reason" />
        </template>
      </a-table>
    </template>
  </a-modal>
</template>

<style scoped>
.batch-review-tip {
  margin: 0 0 12px;
  color: var(--color-text-2);
}
</style>
