<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useGet, usePost, usePut, useDelete } from '@/hooks'
import { ApiPerfModule, ApiSecProjectGroup } from '@/api/apis'
import * as XLSX from 'xlsx'

defineOptions({ name: 'PerfModuleMng' })

// ── 项目组列表（下拉选择用）────────────────────────────
const projectGroupOptions = ref<{ label: string; value: string }[]>([])
const projectGroupMap = ref<Map<string, string>>(new Map()) // id → name

async function loadProjectGroups() {
  const { execute, data } = useGet<any[]>(ApiSecProjectGroup.getAll, {}, { immediate: false })
  await execute()
  const list = data.value || []
  projectGroupOptions.value = list.map((pg: any) => ({ label: pg.name, value: pg.id }))
  projectGroupMap.value = new Map(list.map((pg: any) => [pg.id, pg.name]))
}
onMounted(() => loadProjectGroups())

// ── 列表查询 ──────────────────────────────────
const queryParams = ref({
  page_num: 1,
  page_size: 20,
  keyword: '',
  status: '',
  parent_cloud: '',
  material_type: '',
})

const { isFetching: isLoading, data: rawListData, execute: getList } = useGet<any>(ApiPerfModule.getList, queryParams, { immediate: true })
const dataList = computed(() => rawListData.value?.list || [])
const total = computed(() => rawListData.value?.total || 0)

function handleSearch() {
  queryParams.value.page_num = 1
  getList()
}
function handlePageChange(page: number) {
  queryParams.value.page_num = page
  getList()
}

const statusOptions = [
  { label: '全部', value: '' },
  { label: '可用', value: '可用' },
  { label: '不可用', value: '不可用' },
]

const columns = [
  { title: '名称', dataIndex: 'name', width: 180, ellipsis: true, tooltip: true },
  { title: '编码', dataIndex: 'code', width: 130, ellipsis: true, tooltip: true },
  { title: '状态', dataIndex: 'status', width: 80, slotName: 'status' },
  { title: '模块简码', dataIndex: 'module_code', width: 120, ellipsis: true, tooltip: true },
  { title: '关联项目组', dataIndex: 'scrum_team', width: 140, ellipsis: true, tooltip: true },
  { title: '物料简码', dataIndex: 'material_short_code', width: 120, ellipsis: true, tooltip: true },
  { title: '物料类型', dataIndex: 'material_type', width: 100, ellipsis: true, tooltip: true },
  { title: '所属云', dataIndex: 'parent_cloud', width: 120, ellipsis: true, tooltip: true },
  { title: '负责人', dataIndex: 'owner', width: 90, ellipsis: true, tooltip: true },
  { title: '操作', dataIndex: 'operations', slotName: 'operations', width: 140, fixed: 'right' as const },
]

// ── 新增/编辑弹窗 ──────────────────────────────────
const modalVisible = ref(false)
const isEdit = ref(false)
const form = ref<any>({})
const submitting = ref(false)

function handleAdd() {
  isEdit.value = false
  form.value = {
    name: '', code: '', status: '可用', module_code: '',
    scrum_team: '', project_group_id: '', product_group: '', owner: '', requirement_owner: '',
    offering_product: '', material_code: '', material_name: '',
    material_short_code: '', material_type: '', parent_cloud: '',
  }
  modalVisible.value = true
}

function handleEdit(record: any) {
  isEdit.value = true
  form.value = { ...record }
  // Arco select 需要 undefined 而非 null 才能正确回显
  form.value.project_group_id = record.project_group_id || undefined
  modalVisible.value = true
}

// 选择项目组时同步设置 scrum_team(名称) 和 project_group_id(ID)
function handleProjectGroupChange(pgId: string) {
  form.value.project_group_id = pgId || ''
  form.value.scrum_team = pgId ? (projectGroupMap.value.get(pgId) || '') : ''
}

async function handleSubmit() {
  if (!form.value.name) { Message.warning('请输入名称'); return }
  if (!form.value.code) { Message.warning('请输入编码'); return }
  if (!form.value.module_code) { Message.warning('请输入模块简码'); return }
  submitting.value = true
  try {
    if (isEdit.value) {
      const { execute, error } = usePut(ApiPerfModule.edit, form.value)
      await execute()
      if (error.value) { Message.error('编辑失败'); return }
      Message.success('编辑成功')
    } else {
      const { execute, error } = usePost(ApiPerfModule.add, form.value)
      await execute()
      if (error.value) { Message.error('添加失败'); return }
      Message.success('添加成功')
    }
    modalVisible.value = false
    getList()
  } finally {
    submitting.value = false
  }
}

// ── 删除 ──────────────────────────────────
async function handleDelete(record: any) {
  const { execute, error } = useDelete(ApiPerfModule.delete, { ids: [record.id] })
  await execute()
  if (error.value) { Message.error('删除失败'); return }
  Message.success('删除成功')
  getList()
}

// ── Excel 导入 ──────────────────────────────────
const fileInputRef = ref<HTMLInputElement | null>(null)
const importing = ref(false)

function handleImportClick() {
  fileInputRef.value?.click()
}

