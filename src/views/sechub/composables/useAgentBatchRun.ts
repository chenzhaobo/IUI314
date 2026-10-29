/**
 * 「一键测试」批量派发：选安全测试环境，按项目组逐个调用
 * `POST /sechub/scan/api-agent/run`（后端一次只接受一个项目组）。
 *
 * 逐组串行，便于把每组结果（run_id / message）原样汇总给弹窗展示。
 */
import type { ReleaseSecEnv } from '@/types/sechub-release'
import { Message } from '@arco-design/web-vue'
import { computed, ref } from 'vue'

import { fetchSecEnvs, startAgentRun } from '../services/releaseService'

/** 单个项目组的派发结果 */
export interface BatchGroupResult {
  projectGroupCode: string
  projectGroupName: string
  apiCount: number
  /** 派发成功时的 run_id */
  runId: string | null
  ok: boolean
  message: string
}

interface EnvOption {
  value: string
  label: string
}

export function useAgentBatchRun() {
  const visible = ref(false)
  const envId = ref('')
  const envLoading = ref(false)
  const running = ref(false)
  const envs = ref<ReleaseSecEnv[]>([])
  const groups = ref<Record<string, string[]>>({})
  const groupNames = ref<Record<string, string>>({})
  const results = ref<BatchGroupResult[]>([])

  const envOptions = computed<EnvOption[]>(() => envs.value.map(env => ({
    value: env.id,
    label: env.env_name ? `${env.env_name}（${env.env_type || env.id}）` : env.id,
  })))

  const groupCount = computed(() => Object.keys(groups.value).length)
  const totalApis = computed(() => Object.values(groups.value).reduce((sum, paths) => sum + paths.length, 0))

  const successCount = computed(() => results.value.filter(item => item.ok).length)
  const failedCount = computed(() => results.value.filter(item => !item.ok).length)
  const hasSuccess = computed(() => results.value.some(item => item.ok && item.runId))

  async function loadEnvs() {
    envLoading.value = true
    try {
      envs.value = await fetchSecEnvs()
    }
    finally {
      envLoading.value = false
    }
  }

  /** 打开弹窗：记录本次要派发的分组（按值快照，避免页面后续勾选变化影响结果文案） */
  function open(nextGroups: Record<string, string[]>, nextNames: Record<string, string>) {
    groups.value = Object.fromEntries(Object.entries(nextGroups).map(([code, paths]) => [code, [...paths]]))
    groupNames.value = { ...nextNames }
    envId.value = ''
    results.value = []
    visible.value = true
    void loadEnvs()
  }

  function close() {
    visible.value = false
  }

  async function dispatch(): Promise<BatchGroupResult[] | null> {
    if (!envId.value) {
      Message.warning('请选择安全测试环境')
      return null
    }
    running.value = true
    const collected: BatchGroupResult[] = []
    try {
      for (const [code, paths] of Object.entries(groups.value)) {
        const name = groupNames.value[code] || code
        const res = await startAgentRun(envId.value, code, paths)
        if (!res) {
          collected.push({
            projectGroupCode: code,
            projectGroupName: name,
            apiCount: paths.length,
            runId: null,
            ok: false,
            message: '派发请求失败',
          })
          continue
        }
        collected.push({
          projectGroupCode: code,
          projectGroupName: name,
          apiCount: paths.length,
          runId: res.run_id,
          ok: Boolean(res.run_id),
          message: res.message,
        })
        results.value = [...collected]
      }
      results.value = collected
      return collected
    }
    finally {
      running.value = false
    }
  }

  return {
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
  }
}
