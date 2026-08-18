<script setup lang="ts">
import type { ModuleWithRepository } from '@/types/static-scan'
import { computed, reactive, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import { ApiSecModuleRepository } from '@/api/sechubApis'
import { ApiPerfModule } from '@/api/perfApis'
import { useGet, usePost } from '@/hooks'

defineOptions({ name: 'StaticScanRepositories' })

// 加载已绑定仓库的模块列表
const { data: listData, isFetching: loading, execute: loadList } = useGet<ModuleWithRepository[]>(
  ApiSecModuleRepository.listWithModule,
  {},
  { immediate: true },
)
const rows = computed(() => listData.value ?? [])

// ===== 新增弹窗 =====
const addVisible = ref(false)
const addLoading = ref(false)
const addForm = reactive({
  module_id: '',
  code: '',
  name: '',
  git_url: '',
  default_branch: 'master',
  root_path: '',
  scan_enabled: true,
})

// 模块选项（从模块管理查询）
const moduleOptions = ref<{ id: string, name: string, code: string }[]>([])
const moduleLoading = ref(false)
async function loadModuleOptions() {
  moduleLoading.value = true
  try {
    const { data, execute } = useGet<any>(ApiPerfModule.getList, { page_num: 1, page_size: 500 }, { immediate: false })
    await execute()
    const list = data.value?.list ?? data.value ?? []
    moduleOptions.value = Array.isArray(list) ? list.map((m: any) => ({ id: m.id, name: m.name, code: m.module_code || m.code })) : []
  }
  finally {
    moduleLoading.value = false
  }
}

function openAddDialog() {
  addForm.module_id = ''
  addForm.code = ''
  addForm.name = ''
  addForm.git_url = ''
  addForm.default_branch = 'master'
  addForm.root_path = ''
  addForm.scan_enabled = true
  addVisible.value = true
  if (!moduleOptions.value.length) loadModuleOptions()
}

async function submitAdd() {
  if (!addForm.module_id) {
    Message.warning('请选择模块')
    return
  }
  if (!addForm.git_url) {
    Message.warning('请填写 Git URL')
    return
  }
  addLoading.value = true
  try {
    const { execute, error } = usePost(
      ApiSecModuleRepository.bind,
      {
        module_id: addForm.module_id,
        code: addForm.code || addForm.git_url.split('/').pop()?.replace('.git', '') || 'repo',
        name: addForm.name || addForm.code || addForm.git_url.split('/').pop()?.replace('.git', '') || 'repo',
        git_url: addForm.git_url,
        default_branch: addForm.default_branch || 'master',
        root_path: addForm.root_path || null,
        scan_enabled: addForm.scan_enabled,
        is_primary: true,
        allow_local_test_repository: false,
        idempotency_key: crypto.randomUUID(),
      },
      { immediate: false },
    )
    await execute()
    if (error.value) {
      Message.error('绑定失败')
      return
    }
    Message.success('代码仓库绑定成功')
    addVisible.value = false
    await loadList()
  }
  finally {
    addLoading.value = false
  }
}

const columns = [
  { title: '模块名称', dataIndex: 'module_name', width: 160 },
  { title: '模块简码', dataIndex: 'module_code', width: 120 },
  { title: '仓库名称', dataIndex: 'repository_name', width: 160 },
  { title: '仓库编码', dataIndex: 'repository_code', width: 120 },
  { title: 'Git URL', dataIndex: 'git_url', width: 280, ellipsis: true, tooltip: true },
  { title: '默认分支', dataIndex: 'default_branch', width: 100 },
  { title: '根路径', dataIndex: 'root_path', width: 120, ellipsis: true, tooltip: true },
  { title: '扫描启用', dataIndex: 'scan_enabled', slotName: 'scanEnabled', width: 90 },
  { title: '状态', dataIndex: 'status', slotName: 'status', width: 100 },
  { title: '操作', slotName: 'operations', width: 220, fixed: 'right' as const },
]

// ===== 过滤条件 =====
const keyword = ref('')
const statusFilter = ref('')
const filteredRows = computed(() => {
  let list = rows.value
  if (statusFilter.value) {
    list = list.filter(r => r.status === statusFilter.value)
  }
  const kw = keyword.value.trim().toLowerCase()
  if (kw) {
    list = list.filter(r =>
      r.module_name.toLowerCase().includes(kw)
      || r.repository_name.toLowerCase().includes(kw)
      || r.repository_code.toLowerCase().includes(kw)
      || r.git_url.toLowerCase().includes(kw),
    )
  }
  return list
})

// ===== 详情抽屉 =====
const detailVisible = ref(false)
const detailRecord = ref<ModuleWithRepository | null>(null)
function openDetail(record: ModuleWithRepository) {
  detailRecord.value = record
  detailVisible.value = true
}

const statusMap: Record<string, { label: string, color: string }> = {
  active: { label: '活跃', color: 'green' },
  validated: { label: '已验证', color: 'blue' },
  pending: { label: '待验证', color: 'orange' },
  error: { label: '异常', color: 'red' },
  disabled: { label: '禁用', color: 'gray' },
}

function statusInfo(status: string) {
  return statusMap[status] ?? { label: status, color: 'gray' }
}

// 验证仓库
const validatingId = ref('')
async function validateRepo(record: ModuleWithRepository) {
  validatingId.value = record.relation_id
  try {
    const { execute, error } = usePost(
      ApiSecModuleRepository.validate,
      {
        git_url: record.git_url,
        default_branch: record.default_branch,
        allow_local_test_repository: record.git_url.startsWith('local-test:'),
        idempotency_key: crypto.randomUUID(),
      },
      { immediate: false },
    )
    await execute()
    if (error.value) {
      Message.error(`验证失败: ${error.value.message || error.value}`)
      return
    }
    Message.success('已提交验证任务')
    await loadList()
  }
  finally {
    validatingId.value = ''
  }
}

// 触发源码快照
const snapshottingId = ref('')
async function triggerSnapshot(record: ModuleWithRepository) {
  snapshottingId.value = record.relation_id
  try {
    const { execute, error } = usePost(
      ApiSecModuleRepository.sourceSnapshot,
      {
        module_id: record.module_id,
        relation_id: record.relation_id,
        operation: 'update',
        revision: {},
        idempotency_key: crypto.randomUUID(),
      },
      { immediate: false },
    )
    await execute()
    if (error.value) {
      Message.error(`快照任务提交失败: ${error.value.message || error.value}`)
      return
    }
    Message.success('已提交源码快照任务')
  }
  finally {
    snapshottingId.value = ''
  }
}
</script>

<template>
  <div class="static-scan-repositories">
    <a-card :bordered="false" class="m-b-8px">
      <a-space wrap>
        <a-button type="primary" @click="openAddDialog">
          <template #icon>
            <icon-plus />
          </template>
          新增
        </a-button>
        <a-button :loading="loading" @click="loadList()">
          <template #icon>
            <icon-refresh />
          </template>
          刷新
        </a-button>
        <a-input-search
          v-model="keyword"
          placeholder="搜索模块/仓库/Git URL"
          allow-clear
          style="width: 240px"
        />
        <a-select v-model="statusFilter" placeholder="状态" allow-clear style="width: 120px">
          <a-option value="active">活跃</a-option>
          <a-option value="validated">已验证</a-option>
          <a-option value="pending">待验证</a-option>
          <a-option value="error">异常</a-option>
          <a-option value="disabled">禁用</a-option>
        </a-select>
        <a-typography-text type="secondary">
          共 {{ filteredRows.length }} 条
        </a-typography-text>
      </a-space>
    </a-card>

    <a-card :bordered="false">
      <a-table
        :data="filteredRows"
        :columns="columns"
        :loading="loading"
        :pagination="false"
        row-key="relation_id"
        :scroll="{ x: 1400 }"
      >
        <template #scanEnabled="{ record }">
          <a-tag :color="record.scan_enabled ? 'green' : 'gray'" size="small">
            {{ record.scan_enabled ? '启用' : '禁用' }}
          </a-tag>
        </template>

        <template #status="{ record }">
          <a-tag :color="statusInfo(record.status).color" size="small">
            {{ statusInfo(record.status).label }}
          </a-tag>
        </template>

        <template #operations="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="openDetail(record)">
              详情
            </a-button>
            <a-button
              type="text"
              size="small"
              :loading="validatingId === record.relation_id"
              @click="validateRepo(record)"
            >
              验证
            </a-button>
            <a-button
              type="text"
              size="small"
              :loading="snapshottingId === record.relation_id"
              @click="triggerSnapshot(record)"
            >
              快照
            </a-button>
          </a-space>
        </template>
      </a-table>
    </a-card>

    <!-- 新增代码仓库弹窗 -->
    <a-modal
      v-model:visible="addVisible"
      title="新增代码仓库"
      :ok-loading="addLoading"
      @ok="submitAdd"
      @cancel="addVisible = false"
    >
      <a-form :model="addForm" layout="vertical">
        <a-form-item label="模块" required>
          <a-select
            v-model="addForm.module_id"
            placeholder="选择模块"
            allow-search
            :loading="moduleLoading"
          >
            <a-option v-for="m in moduleOptions" :key="m.id" :value="m.id">
              {{ m.name }} ({{ m.code }})
            </a-option>
          </a-select>
        </a-form-item>
        <a-form-item label="仓库编码">
          <a-input v-model="addForm.code" placeholder="留空则自动从 Git URL 提取" />
        </a-form-item>
        <a-form-item label="仓库名称">
          <a-input v-model="addForm.name" placeholder="留空则自动从 Git URL 提取" />
        </a-form-item>
        <a-form-item label="Git URL" required>
          <a-input v-model="addForm.git_url" placeholder="https://git.example.com/group/repo.git" />
        </a-form-item>
        <a-form-item label="默认分支">
          <a-input v-model="addForm.default_branch" placeholder="master" />
        </a-form-item>
        <a-form-item label="根路径">
          <a-input v-model="addForm.root_path" placeholder="留空表示仓库根目录" />
        </a-form-item>
        <a-form-item label="启用扫描">
          <a-switch v-model="addForm.scan_enabled" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 详情抽屉 -->
    <a-drawer
      v-model:visible="detailVisible"
      title="代码仓库详情"
      :width="520"
      :footer="false"
    >
      <a-descriptions v-if="detailRecord" :column="1" bordered size="small">
        <a-descriptions-item label="模块名称">{{ detailRecord.module_name }}</a-descriptions-item>
        <a-descriptions-item label="模块简码">{{ detailRecord.module_code }}</a-descriptions-item>
        <a-descriptions-item label="项目组">{{ detailRecord.project_group_name }}</a-descriptions-item>
        <a-descriptions-item label="业务领域">{{ detailRecord.business_area }}</a-descriptions-item>
        <a-descriptions-item label="产品领域">{{ detailRecord.product_domain }}</a-descriptions-item>
        <a-descriptions-item label="仓库名称">{{ detailRecord.repository_name }}</a-descriptions-item>
        <a-descriptions-item label="仓库编码">{{ detailRecord.repository_code }}</a-descriptions-item>
        <a-descriptions-item label="Git URL">{{ detailRecord.git_url }}</a-descriptions-item>
        <a-descriptions-item label="默认分支">{{ detailRecord.default_branch }}</a-descriptions-item>
        <a-descriptions-item label="根路径">{{ detailRecord.root_path || '/' }}</a-descriptions-item>
        <a-descriptions-item label="扫描启用">
          <a-tag :color="detailRecord.scan_enabled ? 'green' : 'gray'" size="small">
            {{ detailRecord.scan_enabled ? '启用' : '禁用' }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="状态">
          <a-tag :color="statusInfo(detailRecord.status).color" size="small">
            {{ statusInfo(detailRecord.status).label }}
          </a-tag>
        </a-descriptions-item>
      </a-descriptions>
    </a-drawer>
  </div>
</template>

<style scoped>
.static-scan-repositories {
  padding: 16px;
}
</style>
