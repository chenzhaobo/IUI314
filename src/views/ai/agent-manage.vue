<script lang="ts" setup>
import type { AgentModelSyncResult, AiAgent, AiListResult } from '@/api/aiApis'
import { Message, Modal } from '@arco-design/web-vue'
import { computed, ref } from 'vue'
import { ApiAiAgent } from '@/api/aiApis'
import { ErrorFlag } from '@/api/apis'
import { useDelete, useGet, usePost, usePut } from '@/hooks'

defineOptions({ name: 'ai-agent-manage' })

// ── 列表数据 ──────────────────────────────────
const queryParams = ref({ agent_name: '', status: '', page_num: 1, page_size: 10 })
const { isFetching: loading, data: listRaw, execute: fetchList } = useGet<AiListResult<AiAgent>>(
  ApiAiAgent.getList,
  queryParams,
  { immediate: true },
)
const list = computed(() => listRaw.value?.list || [])
const total = computed(() => listRaw.value?.total || 0)

function handleSearch() { queryParams.value.page_num = 1; fetchList() }
function handlePageChange(page: number) { queryParams.value.page_num = page; fetchList() }

// ── 新增/编辑弹窗 ──────────────────────────────────
const modalVisible = ref(false)
const isEdit = ref(false)
const form = ref<Partial<AiAgent>>({})
const submitting = ref(false)

function handleAdd() {
  isEdit.value = false
  form.value = {
    agent_code: '', agent_name: '', executable_path: '', invoke_template: '["chat", "{prompt}", "--no-interactive", "--trust-all-tools", "-f", "json", "--model", "{model}"]',
    supported_models_json: '[]', default_model: 'auto', max_timeout_secs: 300, max_concurrent: 2, health_check_cmd: '--help', skill_mount_path: '.qoder/skills/{skill_code}', status: 'active', remark: '',
  }
  modalVisible.value = true
}

function handleEdit(record: AiAgent) {
  isEdit.value = true
  form.value = { ...record }
  modalVisible.value = true
}

async function handleSubmit() {
  submitting.value = true
  try {
    let execFn: () => Promise<any>
    if (isEdit.value) {
      const { data, execute, error } = usePut(ApiAiAgent.edit, form.value)
      execFn = async () => { await execute(); return { data, error } }
    } else {
      const { data, execute, error } = usePost(ApiAiAgent.add, form.value)
      execFn = async () => { await execute(); return { data, error } }
    }
    const { data, error } = await execFn()
    if (error.value || data.value === ErrorFlag) return
    Message.success(isEdit.value ? '编辑成功' : '添加成功')
    modalVisible.value = false
    fetchList()
  } finally {
    submitting.value = false
  }
}

// ── 删除 ──────────────────────────────────
async function handleDelete(record: AiAgent) {
  const { data, execute, error } = useDelete(ApiAiAgent.delete, { id: record.id })
  await execute()
  if (error.value || data.value === ErrorFlag) return
  Message.success('删除成功')
  fetchList()
}

// ── 健康检查 ──────────────────────────────────
const healthResult = ref<any>(null)
// 按行记录正在检查的 agent id。原先用一个全局 boolean，点任意一行的「健康检查」
// 会让表格里所有行的按钮同时进入 loading，看起来像"触发了所有 agent"。
const healthCheckingAgentId = ref('')
async function handleHealthCheck(record: AiAgent) {
  healthCheckingAgentId.value = record.id
  healthResult.value = null
  const { data, execute, error } = useGet<any>(ApiAiAgent.healthCheck, { id: record.id })
  await execute()
  healthCheckingAgentId.value = ''
  if (error.value || data.value === ErrorFlag) {
    Message.error('健康检查失败')
    return
  }
  healthResult.value = data.value
  if (data.value?.reachable) {
    Message.success(`${record.agent_name} 可达`)
  } else {
    Message.warning(`${record.agent_name} 不可达`)
  }
}

// ── CLI 模型探测与同步 ──────────────────────────────────
const syncingAgentId = ref('')

