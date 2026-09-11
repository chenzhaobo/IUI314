<script setup lang="ts">
/**
 * 安全扫描 — 扫描任务列表
 *
 * 对应后端 `/sechub/scan/tasks`（api/src/sechub/scan_task.rs + service/sec_task.rs）：
 *   - 列表：GET /sechub/scan/tasks（page_num / page_size / keyword / filters）
 *   - 新建：POST /sechub/scan/tasks（body 为完整 SecSecTaskModel）
 *   - 编辑：PUT /sechub/scan/tasks/{id}
 *   - 删除：POST /sechub/scan/tasks/{id}/delete
 *   - 执行：POST /sechub/scan/tasks/{id}/run（生成一条运行记录）
 */
import { Message, Modal } from '@arco-design/web-vue'
import { computed, reactive, ref } from 'vue'

import { ApiSecScan, ApiSecTestEnv, resolveStaticScanApi } from '@/api/sechubApis'
import ListPage from '@/components/common/ListPage.vue'
import { formatTime, postAction, putAction, useGet } from '@/hooks'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive :include 按它对上缓存
// （见 components/layout/app-main.vue 的注释）。lint 的 PascalCase 提示只是警告，
// 改名却会让页签缓存失效，所以此处保持 kebab-case。
// 注意：scan-tasks 段名已被「静态扫描→定时扫描任务」占用（路由 name 全局唯一），
// 故此处用 scan-task-list。
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'scan-task-list' })

// ── 测试类型 ──────────────────────────────────────
// 与 sec_sec_task.test_types 的 JSON 数组取值一一对应（设计文档 §3.1）
const TEST_TYPE_OPTIONS = [
  { value: 'form_perm', label: '表单权限测试' },
  { value: 'xss', label: 'XSS注入' },
  { value: 'sqli', label: 'SQL注入' },
  { value: 'java_reflect', label: 'Java反射注入' },
  { value: 'openapi', label: 'OpenAPI测试' },
  { value: 'script', label: 'Python脚本' },
]

// ── 执行状态 ──────────────────────────────────────
// 取值域与 sec_sec_run.status 一致：pending/running/success/failed/partial/cancelled
// （迁移脚本 sec_sec_run.sql 注释），列表冗余字段 last_run_status 同域
const RUN_STATUS: Record<string, { label: string, color: string }> = {
  pending: { label: '待执行', color: 'gray' },
  running: { label: '运行中', color: 'blue' },
  success: { label: 'PASS', color: 'green' },
  failed: { label: 'FAIL', color: 'red' },
  partial: { label: '部分通过', color: 'orange' },
  cancelled: { label: '已取消', color: 'gray' },
}

/** 存在未结束的运行记录时不允许再次触发（service/sec_run.rs 的重复检测） */
const ACTIVE_STATUSES = ['pending', 'running']

function runStatusMeta(status?: string | null) {
  return RUN_STATUS[status || ''] ?? { label: status || '--', color: 'gray' }
}

// ── 筛选 ──────────────────────────────────────────
const searchForm = reactive({
  keyword: '',
  last_run_status: '',
})

const pageNum = ref(1)
const pageSize = ref(20)

/**
 * `filters` 是后端 dyn_filter 的通用筛选协议：JSON 数组字符串，
 * 每项 `{field, op, value}`，`field` 必须能在实体 Column 上解析出来，
 * 否则后端直接报错（db/src/common/dyn_filter.rs）。这里只用于状态精确匹配。
 */
const queryParams = computed(() => ({
  page_num: pageNum.value,
  page_size: pageSize.value,
  keyword: searchForm.keyword,
  filters: searchForm.last_run_status
    ? JSON.stringify([{ field: 'last_run_status', op: 'eq', value: searchForm.last_run_status }])
    : '',
}))

const {
  isFetching: loading,
  data: rawData,
  execute: fetchData,
} = useGet<any>(ApiSecScan.taskList, queryParams, { immediate: true })

