<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useGet, usePost, usePut, useDelete, useToken } from '@/hooks'
import { ApiAiSkill, ApiAiAgent, type AiSkill, type AiAgent, type AiSkillFile, type AiListResult, type AiSkillDeployStatus } from '@/api/aiApis'
import { ErrorFlag } from '@/api/apis'

defineOptions({ name: 'ai-skill-manage' })

// ── Agent 列表（供关联选择）──────────────────────────────────
const { data: agentListRaw } = useGet<AiListResult<AiAgent>>(ApiAiAgent.getList, { page_size: 100 }, { immediate: true })
const agentOptions = computed(() => (agentListRaw.value?.list || []).map((a: AiAgent) => ({ label: a.agent_name, value: a.id })))

// ── 列表数据 ──────────────────────────────────
const queryParams = ref({ skill_name: '', agent_id: '', status: '', page_num: 1, page_size: 10 })
const { isFetching: loading, data: listRaw, execute: fetchList } = useGet<AiListResult<AiSkill>>(
  ApiAiSkill.getList,
  queryParams,
  { immediate: true },
)
const list = computed(() => listRaw.value?.list || [])
const total = computed(() => listRaw.value?.total || 0)

function handleSearch() { queryParams.value.page_num = 1; fetchList() }
function handlePageChange(page: number) { queryParams.value.page_num = page; fetchList() }

function getAgentName(agentId: string | null) {
  if (!agentId) return '-'
  const agent = agentListRaw.value?.list?.find((a: AiAgent) => a.id === agentId)
  return agent?.agent_name || agentId
}

// ── 技能部署（P6-01/P6-02） ──────────────────────────────────
const deployStatusMap = ref<Record<string, AiSkillDeployStatus>>({})
const deployLoadingId = ref<string | null>(null)

// 列表变化后刷新部署状态
watch(list, async (rows) => {
  for (const row of rows) {
    if (deployStatusMap.value[row.id]) continue
    const { data, execute, error } = useGet<AiSkillDeployStatus>(ApiAiSkill.deployStatus, { id: row.id }, { immediate: false })
    await execute()
    if (!error.value && data.value) deployStatusMap.value[row.id] = data.value
  }
})

function deployStateTag(state?: string) {
  if (state === 'deployed') return { color: 'green', label: '已部署' }
  if (state === 'stale') return { color: 'orange', label: '过期' }
  return { color: 'gray', label: '未部署' }
}

async function handleDeploy(record: AiSkill) {
  deployLoadingId.value = record.id
  try {
    const { data, execute, error } = usePost(ApiAiSkill.deploy, { skill_id: record.id, deploy_dir: null })
    await execute()
    if (error.value || data.value === ErrorFlag) return
    Message.success('部署成功')
    const { data: status, execute: execStatus, error: statusErr } = useGet<AiSkillDeployStatus>(ApiAiSkill.deployStatus, { id: record.id }, { immediate: false })
    await execStatus()
    if (!statusErr.value && status.value) deployStatusMap.value[record.id] = status.value
  } finally {
    deployLoadingId.value = null
  }
}

// ── 新增/编辑弹窗 ──────────────────────────────────
const modalVisible = ref(false)
const isEdit = ref(false)
type SkillForm = Omit<Partial<AiSkill>, 'description' | 'agent_id' | 'work_dir_path' | 'required_env_json' | 'tags_json' | 'remark'> & {
  description?: string
  agent_id?: string
  work_dir_path?: string
  required_env_json?: string
  tags_json?: string
  remark?: string
}
const form = ref<SkillForm>({})
const submitting = ref(false)

function handleAdd() {
  isEdit.value = false
  form.value = {
    skill_code: '', skill_name: '', description: '', agent_id: undefined, prompt_template: '',
    work_dir_type: 'temp', work_dir_path: '', required_env_json: '', input_schema_json: '',
    output_format: 'json', output_path_pattern: '', tags_json: '[]', status: 'active', remark: '',
  }
  modalVisible.value = true
}

function handleEdit(record: AiSkill) {
  isEdit.value = true
  form.value = {
    ...record,
    description: record.description ?? undefined,
    agent_id: record.agent_id ?? undefined,
    work_dir_path: record.work_dir_path ?? undefined,
    required_env_json: record.required_env_json ?? undefined,
    tags_json: record.tags_json ?? undefined,
    remark: record.remark ?? undefined,
  }
  modalVisible.value = true
}