async function syncAgentModels(record: AiAgent, applyRecommendedTemplate = false, expectedUpdatedAt?: string) {
  if (syncingAgentId.value) {
    return
  }
  syncingAgentId.value = record.id
  try {
    const { data, execute, error } = usePost<AgentModelSyncResult>(ApiAiAgent.syncModels, {
      id: record.id,
      apply_recommended_template: applyRecommendedTemplate,
      expected_updated_at: expectedUpdatedAt,
    })
    await execute()
    const response = data.value as AgentModelSyncResult | string | null
    if (error.value || !response || response === ErrorFlag || typeof response === 'string') {
      Message.error('模型同步失败，请检查 Agent 路径、登录状态和服务端日志')
      return
    }

    const result = response
    Message.success(
      applyRecommendedTemplate
        ? `已同步 ${result.model_count} 个模型并更新执行命令`
        : `已从 ${result.cli_kind} CLI 同步 ${result.model_count} 个模型`,
    )
    await fetchList()
    // 列表刷新不会带动编辑弹窗里的 form —— 若正在编辑同一个 agent，
    // 「支持的模型 (JSON 数组)」还是打开弹窗那一刻的旧值，看起来像同步没生效。
    if (modalVisible.value && form.value.id === record.id) {
      form.value.supported_models_json = JSON.stringify(result.models)
      if (result.default_model)
        form.value.default_model = result.default_model
    }

    if (!applyRecommendedTemplate && result.recommended_invoke_template !== record.invoke_template) {
      Modal.confirm({
        title: '模型同步完成',
        content: '检测到当前执行命令与推荐模板不同。是否应用推荐模板？该操作会覆盖现有命令中的自定义 MCP、权限和其他参数；不确定时请选择“保留当前命令”。',
        okText: '应用推荐命令',
        cancelText: '保留当前命令',
        onOk: () => syncAgentModels(record, true, result.config_updated_at),
      })
    }
  }
  finally {
    syncingAgentId.value = ''
  }
}

// ── 表格列 ──────────────────────────────────
const columns = [
  { title: 'Agent Code', dataIndex: 'agent_code', width: 120 },
  { title: '名称', dataIndex: 'agent_name', width: 120 },
  { title: '可执行路径', dataIndex: 'executable_path', width: 260, ellipsis: true, tooltip: true },
  { title: '默认模型', dataIndex: 'default_model', width: 100 },
  { title: '最大并发', dataIndex: 'max_concurrent', width: 80 },
  { title: '超时(s)', dataIndex: 'max_timeout_secs', width: 80 },
  { title: '状态', dataIndex: 'status', width: 80, slotName: 'status' },
  { title: '操作', dataIndex: 'operations', slotName: 'operations', width: 300, fixed: 'right' as const },
]
</script>

