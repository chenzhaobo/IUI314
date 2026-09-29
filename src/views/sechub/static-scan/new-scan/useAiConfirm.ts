import type { AiConfirmBody } from './types'
/**
 * AI 确认（平台编排 batch / Agent 自主 agent）状态与触发（迁自 SD 1292-1487）。
 *
 * 入口从看板工具栏改成运行页的行级动作：`open(runId)` 指定要确认的批次。
 * 提交成功后的刷新由回调 `onSubmitted(runId)` 交给运行页（原来是刷新看板自身）。
 */
import type { AiAgent, AiSkill } from '@/api/aiApis'
import type { AgentRunProgress } from '@/types/static-scan'
import { Message } from '@arco-design/web-vue'
import { computed, onActivated, onDeactivated, onUnmounted, ref } from 'vue'
import { fetchAgents, fetchAgentStatus, fetchSkills, triggerAiConfirm } from './service'

export interface UseAiConfirmOptions {
  /** 提交成功（或 Agent 审计收口）后的回调：运行页据此刷新运行列表 */
  onSubmitted?: (runId: string) => void | Promise<void>
}

export function useAiConfirm(options: UseAiConfirmOptions = {}) {
  const visible = ref(false)
  const confirming = ref(false)
  const mode = ref<'batch' | 'agent'>('batch')
  const model = ref('')
  const agentCode = ref('')
  const skillCode = ref('')
  const targetRunId = ref('')

  const agentList = ref<AiAgent[]>([])
  const agentLoading = ref(false)
  const skillList = ref<AiSkill[]>([])
  const skillLoading = ref(false)

  /** 根据选中 agent 的 supported_models_json 动态生成模型选项 */
  const modelOptions = computed(() => {
    const agent = agentList.value.find(a => a.agent_code === agentCode.value)
    if (agent?.supported_models_json) {
      try {
        const models: string[] = JSON.parse(agent.supported_models_json)
        return models.map(m => ({ label: m === 'auto' ? 'Agent 默认模型（auto）' : m, value: m === 'auto' ? '' : m }))
      }
      catch { /* ignore */ }
    }
    // 无配置时回退默认选项
    return [
      { label: 'Agent 默认模型（auto）', value: '' },
      { label: 'Qwen3.8-Max-Preview', value: 'Qwen3.8-Max-Preview' },
      { label: 'GLM-5.2', value: 'GLM-5.2' },
      { label: 'Kimi-K3', value: 'Kimi-K3' },
      { label: 'DeepSeek-V4-Pro', value: 'DeepSeek-V4-Pro' },
      { label: 'MiniMax-M3', value: 'MiniMax-M3' },
    ]
  })

  // ── Agent 自主审计进度轮询 ──
  const agentProgress = ref<AgentRunProgress | null>(null)
  let pollTimer: ReturnType<typeof setInterval> | null = null
  // 是否有「进行中」的轮询（与定时器解耦）：切页签暂停定时器、回页签按标记恢复，
  // 不能靠 agentProgress 判断 —— 首次拉取还没返回时它是 null，会把进行中的轮询漏掉。
  let pollingActive = false

  async function loadAgentStatus() {
    if (!targetRunId.value)
      return
    const progress = await fetchAgentStatus(targetRunId.value)
    if (!progress)
      return
    agentProgress.value = progress
    // 全部处理完毕（无 pending）则停止轮询并刷新列表。
    // 注意区分「真正审计完成」与「Agent 快速失败被兜底对账全转 review_needed」：
    // 后者 pending 也会归零，但 confirmed+rejected 为 0、review_needed≈total，
    // 说明 Agent 实际没跑完（CLI 失败/工具权限/回调不通），不能报「完成」。
    if (progress.pending === 0 && progress.total > 0) {
      stopPolling()
      const adjudicated = (progress.confirmed ?? 0) + (progress.rejected ?? 0)
      if (adjudicated === 0 && (progress.review_needed ?? 0) >= progress.total) {
        Message.error('Agent 未产出有效结论：候选全部被兜底标记为待复核，通常是 Agent 执行失败（CLI/工具权限/回调不通）。请在扫描运行页查看失败原因或重扫')
      }
      else {
        Message.success('Agent 自主审计完成')
      }
      visible.value = false
      await options.onSubmitted?.(targetRunId.value)
    }
  }

  function stopPolling() {
    pollingActive = false
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function startPolling() {
    stopPolling()
    agentProgress.value = null
    pollingActive = true
    void loadAgentStatus()
    pollTimer = setInterval(() => void loadAgentStatus(), 3000)
  }

  /** 暂停只清定时器、保留「进行中」标记，供 onActivated 恢复 */
  function pausePolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function resumePolling() {
    if (!pollingActive || pollTimer)
      return
    void loadAgentStatus()
    pollTimer = setInterval(() => void loadAgentStatus(), 3000)
  }

  // 缓存安全（keep-alive）：组件被缓存后切页签只触发 onDeactivated，进行中的轮询必须停掉，
  // 否则后台照跑；回来时只恢复「进行中」的轮询。
  onDeactivated(pausePolling)
  onActivated(resumePolling)
  onUnmounted(stopPolling)

  async function loadAgentList() {
    agentLoading.value = true
    try {
      const list = await fetchAgents()
      if (list)
        agentList.value = list
    }
    finally {
      agentLoading.value = false
    }
  }

  async function loadSkillList() {
    skillLoading.value = true
    try {
      const list = await fetchSkills()
      if (list)
        skillList.value = list
    }
    finally {
      skillLoading.value = false
    }
  }

  /** 打开弹窗并指定要确认的批次（运行页行级入口） */
  function open(runId: string) {
    if (!runId) {
      Message.warning('无可用的扫描结果')
      return
    }
    targetRunId.value = runId
    // 打开弹窗时加载 agent / 技能列表（失败保留旧列表，不阻断）
    if (agentList.value.length === 0)
      void loadAgentList()
    if (skillList.value.length === 0)
      void loadSkillList()
    visible.value = true
  }

  async function submit() {
    if (!targetRunId.value) {
      Message.warning('无可用的扫描结果')
      return
    }
    // batch：提交后即关闭（与迁移前一致）；agent：留在弹窗里显示审计进度，跑完自动关闭
    visible.value = false
    confirming.value = true
    try {
      const body: AiConfirmBody = { run_id: targetRunId.value, scope: 'all', mode: mode.value }
      if (model.value)
        body.model = model.value
      if (agentCode.value)
        body.agent_code = agentCode.value
      if (skillCode.value)
        body.skill_code = skillCode.value
      const res = await triggerAiConfirm(body)
      if (!res)
        return
      Message.success(res.message)
      if (mode.value === 'agent') {
        visible.value = true
        startPolling()
        return
      }
      await options.onSubmitted?.(targetRunId.value)
    }
    finally {
      confirming.value = false
    }
  }

  return {
    visible,
    confirming,
    mode,
    model,
    agentCode,
    skillCode,
    targetRunId,
    agentList,
    agentLoading,
    skillList,
    skillLoading,
    modelOptions,
    agentProgress,
    open,
    submit,
  }
}
