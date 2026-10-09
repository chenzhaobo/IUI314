<script lang="ts" setup>
import { Message } from '@arco-design/web-vue'
/**
 * 「固化为并发基准」按钮（报告管理单 run / 摸底稳定档共用）。
 *
 * 调 `promote`：把一次成功 run 的执行条件固化为脚本 profile，并把该 run 稳态窗口的
 * 逐事务统计写成并发基线。失败（run 未成功 / 缺硬件档位 / 脚本不满足并发规范等）
 * 由请求层统一弹后端中文原因，这里只负责状态与成功提示 —— 成功后展示 profile_id 与基线事务数。
 * 重复固化是**原位更新**（后端 upsert），不需要额外拦截。
 */
import { ref } from 'vue'
import { promoteRun } from './service'

defineOptions({ name: 'ConcPromoteButton' })

const props = defineProps<{ runId?: string | null, text?: boolean }>()

const promoting = ref(false)

async function handlePromote() {
  const runId = props.runId
  if (!runId || promoting.value)
    return
  promoting.value = true
  const outcome = await promoteRun(runId)
  promoting.value = false
  if (!outcome)
    return
  Message.success(`已固化为并发基准：profile ${outcome.profile_id}，基线事务 ${outcome.txn_count} 条`)
}
</script>

<template>
  <a-button
    :type="text ? 'text' : 'primary'"
    size="small"
    :disabled="!runId"
    :loading="promoting"
    @click="handlePromote"
  >
    固化为并发基准
  </a-button>
</template>