<template>
  <div class="ai-agent-manage">
    <!-- 查询区 -->
    <a-card :bordered="false" class="m-b-8px">
      <a-row :gutter="16" align="center">
        <a-col :span="6">
          <a-input-search v-model="queryParams.agent_name" placeholder="搜索 Agent 名称" allow-clear @search="handleSearch" @press-enter="handleSearch" />
        </a-col>
        <a-col :span="4">
          <a-select v-model="queryParams.status" placeholder="状态" allow-clear @change="handleSearch">
            <a-option value="active">启用</a-option>
            <a-option value="disabled">禁用</a-option>
          </a-select>
        </a-col>
        <a-col :span="8">
          <a-space>
            <a-button type="primary" @click="handleSearch">搜索</a-button>
            <a-button type="primary" status="success" @click="handleAdd">
              <template #icon><icon-plus /></template>
              新增 Agent
            </a-button>
          </a-space>
        </a-col>
      </a-row>
    </a-card>

    <!-- 表格 -->
    <a-card :bordered="false">
      <a-table
        :loading="loading"
        :data="list"
        :columns="columns"
        row-key="id"
        :pagination="{ total, current: queryParams.page_num, pageSize: queryParams.page_size, showTotal: true }"
        @page-change="handlePageChange"
        :scroll="{ x: 1100 }"
      >
        <template #status="{ record }">
          <a-tag :color="record.status === 'active' ? 'green' : 'red'">{{ record.status === 'active' ? '启用' : '禁用' }}</a-tag>
        </template>
        <template #operations="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="handleEdit(record)">编辑</a-button>
            <a-button type="text" size="small" :loading="healthCheckingAgentId === record.id" @click="handleHealthCheck(record)">健康检查</a-button>
            <a-button type="text" size="small" :disabled="syncingAgentId === record.id" :loading="syncingAgentId === record.id" @click="syncAgentModels(record)">同步模型</a-button>
            <a-popconfirm content="确认删除该 Agent？" @ok="handleDelete(record)">
              <a-button type="text" size="small" status="danger">删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </a-table>
    </a-card>

    <!-- 健康检查结果 -->
    <a-card v-if="healthResult" :bordered="false" class="m-t-8px" title="健康检查结果">
      <a-descriptions :column="2" bordered size="small">
        <a-descriptions-item label="可达">{{ healthResult.reachable ? '是' : '否' }}</a-descriptions-item>
        <a-descriptions-item label="Exit Code">{{ healthResult.exit_code ?? '-' }}</a-descriptions-item>
        <a-descriptions-item label="stdout" :span="2">
          <pre class="health-output">{{ healthResult.stdout || healthResult.error || '-' }}</pre>
        </a-descriptions-item>
      </a-descriptions>
    </a-card>

    <!-- 新增/编辑弹窗 -->
    <a-modal v-model:visible="modalVisible" :title="isEdit ? '编辑 Agent' : '新增 Agent'" :width="720" :ok-loading="submitting" @ok="handleSubmit">
      <a-form :model="form" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="Agent Code" required><a-input v-model="form.agent_code" placeholder="如：kiro-cli" :disabled="isEdit" /></a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="显示名称" required><a-input v-model="form.agent_name" placeholder="如：Kiro CLI" /></a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="可执行文件路径" required><a-input v-model="form.executable_path" placeholder="如：/home/user/.local/bin/kiro-cli" /></a-form-item>
        <a-form-item label="命令模板 (JSON 数组)">
          <a-textarea v-model="form.invoke_template" :auto-size="{ minRows: 2, maxRows: 5 }" placeholder='["chat", "{prompt}", "--no-interactive", "-f", "json", "--model", "{model}"]' />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="支持的模型 (JSON 数组)">
              <a-textarea :model-value="form.supported_models_json ?? undefined" :auto-size="{ minRows: 1, maxRows: 3 }" placeholder='["auto","claude-sonnet-4"]' @update:model-value="(value: string) => { form.supported_models_json = value }" />
              <template #extra>列表中的“同步模型”会调用本机 CLI 自动更新，无需手工复制。</template>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="默认模型"><a-input :model-value="form.default_model ?? undefined" placeholder="auto" @update:model-value="(value: string) => { form.default_model = value }" /></a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8"><a-form-item label="最大超时(秒)"><a-input-number v-model="form.max_timeout_secs" :min="10" :max="3600" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="最大并发"><a-input-number v-model="form.max_concurrent" :min="1" :max="10" /></a-form-item></a-col>
          <a-col :span="8">
            <a-form-item label="状态">
              <a-select v-model="form.status"><a-option value="active">启用</a-option><a-option value="disabled">禁用</a-option></a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="健康检查命令"><a-input :model-value="form.health_check_cmd ?? undefined" placeholder="如：--help 或 --version" @update:model-value="(value: string) => { form.health_check_cmd = value }" /></a-form-item>
        <a-form-item label="技能挂载路径">
          <a-input :model-value="form.skill_mount_path ?? undefined" placeholder="如：.qoder/skills/{skill_code} 或 .kiro/skills/{skill_code}" @update:model-value="(value: string) => { form.skill_mount_path = value }" />
          <template #extra>执行时 Skill 文件会同步到 工作目录/{此路径} 下，{skill_code} 为占位符</template>
        </a-form-item>
        <a-form-item label="备注"><a-textarea :model-value="form.remark ?? undefined" :auto-size="{ minRows: 2, maxRows: 4 }" @update:model-value="(value: string) => { form.remark = value }" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.ai-agent-manage { padding: 0; }
.health-output { max-height: 200px; overflow: auto; font-size: 12px; white-space: pre-wrap; word-break: break-all; }
</style>
