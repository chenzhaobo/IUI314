<script lang="ts" setup>
import { computed, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useGet, usePost } from '@/hooks'
import { ApiAiAgent, ApiAiSkill, ApiAiInvoke, type AiAgent, type AiSkill, type AiListResult, type AiInvokeResponse } from '@/api/aiApis'
import { ErrorFlag } from '@/api/apis'

defineOptions({ name: 'debug-panel' })

// ── Agent 列表 ──────────────────────────────────
const { data: agentListRaw } = useGet<AiListResult<AiAgent>>(ApiAiAgent.getList, { page_size: 100, status: 'active' }, { immediate: true })
const agents = computed(() => agentListRaw.value?.list || [])

// ── Skill 列表 ──────────────────────────────────
const { data: skillListRaw } = useGet<AiListResult<AiSkill>>(ApiAiSkill.getList, { page_size: 100, status: 'active' }, { immediate: true })
const skills = computed(() => skillListRaw.value?.list || [])

// ── 表单状态 ──────────────────────────────────
const mode = ref<'free' | 'skill'>('free')
const selectedAgentCode = ref('')
const selectedModel = ref('')
const selectedSkillCode = ref('')
const prompt = ref('')
const variablesText = ref('{}')
const workDirOverride = ref('')
const sessionId = ref('')
const timeoutSecs = ref<number | undefined>(undefined)

// ── 执行状态 ──────────────────────────────────
const executing = ref(false)
const result = ref<AiInvokeResponse | null>(null)
const errorMsg = ref('')

// ── 模型选项 ──────────────────────────────────
const modelOptions = computed(() => {
  const agent = agents.value.find((a: AiAgent) => a.agent_code === selectedAgentCode.value)
  if (!agent?.supported_models_json) return []
  try {
    return JSON.parse(agent.supported_models_json) as string[]
  } catch {
    return []
  }
})

// ── 选择 Skill 时自动填充 ──────────────────────────────────
function handleSkillChange(value: string | number | boolean | Record<string, any> | (string | number | boolean | Record<string, any>)[]) {
  const code = typeof value === 'string' ? value : ''
  if (!code) return
  const skill = skills.value.find((s: AiSkill) => s.skill_code === code)
  if (skill) {
    prompt.value = skill.prompt_template
    // 尝试获取关联 agent
    if (skill.agent_id) {
      const agent = agents.value.find((a: AiAgent) => a.id === skill.agent_id)
      if (agent) selectedAgentCode.value = agent.agent_code
    }
  }
}

// ── 执行调用 ──────────────────────────────────
async function handleInvoke() {
  if (!selectedAgentCode.value) {
    Message.warning('请选择 Agent')
    return
  }
  if (mode.value === 'free' && !prompt.value.trim()) {
    Message.warning('请输入 Prompt')
    return
  }

  executing.value = true
  result.value = null
  errorMsg.value = ''

  let variables: Record<string, unknown> | null = null
  if (variablesText.value.trim() && variablesText.value.trim() !== '{}') {
    try {
      variables = JSON.parse(variablesText.value)
    } catch {
      Message.error('变量 JSON 格式错误')
      executing.value = false
      return
    }
  }

  const payload = {
    agent_code: selectedAgentCode.value,
    skill_code: mode.value === 'skill' ? selectedSkillCode.value : null,
    prompt: mode.value === 'free' ? prompt.value : null,
    caller_module: 'debug_panel',
    caller_id: null,
    variables,
    session_id: sessionId.value || null,
    work_dir_override: workDirOverride.value || null,
    model_override: selectedModel.value || null,
    timeout_secs: timeoutSecs.value || null,
  }

  const { data, execute, error } = usePost<AiInvokeResponse | typeof ErrorFlag>(ApiAiInvoke.invoke, payload)
  await execute()
  executing.value = false

  if (error.value || data.value === ErrorFlag || !data.value) {
    errorMsg.value = '调用失败，请查看后端日志'
    return
  }

  result.value = data.value
  // 自动记录 session_id 供继续对话
  if (result.value?.session_id) {
    sessionId.value = result.value.session_id
  }
  if (result.value?.status === 'succeeded') {
    Message.success(`执行成功，耗时 ${result.value.duration_ms}ms`)
  } else {
    Message.warning(`执行状态: ${result.value?.status}`)
  }
}

// ── 格式化输出 ──────────────────────────────────
function formatOutput(output: unknown): string {
  if (!output) return '-'
  if (typeof output === 'string') return output
  return JSON.stringify(output, null, 2)
}

// 这些 a-form 只用来做纵向布局，不做校验，但 arco 的 model 是必填 prop。
// 用一个模块级常量而不是在模板里写 :model="{}"，避免每次渲染都新建对象。
const layoutOnlyModel = {}

</script>

