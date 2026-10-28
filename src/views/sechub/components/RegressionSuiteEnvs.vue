<script setup lang="ts">
/**
 * 回归套件 环境绑定 + 运行记录抽屉
 *
 * 后端接口（api/src/sechub/regression_suite.rs）：
 *   GET  /suites/{id}/envs                 绑定环境（含 env_name/product_line/task_id）
 *   POST /suites/{id}/envs                 批量绑定 { env_ids } → { added, duplicated, rejected }
 *   POST /suites/{id}/envs/{env_id}/delete 解绑
 *   POST /suites/{id}/run                  手动触发全部启用环境
 */
import type { SecRegressionSuite, SecRegressionSuiteBindResult, SecRegressionSuiteEnv, SecRegressionSuiteTriggerResult } from '@/api/sechubApis'
import { Message, Modal } from '@arco-design/web-vue'
import { computed, ref, watch } from 'vue'

import { ApiSecRegressionSuite, ApiSecTestEnv, resolveStaticScanApi } from '@/api/sechubApis'
import { formatTime, getAction, postAction } from '@/hooks'
import RegressionSuiteRuns from './RegressionSuiteRuns.vue'

interface SecTestEnvBrief {
  id: string
  env_name?: string | null
  env_type?: string | null
  env_url?: string | null
}

const props = defineProps<{
  visible: boolean
  suite: SecRegressionSuite | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'changed': []
}>()

const envs = ref<SecRegressionSuiteEnv[]>([])
const envsLoading = ref(false)
const allEnvs = ref<SecTestEnvBrief[]>([])
const selectedEnvIds = ref<string[]>([])
const binding = ref(false)
const runBusy = ref(false)
const runsRefresh = ref(0)
const runsRef = ref<InstanceType<typeof RegressionSuiteRuns>>()

const boundEnvIds = computed(() => new Set(envs.value.map(env => env.sec_env_id)))
const candidateEnvs = computed(() => allEnvs.value.filter(env => !boundEnvIds.value.has(env.id)))

function suiteApi(template: string, extra: Record<string, string> = {}) {
  return resolveStaticScanApi(template, { id: props.suite?.id ?? '', ...extra })
}

function envLabel(envId: string) {
  const bound = envs.value.find(env => env.sec_env_id === envId)?.env_name
  if (bound)
    return bound
  return allEnvs.value.find(env => env.id === envId)?.env_name || envId
}

async function loadEnvs() {
  if (!props.suite)
    return
  envsLoading.value = true
  try {
    const res = await getAction<SecRegressionSuiteEnv[]>(suiteApi(ApiSecRegressionSuite.envs))
    envs.value = res || []
  }
  finally {
    envsLoading.value = false
  }
}

async function loadAllEnvs() {
  const res = await getAction<{ list?: SecTestEnvBrief[] }>(ApiSecTestEnv.getList, { page_num: 1, page_size: 500 })
  allEnvs.value = Array.isArray(res?.list) ? res.list : []
}

function bumpRuns() {
  runsRefresh.value += 1
}

async function bind() {
  if (!selectedEnvIds.value.length) {
    Message.warning('请选择要绑定的环境')
    return
  }
  binding.value = true
  try {
    const res = await postAction<SecRegressionSuiteBindResult>(
      suiteApi(ApiSecRegressionSuite.envs),
      { env_ids: selectedEnvIds.value },
    )
    if (res === null)
      return
    selectedEnvIds.value = []
    const parts = [`新增 ${res.added}`, `重复 ${res.duplicated}`]
    if (res.rejected.length)
      parts.push(`拒绝 ${res.rejected.length}`)
    Message.success(`绑定完成：${parts.join('，')}`)
    if (res.rejected.length) {
      Modal.warning({
        title: '部分环境未绑定',
        content: res.rejected.map(item => `${envLabel(item.env_id)}：${item.reason}`).join('；'),
      })
    }
    await loadEnvs()
    bumpRuns()
    emit('changed')
  }
  finally {
    binding.value = false
  }
}

function unbind(record: SecRegressionSuiteEnv) {
  Modal.confirm({
    title: '解绑环境',
    content: `确认将「${record.env_name || record.sec_env_id}」从套件中移除？已产生的运行记录不受影响。`,
    okText: '解绑',
    cancelText: '取消',
    onOk: async () => {
      const res = await postAction<string>(suiteApi(ApiSecRegressionSuite.unbindEnv, { env_id: record.sec_env_id }))
      if (res === null)
        return
      Message.success('已解绑')
      await loadEnvs()
      bumpRuns()
      emit('changed')
    },
  })
}