const tableData = computed(() => rawData.value?.list || [])
const pagination = computed(() => ({
  current: pageNum.value,
  pageSize: pageSize.value,
  total: rawData.value?.total || 0,
  showTotal: true,
  showPageSize: true,
}))

// ── 环境下拉：任务存 env_id，列表里要显示环境名称 ──────────────
const { data: envRes } = useGet<any>(ApiSecTestEnv.getList, { page_num: 1, page_size: 200 }, { immediate: true })
const envOptions = computed(() => {
  const list = envRes.value?.list
  return (Array.isArray(list) ? list : []).map((e: any) => ({
    value: e.id,
    label: e.env_name ? `${e.env_name}（${e.env_type || e.id}）` : e.id,
  }))
})
function envName(id?: string | null) {
  return id ? envOptions.value.find(o => o.value === id)?.label || id : '--'
}

// ── 测试类型展示：库里存 JSON 字符串，展示成「权限 + XSS」这种可读形式 ──
function testTypesText(raw?: string | null): string {
  if (!raw)
    return '--'
  try {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr) || !arr.length)
      return '--'
    return arr.map((v: string) => TEST_TYPE_OPTIONS.find(o => o.value === v)?.label || v).join(' + ')
  }
  catch {
    // 存量脏数据不是合法 JSON 时原样展示，不要显示成空
    return raw
  }
}

// ── 新建 / 编辑 ───────────────────────────────────
const modalVisible = ref(false)
const modalLoading = ref(false)
const editingId = ref('')
const editingRecord = ref<any>(null)

const form = reactive({
  name: '',
  description: '',
  env_id: '',
  test_types: [] as string[],
  scope: '',
})

function openAdd() {
  editingId.value = ''
  editingRecord.value = null
  form.name = ''
  form.description = ''
  form.env_id = ''
  form.test_types = TEST_TYPE_OPTIONS.map(o => o.value)
  form.scope = ''
  modalVisible.value = true
}

function openEdit(record: any) {
  editingId.value = record.id
  editingRecord.value = record
  form.name = record.name || ''
  form.description = record.description || ''
  form.env_id = record.env_id || ''
  form.scope = record.scope || ''
  try {
    const arr = JSON.parse(record.test_types || '[]')
    form.test_types = Array.isArray(arr) ? arr : []
  }
  catch {
    form.test_types = []
  }
  modalVisible.value = true
}

async function handleSubmit() {
  if (!form.name.trim()) {
    Message.warning('请填写扫描名称')
    return
  }
  if (!form.test_types.length) {
    Message.warning('请至少选择一种测试类型')
    return
  }

  const base = {
    name: form.name.trim(),
    description: form.description || null,
    env_id: form.env_id || null,
    test_types: JSON.stringify(form.test_types),
    scope: form.scope || null,
  }

  modalLoading.value = true
  try {
    if (editingId.value) {
      // 后端 PUT 的 body 是完整 SecSecTaskModel（Rust 端 id/name/test_types/status/create_by
      // 是非 Option 字段，缺一项就反序列化失败），所以必须带上原记录里的其余字段
      const payload = { ...editingRecord.value, ...base }
      const res = await putAction<string>(resolveStaticScanApi(ApiSecScan.taskById, { id: editingId.value }), payload)
      if (res === null)
        return
      Message.success('已保存')
    }
    else {
      const res = await postAction<string>(ApiSecScan.taskList, {
        ...base,
        id: '',
        account_overrides: null,
        schedule_cron: null,
        status: 'active',
        last_run_id: null,
        last_run_status: null,
        last_run_at: null,
        create_by: '',
      })
      if (res === null)
        return
      Message.success('创建成功')
    }
    modalVisible.value = false
    await fetchData()
  }
  finally {
    modalLoading.value = false
  }
}