async function handleSubmit() {
  submitting.value = true
  try {
    let execFn: () => Promise<any>
    if (isEdit.value) {
      const { data, execute, error } = usePut(ApiAiSkill.edit, form.value)
      execFn = async () => { await execute(); return { data, error } }
    } else {
      const { data, execute, error } = usePost(ApiAiSkill.add, form.value)
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
async function handleDelete(record: AiSkill) {
  const { data, execute, error } = useDelete(ApiAiSkill.delete, { id: record.id })
  await execute()
  if (error.value || data.value === ErrorFlag) return
  Message.success('删除成功')
  fetchList()
}

// ── 文件管理 ──────────────────────────────────
const skillFiles = ref<AiSkillFile[]>([])
const filesLoading = ref(false)
const uploading = ref(false)

async function fetchFiles(skillId: string) {
  filesLoading.value = true
  try {
    const { token } = useToken()
    const resp = await fetch(import.meta.env.VITE_API_BASE_URL + ApiAiSkill.fileList + `?skill_id=${skillId}`, {
      headers: { Authorization: token },
    })
    const res = await resp.json()
    skillFiles.value = res?.data || []
  } catch { skillFiles.value = [] }
  finally { filesLoading.value = false }
}

async function handleFileUpload(file: File) {
  if (!form.value.id) { Message.warning('请先保存 Skill 再上传文件'); return false }
  uploading.value = true
  try {
    const { token } = useToken()
    const formData = new FormData()
    formData.append('skill_id', form.value.id)
    formData.append('file', file)
    const resp = await fetch(import.meta.env.VITE_API_BASE_URL + ApiAiSkill.fileUpload, {
      method: 'POST',
      body: formData,
      headers: { Authorization: token },
    })
    const data = await resp.json()
    if (data?.code === 200) {
      Message.success(`文件 ${file.name} 上传成功`)
      fetchFiles(form.value.id!)
    } else {
      Message.error(data?.msg || '上传失败')
    }
  } catch (e: any) {
    Message.error(e?.message || '上传失败')
  } finally { uploading.value = false }
  return false // 阻止默认上传
}

async function handleFileDelete(file: AiSkillFile) {
  const { data, execute, error } = useDelete(ApiAiSkill.fileDelete, { id: file.id })
  await execute()
  if (error.value || data.value === ErrorFlag) return
  Message.success('文件已删除')
  if (form.value.id) fetchFiles(form.value.id)
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// 编辑时加载文件列表
watch(modalVisible, (v) => {
  if (v && isEdit.value && form.value.id) fetchFiles(form.value.id)
  if (!v) skillFiles.value = []
})

// ── 表格列 ──────────────────────────────────
const columns = [
  { title: 'Skill Code', dataIndex: 'skill_code', width: 140 },
  { title: '名称', dataIndex: 'skill_name', width: 140 },
  { title: '关联 Agent', dataIndex: 'agent_id', width: 120, slotName: 'agent' },
  { title: '工作目录类型', dataIndex: 'work_dir_type', width: 110 },
  { title: '版本', dataIndex: 'version', width: 60 },
  { title: '状态', dataIndex: 'status', width: 80, slotName: 'status' },
  { title: '部署状态', dataIndex: 'deploy', width: 100, slotName: 'deploy' },
  { title: '操作', dataIndex: 'operations', slotName: 'operations', width: 190, fixed: 'right' as const },
]
</script>

<template>
  <div class="ai-skill-manage">
    <!-- 查询区 -->
    <a-card :bordered="false" class="m-b-8px">
      <a-row :gutter="16" align="center">
        <a-col :span="6">
          <a-input-search v-model="queryParams.skill_name" placeholder="搜索 Skill 名称" allow-clear @search="handleSearch" @press-enter="handleSearch" />
        </a-col>
        <a-col :span="5">
          <a-select v-model="queryParams.agent_id" placeholder="按 Agent 过滤" allow-clear @change="handleSearch">
            <a-option v-for="opt in agentOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</a-option>
          </a-select>
        </a-col>
        <a-col :span="4">
          <a-select v-model="queryParams.status" placeholder="状态" allow-clear @change="handleSearch">
            <a-option value="active">启用</a-option>
            <a-option value="disabled">禁用</a-option>
            <a-option value="draft">草稿</a-option>
          </a-select>
        </a-col>
        <a-col :span="6">
          <a-space>
            <a-button type="primary" @click="handleSearch">搜索</a-button>
            <a-button type="primary" status="success" @click="handleAdd">
              <template #icon><icon-plus /></template>
              新增 Skill
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
        :scroll="{ x: 900 }"
      >
        <template #agent="{ record }">{{ getAgentName(record.agent_id) }}</template>
        <template #status="{ record }">
          <a-tag :color="record.status === 'active' ? 'green' : record.status === 'draft' ? 'orange' : 'red'">
            {{ record.status === 'active' ? '启用' : record.status === 'draft' ? '草稿' : '禁用' }}
          </a-tag>
        </template>
        <template #deploy="{ record }">
          <a-tooltip :content="deployStatusMap[record.id]?.deployed_dir || ''" position="top">
            <a-tag :color="deployStateTag(deployStatusMap[record.id]?.state).color">
              {{ deployStateTag(deployStatusMap[record.id]?.state).label }}
            </a-tag>
          </a-tooltip>
        </template>
        <template #operations="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="handleEdit(record)">编辑</a-button>
            <a-button type="text" size="small" :loading="deployLoadingId === record.id" @click="handleDeploy(record)">部署</a-button>
            <a-popconfirm content="确认删除该 Skill？" @ok="handleDelete(record)">
              <a-button type="text" size="small" status="danger">删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑弹窗 -->
    <a-modal v-model:visible="modalVisible" :title="isEdit ? '编辑 Skill' : '新增 Skill'" :width="820" :ok-loading="submitting" @ok="handleSubmit">
      <a-tabs :default-active-key="'basic'">
        <a-tab-pane key="basic" title="基本配置">
          <a-form :model="form" layout="vertical">
            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item label="Skill Code" required><a-input v-model="form.skill_code" placeholder="如：trace-analysis" :disabled="isEdit" /></a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="显示名称" required><a-input v-model="form.skill_name" placeholder="如：慢Trace分析" /></a-form-item>
              </a-col>
            </a-row>
            <a-form-item label="功能描述"><a-textarea v-model="form.description" :auto-size="{ minRows: 2, maxRows: 4 }" /></a-form-item>
            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item label="关联 Agent">
                  <a-select v-model="form.agent_id" placeholder="选择 Agent" allow-clear>
                    <a-option v-for="opt in agentOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</a-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="状态">
                  <a-select v-model="form.status"><a-option value="active">启用</a-option><a-option value="disabled">禁用</a-option><a-option value="draft">草稿</a-option></a-select>
                </a-form-item>
              </a-col>
            </a-row>
            <a-form-item label="Prompt 模板">
              <a-textarea v-model="form.prompt_template" :auto-size="{ minRows: 4, maxRows: 12 }" placeholder="使用 {{variable}} 作为变量占位符。若已上传文件可不填，执行时将自动使用默认指令" />
            </a-form-item>
            <a-row :gutter="16">
              <a-col :span="8">
                <a-form-item label="工作目录类型">
                  <a-select v-model="form.work_dir_type">
                    <a-option value="fixed">固定路径</a-option>
                    <a-option value="caller">调用方指定</a-option>
                    <a-option value="temp">临时目录</a-option>
                  </a-select>
                </a-form-item>
              </a-col>
              <a-col :span="16">
                <a-form-item label="工作目录路径 (fixed 时必填)">
                  <a-input v-model="form.work_dir_path" placeholder="如：/home/user/projects/xxx" :disabled="form.work_dir_type !== 'fixed'" />
                </a-form-item>
              </a-col>
            </a-row>
            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item label="输出格式">
                  <a-select v-model="form.output_format"><a-option value="json">JSON</a-option><a-option value="markdown">Markdown</a-option><a-option value="file">文件</a-option></a-select>
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="标签 (JSON 数组)"><a-input v-model="form.tags_json" placeholder='["性能","日志"]' /></a-form-item>
              </a-col>
            </a-row>
            <a-form-item label="环境变量 (JSON)">
              <a-textarea v-model="form.required_env_json" :auto-size="{ minRows: 1, maxRows: 3 }" placeholder='{"PYTHONPATH":"src"}' />
            </a-form-item>
            <a-form-item label="备注"><a-textarea v-model="form.remark" :auto-size="{ minRows: 2, maxRows: 4 }" /></a-form-item>
          </a-form>
        </a-tab-pane>

        <a-tab-pane key="files" title="文件管理">
          <div v-if="!isEdit" class="p-16px text-center">
            <a-empty description="新增 Skill 请先保存基本信息，保存后可编辑文件" />
          </div>
          <div v-else>
            <div class="m-b-12px">
              <a-upload
                :auto-upload="false"
                :show-file-list="false"
                @change="(files: any) => { if (files?.[0]?.file) handleFileUpload(files[0].file) }"
              >
                <template #upload-button>
                  <a-button type="primary" :loading="uploading">
                    <template #icon><icon-upload /></template>
                    上传文件
                  </a-button>
                </template>
              </a-upload>
              <span class="m-l-12px color-gray text-12px">文件将在执行时自动同步到工作目录</span>
            </div>
            <a-table :data="skillFiles" :loading="filesLoading" :pagination="false" size="small" row-key="id">
              <template #columns>
                <a-table-column title="文件名" data-index="file_name" :width="200" ellipsis />
                <a-table-column title="大小" data-index="file_size" :width="100">
                  <template #cell="{ record }">{{ formatFileSize(record.file_size) }}</template>
                </a-table-column>
                <a-table-column title="类型" data-index="content_type" :width="120" ellipsis />
                <a-table-column title="上传时间" data-index="created_at" :width="170" />
                <a-table-column title="操作" :width="80" fixed="right">
                  <template #cell="{ record }">
                    <a-popconfirm content="确认删除该文件？" @ok="handleFileDelete(record)">
                      <a-button type="text" size="small" status="danger">删除</a-button>
                    </a-popconfirm>
                  </template>
                </a-table-column>
              </template>
            </a-table>
          </div>
        </a-tab-pane>
      </a-tabs>
    </a-modal>
  </div>
</template>

<style scoped>
.ai-skill-manage { padding: 0; }
</style>