function trigger() {
  Modal.confirm({
    title: '手动触发套件',
    content: '将为每个启用环境各建一条运行记录；已有待执行/运行中记录的环境会被跳过。确认触发？',
    okText: '触发',
    cancelText: '取消',
    onOk: async () => {
      runBusy.value = true
      try {
        const res = await postAction<SecRegressionSuiteTriggerResult>(suiteApi(ApiSecRegressionSuite.run))
        if (res === null)
          return
        if (res.skipped)
          Message.warning(`已触发 ${res.triggered} 个环境，跳过 ${res.skipped} 个`)
        else
          Message.success(`已触发 ${res.triggered} 个环境`)
        if (res.skipped_envs.length) {
          Modal.info({
            title: '跳过的环境',
            content: res.skipped_envs.map(item => `${envLabel(item.env_id)}：${item.reason}`).join('；'),
          })
        }
        bumpRuns()
        emit('changed')
      }
      finally {
        runBusy.value = false
      }
    },
  })
}

function close() {
  emit('update:visible', false)
}

watch(() => props.visible, (visible) => {
  if (!visible || !props.suite)
    return
  selectedEnvIds.value = []
  envs.value = []
  loadEnvs()
  loadAllEnvs()
  bumpRuns()
}, { immediate: true })
</script>

<template>
  <a-drawer
    :visible="visible"
    :width="920"
    :footer="false"
    title="环境与运行"
    @cancel="close"
  >
    <div v-if="suite" class="suite-envs">
      <div class="suite-envs__head">
        <span class="suite-envs__name">{{ suite.name }}</span>
        <a-tag>{{ suite.product_line }}</a-tag>
        <a-tag color="arcoblue">
          {{ suite.suite_code }}
        </a-tag>
        <a-tag v-if="suite.schedule_enabled === '1'" color="green">
          {{ suite.schedule_cron || '已启用定时' }}
        </a-tag>
      </div>

      <a-divider orientation="left">
        绑定环境
      </a-divider>
      <a-space wrap style="margin-bottom: 8px">
        <a-select
          v-model="selectedEnvIds"
          multiple
          allow-search
          placeholder="选择要绑定的环境（产品线必须与套件一致）"
          style="width: 460px"
        >
          <a-option v-for="env in candidateEnvs" :key="env.id" :value="env.id">
            {{ env.env_name || env.id }}{{ env.env_type ? `（${env.env_type}）` : '' }}
          </a-option>
        </a-select>
        <a-button type="primary" :loading="binding" @click="bind">
          绑定
        </a-button>
        <a-button status="success" :loading="runBusy" @click="trigger">
          手动触发
        </a-button>
      </a-space>

      <a-table
        :data="envs"
        :loading="envsLoading"
        :pagination="false"
        row-key="id"
        size="small"
        :scroll="{ minWidth: 820 }"
      >
        <template #columns>
          <a-table-column title="环境" data-index="env_name" :width="160" ellipsis tooltip />
          <a-table-column title="产品线" data-index="product_line" :width="80">
            <template #cell="{ record }">
              {{ record.product_line || '--' }}
            </template>
          </a-table-column>
          <a-table-column title="地址" data-index="env_url" :width="220" ellipsis tooltip />
          <a-table-column title="复用任务" data-index="task_id" :width="150" ellipsis tooltip>
            <template #cell="{ record }">
              {{ record.task_id || '尚未触发' }}
            </template>
          </a-table-column>
          <a-table-column title="绑定时间" data-index="created_at" :width="150">
            <template #cell="{ record }">
              {{ formatTime(record.created_at) }}
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="130" fixed="right">
            <template #cell="{ record }">
              <a-space>
                <a-link @click="runsRef?.showEnv(record.sec_env_id)">
                  查看运行
                </a-link>
                <a-popconfirm content="确认解绑该环境？" @ok="unbind(record)">
                  <a-link status="danger">
                    解绑
                  </a-link>
                </a-popconfirm>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>

      <a-divider orientation="left">
        运行记录
      </a-divider>
      <RegressionSuiteRuns
        ref="runsRef"
        :suite-id="suite.id"
        :envs="envs"
        :refresh-key="runsRefresh"
      />
    </div>
  </a-drawer>
</template>

<style scoped>
.suite-envs {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.suite-envs__head {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.suite-envs__name {
  font-size: 15px;
  font-weight: 600;
}
</style>