async function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  importing.value = true
  try {
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    // 列名映射：中文 → 英文字段
    const fieldMap: Record<string, string> = {
      '名称': 'name',
      '编码': 'code',
      '状态': 'status',
      '模块简码': 'module_code',
      '关联Scrum团队': 'scrum_team',
      '关联产品组': 'product_group',
      '负责人': 'owner',
      '需求负责人': 'requirement_owner',
      'offering产品': 'offering_product',
      '研发物料编码': 'material_code',
      '研发物料名称': 'material_name',
      '物料简码': 'material_short_code',
      '物料类型': 'material_type',
      '所属云': 'parent_cloud',
    }

    const modules: any[] = []
    let skipped = 0
    for (const row of rows) {
      const obj: any = {}
      for (const [cn, en] of Object.entries(fieldMap)) {
        if (row[cn] !== undefined && row[cn] !== '') {
          obj[en] = String(row[cn]).trim()
        } else {
          obj[en] = en === 'status' ? '可用' : (en === 'name' || en === 'code' || en === 'module_code' ? '' : null)
        }
      }
      // 仅导入模块简码非空的行
      if (!obj.module_code) {
        skipped++
        continue
      }
      // 确保 name 和 code 有值
      if (!obj.name) obj.name = obj.module_code
      if (!obj.code) obj.code = obj.module_code
      modules.push(obj)
    }

    if (modules.length === 0) {
      Message.warning(`没有可导入的数据（跳过 ${skipped} 条模块简码为空的行）`)
      return
    }

    const { execute, error, data: resp } = usePost<any>(ApiPerfModule.import, modules)
    await execute()
    if (error.value) {
      Message.error('导入失败')
      return
    }
    Message.success(`导入完成！共 ${modules.length} 条（跳过 ${skipped} 条空模块简码）`)
    getList()
  } catch (err) {
    Message.error('文件解析失败，请检查格式')
    console.error(err)
  } finally {
    importing.value = false
    // 重置 input 以便重复选择同一文件
    if (fileInputRef.value) fileInputRef.value.value = ''
  }
}
</script>

<template>
  <div class="perf-module-mng">
    <!-- 搜索栏 -->
    <a-card :bordered="false" class="m-b-8px">
      <a-row :gutter="16">
        <a-col :span="6">
          <a-input-search
            v-model="queryParams.keyword"
            placeholder="搜索名称/编码/模块简码"
            allow-clear
            @search="handleSearch"
            @press-enter="handleSearch"
          />
        </a-col>
        <a-col :span="4">
          <a-select v-model="queryParams.status" :options="statusOptions" placeholder="状态" allow-clear @change="handleSearch" />
        </a-col>
        <a-col :span="4">
          <a-input v-model="queryParams.parent_cloud" placeholder="所属云" allow-clear @press-enter="handleSearch" />
        </a-col>
        <a-col :span="4">
          <a-input v-model="queryParams.material_type" placeholder="物料类型" allow-clear @press-enter="handleSearch" />
        </a-col>
        <a-col :span="6">
          <a-space>
            <a-button type="primary" @click="handleSearch">搜索</a-button>
            <a-button type="primary" status="success" @click="handleAdd">
              <template #icon><icon-plus /></template>
              新增
            </a-button>
            <a-button type="primary" status="warning" :loading="importing" @click="handleImportClick">
              <template #icon><icon-upload /></template>
              Excel导入
            </a-button>
          </a-space>
        </a-col>
      </a-row>
    </a-card>

    <!-- 表格 -->
    <a-card :bordered="false">
      <a-table
        :loading="isLoading"
        :data="dataList"
        :columns="columns"
        :pagination="{ total, current: queryParams.page_num, pageSize: queryParams.page_size, showTotal: true, showPageSize: true }"
        row-key="id"
        @page-change="handlePageChange"
      >
        <template #status="{ record }">
          <a-tag :color="record.status === '可用' ? 'green' : 'red'">{{ record.status }}</a-tag>
        </template>
        <template #operations="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="handleEdit(record)">编辑</a-button>
            <a-popconfirm content="确认删除？删除后不可恢复" @ok="handleDelete(record)">
              <a-button type="text" size="small" status="danger">删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑弹窗 -->
    <a-modal v-model:visible="modalVisible" :title="isEdit ? '编辑模块' : '新增模块'" :width="720" :ok-loading="submitting" @ok="handleSubmit">
      <a-form :model="form" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="名称" required>
              <a-input v-model="form.name" placeholder="请输入名称" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="编码" required>
              <a-input v-model="form.code" placeholder="请输入编码" :disabled="isEdit" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="模块简码" required>
              <a-input v-model="form.module_code" placeholder="请输入模块简码" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="状态">
              <a-select v-model="form.status">
                <a-option value="可用">可用</a-option>
                <a-option value="不可用">不可用</a-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="关联项目组">
              <a-select
                v-model="form.project_group_id"
                :options="projectGroupOptions"
                placeholder="选择项目组"
                allow-clear
                allow-search
                @change="handleProjectGroupChange"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="关联产品组">
              <a-input v-model="form.product_group" placeholder="请输入" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="负责人">
              <a-input v-model="form.owner" placeholder="请输入" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="需求负责人">
              <a-input v-model="form.requirement_owner" placeholder="请输入" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="offering产品">
              <a-input v-model="form.offering_product" placeholder="请输入" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="所属云">
              <a-input v-model="form.parent_cloud" placeholder="请输入" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="研发物料编码">
              <a-input v-model="form.material_code" placeholder="请输入" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="物料简码">
              <a-input v-model="form.material_short_code" placeholder="请输入" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="物料类型">
              <a-input v-model="form.material_type" placeholder="请输入" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="研发物料名称">
          <a-input v-model="form.material_name" placeholder="请输入" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 隐藏的文件选择 input -->
    <input
      ref="fileInputRef"
      type="file"
      accept=".xlsx,.xls"
      style="display: none"
      @change="handleFileChange"
    />
  </div>
</template>

<style scoped>
.perf-module-mng { padding: 0; }
</style>