<template>
  <div class="ai-debug-panel">
    <a-row :gutter="16">
      <!-- 左侧：输入区 -->
      <a-col :span="10">
        <a-card title="调用配置" :bordered="false">
          <a-form layout="vertical" :model="layoutOnlyModel">
            <!-- 模式切换 -->
            <a-form-item label="调用模式">
              <a-radio-group v-model="mode" type="button">
                <a-radio value="free">自由指令</a-radio>
                <a-radio value="skill">Skill 模式</a-radio>
              </a-radio-group>
            </a-form-item>

            <!-- Agent 选择 -->
            <a-form-item label="Agent" required>
              <a-select v-model="selectedAgentCode" placeholder="选择 Agent">
                <a-option v-for="a in agents" :key="a.id" :value="a.agent_code">{{ a.agent_name }} ({{ a.agent_code }})</a-option>
              </a-select>
            </a-form-item>

            <!-- Model 选择 -->
            <a-form-item label="Model">
              <a-select v-model="selectedModel" placeholder="使用默认模型" allow-clear>
                <a-option v-for="m in modelOptions" :key="m" :value="m">{{ m }}</a-option>
              </a-select>
            </a-form-item>

            <!-- Skill 选择（Skill 模式） -->
            <a-form-item v-if="mode === 'skill'" label="Skill" required>
              <a-select v-model="selectedSkillCode" placeholder="选择 Skill" @change="handleSkillChange">
                <a-option v-for="s in skills" :key="s.id" :value="s.skill_code">{{ s.skill_name }} ({{ s.skill_code }})</a-option>
              </a-select>
            </a-form-item>

            <!-- Prompt 输入 -->
            <a-form-item :label="mode === 'free' ? 'Prompt' : 'Prompt 模板预览'">
              <a-textarea
                v-model="prompt"
                :auto-size="{ minRows: 4, maxRows: 10 }"
                :placeholder="mode === 'free' ? '输入指令，如：回复 hello' : '选择 Skill 后自动填充模板'"
                :disabled="mode === 'skill'"
              />
            </a-form-item>

            <!-- 变量（Skill 模式） -->
            <a-form-item v-if="mode === 'skill'" label="模板变量 (JSON)">
              <a-textarea v-model="variablesText" :auto-size="{ minRows: 2, maxRows: 5 }" placeholder='{"key": "value"}' />
            </a-form-item>

            <!-- 高级选项 -->
            <a-collapse :bordered="false">
              <a-collapse-item header="高级选项" key="advanced">
                <a-form-item label="工作目录覆盖">
                  <a-input v-model="workDirOverride" placeholder="留空使用默认" allow-clear />
                </a-form-item>
                <a-form-item label="Session ID (会话恢复)">
                  <a-input v-model="sessionId" placeholder="留空创建新会话" allow-clear />
                </a-form-item>
                <a-form-item label="超时(秒)">
                  <a-input-number v-model="timeoutSecs" :min="10" :max="3600" placeholder="使用 Agent 默认值" />
                </a-form-item>
              </a-collapse-item>
            </a-collapse>

            <!-- 执行按钮 -->
            <a-form-item>
              <a-button type="primary" long :loading="executing" @click="handleInvoke">
                <template #icon><icon-play-arrow /></template>
                {{ executing ? '执行中...' : '执行' }}
              </a-button>
            </a-form-item>
          </a-form>
        </a-card>
      </a-col>

      <!-- 右侧：结果区 -->
      <a-col :span="14">
        <a-card title="执行结果" :bordered="false">
          <template v-if="errorMsg">
            <a-alert type="error" :title="errorMsg" class="m-b-16px" />
          </template>

          <template v-if="result">
            <!-- 状态摘要 -->
            <a-descriptions :column="3" bordered size="small" class="m-b-16px">
              <a-descriptions-item label="状态">
                <a-tag :color="result.status === 'succeeded' ? 'green' : 'red'">{{ result.status }}</a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="耗时">{{ result.duration_ms }}ms</a-descriptions-item>
              <a-descriptions-item label="Execution ID">
                <a-typography-text copyable>{{ result.execution_id }}</a-typography-text>
              </a-descriptions-item>
              <a-descriptions-item v-if="result.session_id" label="Session ID" :span="3">
                <a-typography-text copyable>{{ result.session_id }}</a-typography-text>
              </a-descriptions-item>
            </a-descriptions>

            <!-- 错误信息 -->
            <a-alert v-if="result.error_message" type="error" class="m-b-16px">
              <pre class="output-pre">{{ result.error_message }}</pre>
            </a-alert>

            <!-- 输出内容 -->
            <a-card title="AI 输出" size="small" class="m-b-16px">
              <pre class="output-pre">{{ formatOutput(result.output_json) }}</pre>
            </a-card>

            <!-- 产出文件 -->
            <a-card v-if="result.output_files && result.output_files.length > 0" title="产出文件" size="small">
              <a-table :data="result.output_files" :columns="[
                { title: '文件路径', dataIndex: 'path' },
                { title: '大小(bytes)', dataIndex: 'size_bytes', width: 120 },
              ]" :pagination="false" size="small" />
            </a-card>
          </template>

          <!-- 空状态 -->
          <a-empty v-if="!result && !errorMsg" description="选择 Agent 并输入指令后点击执行" />
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<style scoped>
.ai-debug-panel { padding: 0; }
.output-pre { max-height: 400px; overflow: auto; font-size: 13px; white-space: pre-wrap; word-break: break-all; background: var(--color-fill-1); padding: 12px; border-radius: 4px; margin: 0; }
</style>
