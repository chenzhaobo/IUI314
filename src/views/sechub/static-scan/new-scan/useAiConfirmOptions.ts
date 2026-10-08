import type { AiConfirmBody } from './types'
/**
 * AI 确认表单的共用部分：确认模式 + 模型 / Agent / 技能选项 + 请求体组装。
 *
 * 行级确认（useAiConfirm：提交后跟踪 Agent 进度）与批量确认（useBatchAiConfirm：
 * 逐个提交、只看成功/失败）表单一致，抽出来共用，避免两处选项逻辑漂移。
 */
import type { AiAgent, AiSkill } from '@/api/aiApis'
import { computed, ref } from 'vue'
import { fetchAgents, fetchSkills } from './service'
import { AI_CONFIRM_SCOPE_ALL } from './useRunScanPoints'

/** 批量确认的默认模型（任务约定：弹窗默认 DeepSeek-Flash，'' = Agent 默认模型） */
export const DEFAULT_BATCH_MODEL = 'DeepSeek-Flash'

/** Agent 没配 supported_models_json 时的兜底模型选项 */
const FALLBACK_MODEL_OPTIONS = [
  { label: 'Agent 默认模型（auto）', value: '' },
  { label: 'Qwen3.8-Max-Preview', value: 'Qwen3.8-Max-Preview' },
  { label: 'GLM-5.2', value: 'GLM-5.2' },
  { label: 'Kimi-K3', value: 'Kimi-K3' },
  { label: 'DeepSeek-V4-Pro', value: 'DeepSeek-V4-Pro' },
  { label: DEFAULT_BATCH_MODEL, value: DEFAULT_BATCH_MODEL },
  { label: 'MiniMax-M3', value: 'MiniMax-M3' },
]

export function useAiConfirmOptions() {
  const mode = ref<'batch' | 'agent'>('batch')
  const model = ref('')
  const agentCode = ref('')
  const skillCode = ref('')
  /** 确认范围：'all' 或某个 scan_point_id（选项见 ./useRunScanPoints） */
  const scope = ref<string>(AI_CONFIRM_SCOPE_ALL)

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
        const options = models.map(m => ({ label: m === 'auto' ? 'Agent 默认模型（auto）' : m, value: m === 'auto' ? '' : m }))
        // Agent 白名单里没有平台默认模型时也保留它，否则默认值在下拉里显示不出来
        if (!options.some(option => option.value === DEFAULT_BATCH_MODEL))
          options.push({ label: DEFAULT_BATCH_MODEL, value: DEFAULT_BATCH_MODEL })
        return options
      }
      catch { /* 配置串损坏时退回兜底选项 */ }
    }
    return FALLBACK_MODEL_OPTIONS
  })

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

  /** 懒加载 Agent / 技能列表；失败保留旧列表，不阻断弹窗 */
  function ensureLookups() {
    if (agentList.value.length === 0)
      void loadAgentList()
    if (skillList.value.length === 0)
      void loadSkillList()
  }

  /** 组装确认请求体（空值不发送，由后端按默认处理） */
  function buildBody(runId: string): AiConfirmBody {
    const body: AiConfirmBody = { run_id: runId, scope: scope.value || AI_CONFIRM_SCOPE_ALL, mode: mode.value }
    if (model.value)
      body.model = model.value
    if (agentCode.value)
      body.agent_code = agentCode.value
    if (skillCode.value)
      body.skill_code = skillCode.value
    return body
  }

  return {
    mode,
    model,
    agentCode,
    skillCode,
    scope,
    agentList,
    agentLoading,
    skillList,
    skillLoading,
    modelOptions,
    ensureLookups,
    buildBody,
  }
}