// ── 执行 ──────────────────────────────────────────
// 后端按「任务名-时间戳」自动生成 run_name（service/sec_run.rs），
// 请求体里没有 run_name 参数，所以这里不做运行名称编辑，只做确认。
function handleRun(record: any) {
  Modal.confirm({
    title: '执行扫描',
    content: `确认执行「${record.name}」？将创建一条新的运行记录，运行名称由平台自动生成。`,
    okText: '执行',
    cancelText: '取消',
    onOk: async () => {
      const res = await postAction<string>(resolveStaticScanApi(ApiSecScan.taskRun, { id: record.id }), {})
      if (res === null)
        return
      Message.success('已创建运行记录，进度与结果见「执行记录」')
      await fetchData()
    },
  })
}

// ── 删除 ──────────────────────────────────────────
function handleDelete(record: any) {
  Modal.confirm({
    title: '删除任务',
    content: `确认删除「${record.name}」？删除后该任务不再出现在列表中，已产生的执行记录不受影响。`,
    okText: '删除',
    cancelText: '取消',
    onOk: async () => {
      const res = await postAction<string>(resolveStaticScanApi(ApiSecScan.taskDelete, { id: record.id }))
      if (res === null)
        return
      Message.success('删除成功')
      await fetchData()
    },
  })
}

// ── 分页 / 查询 ───────────────────────────────────
function handleSearch() {
  pageNum.value = 1
  fetchData()
}

function handleReset() {
  searchForm.keyword = ''
  searchForm.last_run_status = ''
  handleSearch()
}

function handlePageChange(page: number) {
  pageNum.value = page
  fetchData()
}

// 改每页条数必须同时回到第 1 页：停在第 5 页时改大条数，该页往往已超出总页数，
// 后端返回空列表，看起来像"数据没了"
function handlePageSizeChange(size: number) {
  pageSize.value = size
  pageNum.value = 1
  fetchData()
}
</script>

