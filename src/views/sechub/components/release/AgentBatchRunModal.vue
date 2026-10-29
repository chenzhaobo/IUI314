<script setup lang="ts">
/**
 * 「一键测试」派发弹窗：选安全测试环境 → 逐项目组调用 Agent → 展示每组结果。
 *
 * 打开方式：页面通过 ref 调 `open(groups, groupNames)`，分组按值快照后展示。
 */
import { Message } from '@arco-design/web-vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { useAgentBatchRun } from '../../composables/useAgentBatchRun'

defineOptions({ name: 'AgentBatchRunModal' })

const router = useRouter()
const {
  visible,
  envId,
  envLoading,
  running,
  envOptions,
  groups,
  groupNames,
  groupCount,
  totalApis,
  results,
  successCount,
  failedCount,
  hasSuccess,
  open,
  close,
  dispatch,
} = useAgentBatchRun()

const groupEntries = computed(() => Object.entries(groups.value).map(([code, paths]) => ({
  code,
  name: groupNames.value[code] || code,
  count: paths.length,
})))

async function handleDispatch() {
  const collected = await dispatch()
  if (!collected)
    return
  const failed = collected.length - successCount.value
  if (failed === 0)
    Message.success(`已派发 ${successCount.value} 个项目组`)
  else if (successCount.value === 0)
    Message.error(`派发失败：${failed} 个项目组`)
  else
    Message.warning(`成功 ${successCount.value} 组，失败 ${failed} 组`)
}

function handleCancel() {
  if (!running.value)
    close()
}

function goTasks() {
  close()
  void router.push('/sechub/api-test/api-agent-tasks')
}

defineExpose({ open })
</script>

<template>
  <a-modal
    v-model:visible="visible"
    :closable="!running"
    :mask-closable="!running"
    :width="680"
    title="一键测试（派发 Agent）"
    @cancel="handleCancel"
  >
    <div v-if="!results.length" class="batch-body">
      <a-alert type="info">
        一次调用只能派发同一个项目组，确认后将按项目组逐次调用。
      </a-alert>
      <div class="batch-line">
        将按 <b>{{ groupCount }}</b> 个项目组派发 <b>{{ totalApis }}</b> 个接口
      </div>
      <a-select
        v-model="envId"
        :loading="envLoading"
        :options="envOptions"
        allow-search
        placeholder="请选择安全测试环境"
        style="width: 100%"
      />
      <a-table :data="groupEntries" :pagination="false" row-key="code" size="small">
        <template #columns>
          <a-table-column title="项目组" :width="280" ellipsis tooltip>
            <template #cell="{ record }">
              <div>{{ record.name }}</div>
              <div class="sub-text">
                {{ record.code }}
              </div>
            </template>
          </a-table-column>
          <a-table-column title="接口数" data-index="count" :width="100" />
        </template>
      </a-table>
    </div>

    <div v-else class="batch-body">
      <a-alert :type="failedCount ? 'warning' : 'success'">
        已派发成功 {{ successCount }} 组，失败 {{ failedCount }} 组
      </a-alert>
      <div v-for="item in results" :key="item.projectGroupCode" class="result-row">
        <a-tag :color="item.ok ? 'green' : 'red'" size="small">
          {{ item.ok ? '已派发' : '失败' }}
        </a-tag>
        <span class="result-name">{{ item.projectGroupName }}（{{ item.apiCount }} 个接口）</span>
        <span class="result-msg">{{ item.message }}</span>
      </div>
    </div>

    <template #footer>
      <a-space>
        <a-button v-if="hasSuccess" @click="goTasks">
          前往 Agent 任务
        </a-button>
        <a-button :disabled="running" @click="close">
          关闭
        </a-button>
        <a-button
          v-if="!results.length"
          :disabled="!envId"
          :loading="running"
          type="primary"
          @click="handleDispatch"
        >
          开始派发
        </a-button>
      </a-space>
    </template>
  </a-modal>
</template>

<style scoped>
.batch-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.batch-line {
  color: var(--color-text-1);
  font-size: 14px;
}
.sub-text {
  color: var(--color-text-3);
  font-size: 12px;
}
.result-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px dashed var(--color-border-2);
}
.result-name {
  flex: none;
  font-weight: 500;
}
.result-msg {
  flex: 1;
  color: var(--color-text-3);
  font-size: 12px;
  word-break: break-all;
}
</style>