<template>
  <div>
    <ListPage>
      <!--
        筛选区。Arco 的 Input / Select 是 inheritAttrs: false，class 不会落到根节点上，
        所以每个控件都要包一层原生 div 来给宽度（见 IssueList.vue 的注释）。
      -->
      <template #filter>
        <div class="filter-bar">
          <div class="f-wide">
            <a-input
              v-model="searchForm.keyword"
              placeholder="任务名称 / 描述"
              allow-clear
              @press-enter="handleSearch"
              @clear="handleSearch"
            />
          </div>
          <div class="f-mid">
            <a-select v-model="searchForm.last_run_status" placeholder="最新状态" allow-clear @change="handleSearch">
              <a-option value="success">
                PASS
              </a-option>
              <a-option value="failed">
                FAIL
              </a-option>
              <a-option value="running">
                运行中
              </a-option>
            </a-select>
          </div>
          <a-button type="primary" @click="handleSearch">
            查询
          </a-button>
          <a-button @click="handleReset">
            重置
          </a-button>
        </div>
      </template>

      <template #toolbar>
        <!-- 新建是全局动作，推到工具行右端，与选中行操作分开 -->
        <div class="toolbar-spacer" />
        <a-button type="primary" @click="openAdd">
          新建扫描
        </a-button>
      </template>

      <template #default="{ tableHeight }">
        <a-table
          :data="tableData"
          :loading="loading"
          :pagination="pagination"
          :scroll="{ minWidth: 1000, y: tableHeight }"
          row-key="id"
          @page-change="handlePageChange"
          @page-size-change="handlePageSizeChange"
        >
          <template #columns>
            <a-table-column title="任务名称" data-index="name" :width="220" ellipsis tooltip />
            <a-table-column title="测试类型" data-index="test_types" :width="220" ellipsis tooltip>
              <template #cell="{ record }">
                {{ testTypesText(record.test_types) }}
              </template>
            </a-table-column>
            <a-table-column title="环境" data-index="env_id" :width="150" ellipsis tooltip>
              <template #cell="{ record }">
                {{ envName(record.env_id) }}
              </template>
            </a-table-column>
            <a-table-column title="最新状态" data-index="last_run_status" :width="90">
              <template #cell="{ record }">
                <a-tag v-if="record.last_run_status" :color="runStatusMeta(record.last_run_status).color">
                  {{ runStatusMeta(record.last_run_status).label }}
                </a-tag>
                <span v-else class="muted-text">未执行</span>
              </template>
            </a-table-column>
            <a-table-column title="最近执行时间" data-index="last_run_at" :width="160">
              <template #cell="{ record }">
                {{ formatTime(record.last_run_at) }}
              </template>
            </a-table-column>
            <a-table-column title="操作" :width="150" fixed="right">
              <template #cell="{ record }">
                <a-space>
                  <a-link @click="openEdit(record)">
                    编辑
                  </a-link>
                  <a-popconfirm content="确认删除该任务？" @ok="handleDelete(record)">
                    <a-link status="danger">
                      删除
                    </a-link>
                  </a-popconfirm>
                  <!-- 同一任务存在未结束的运行记录时后端会拒绝再次触发，
                       提前禁用比让用户点了再看报错更清楚。
                       Tooltip 包一层 span：禁用态的元素在部分浏览器里不派发鼠标事件，
                       直接挂在链接上时提示出不来。 -->
                  <a-tooltip :content="ACTIVE_STATUSES.includes(record.last_run_status) ? '存在未结束的运行记录，需等待完成或先取消' : '创建一条新的运行记录'">
                    <span>
                      <a-link
                        status="success"
                        :disabled="ACTIVE_STATUSES.includes(record.last_run_status)"
                        @click="handleRun(record)"
                      >
                        执行
                      </a-link>
                    </span>
                  </a-tooltip>
                </a-space>
              </template>
            </a-table-column>
          </template>
        </a-table>
      </template>
    </ListPage>

    <!-- 新建 / 编辑 -->
    <a-modal
      v-model:visible="modalVisible"
      :title="editingId ? '编辑扫描任务' : '新建扫描任务'"
      :width="680"
      :ok-loading="modalLoading"
      @ok="handleSubmit"
    >
      <a-form :model="form" layout="vertical">
        <a-form-item label="扫描名称" required>
          <a-input v-model="form.name" placeholder="如：财务V3.2发版安检" :max-length="200" />
        </a-form-item>
        <a-form-item label="描述">
          <a-textarea
            v-model="form.description"
            placeholder="任务用途、覆盖范围说明"
            :auto-size="{ minRows: 2, maxRows: 4 }"
          />
        </a-form-item>
        <a-form-item label="目标环境">
          <a-select v-model="form.env_id" placeholder="选择测试环境" allow-clear allow-search>
            <a-option v-for="env in envOptions" :key="env.value" :value="env.value">
              {{ env.label }}
            </a-option>
          </a-select>
        </a-form-item>
        <a-form-item label="测试类型" required>
          <a-checkbox-group v-model="form.test_types" :options="TEST_TYPE_OPTIONS" />
        </a-form-item>
        <a-form-item label="范围">
          <a-textarea
            v-model="form.scope"
            placeholder="可选：限定要扫描的项目组 / 应用 / 表单，留空表示全部范围"
            :auto-size="{ minRows: 2, maxRows: 4 }"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
/* 筛选区：按需宽度 + 放不下自动换行（与 IssueList.vue 一致） */
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

/*
  宽度必须落在包裹 div 上：Arco 的 Input / Select 是 inheritAttrs: false，
  直接给组件写 class 不会生效，控件会保持 width: 100% 在 flex 里各占一行。
*/
.f-wide {
  width: 240px;
}
.f-mid {
  width: 150px;
}

/* 控件填满它的包裹 div */
.filter-bar > div :deep(.arco-select),
.filter-bar > div :deep(.arco-input-wrapper) {
  width: 100%;
}

/* 把新建按钮推到工具行右端（工具行本身的 flex 由 ListPage 提供） */
.toolbar-spacer {
  flex: 1;
}

.muted-text {
  color: var(--color-text-4);
  font-size: 12px;
}
</style>
