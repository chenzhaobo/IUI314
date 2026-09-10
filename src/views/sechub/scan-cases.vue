<script setup lang="ts">
/**
 * 安全扫描 — 用例管理
 *
 * 对应后端 `/sechub/scan/cases`（api/src/sechub/scan_task.rs + service/sec_case.rs）：
 *   - 列表：GET /sechub/scan/cases（page_num / page_size / keyword / filters）
 *   - 删除：POST /sechub/scan/cases/{id}/delete（软删除）
 *
 * 用例主要由任务执行时自动生成（auto_generated），本页只做查看与删除，
 * 新增入口在任务详情里（需要用例归属到任务）。
 */
import { Message, Modal } from '@arco-design/web-vue'
import { computed, reactive, ref } from 'vue'

import { ApiSecScan, resolveStaticScanApi } from '@/api/sechubApis'
import ListPage from '@/components/common/ListPage.vue'
import { postAction, useGet } from '@/hooks'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive :include 按它对上缓存
// （见 components/layout/app-main.vue 的注释）。lint 的 PascalCase 提示只是警告，
// 改名却会让页签缓存失效，所以此处保持 kebab-case。
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'scan-cases' })

// ── 用例类型（sec_sec_case.case_type）─────────────
const CASE_TYPE_OPTIONS = [
  { value: 'form_perm', label: '表单权限' },
  { value: 'form_inject', label: '表单注入' },
  { value: 'openapi_perm', label: 'OpenAPI权限' },
  { value: 'openapi_inject', label: 'OpenAPI注入' },
  { value: 'script', label: 'Python脚本' },
]

// ── 测试类型（sec_sec_case.test_type）─────────────
const TEST_TYPE_LABELS: Record<string, string> = {
  perm: '权限',
  xss: 'XSS注入',
  sqli: 'SQL注入',
  java_reflect: 'Java反射',
  idor: '越权(IDOR)',
  base: '正向基线',
  robustness: '健壮性',
}

// ── 测试角色 / 执行方式 ───────────────────────────
const TEST_ROLE_LABELS: Record<string, string> = {
  ALL: '全量(ALL)',
  LIM: '受限(LIM)',
  NONE: '无权限(NONE)',
}
const EXEC_MODE_LABELS: Record<string, string> = {
  orchestration: '平台编排',
  python: 'Python脚本',
  hybrid: '混合',
}

const caseTypeText = (v?: string | null) => (v ? CASE_TYPE_OPTIONS.find(o => o.value === v)?.label || v : '--')
const testTypeText = (v?: string | null) => (v ? TEST_TYPE_LABELS[v] || v : '--')
const testRoleText = (v?: string | null) => (v ? TEST_ROLE_LABELS[v] || v : '--')
const execModeText = (v?: string | null) => (v ? EXEC_MODE_LABELS[v] || v : '--')

// ── 筛选 ──────────────────────────────────────────
const searchForm = reactive({
  keyword: '',
  case_type: '',
})

const pageNum = ref(1)
const pageSize = ref(20)

/**
 * `filters` 是后端 dyn_filter 的通用筛选协议：JSON 数组字符串（{field, op, value}），
 * 字段名必须能在实体 Column 上解析出来，否则后端报错（db/src/common/dyn_filter.rs）。
 */
const queryParams = computed(() => ({
  page_num: pageNum.value,
  page_size: pageSize.value,
  keyword: searchForm.keyword,
  filters: searchForm.case_type
    ? JSON.stringify([{ field: 'case_type', op: 'eq', value: searchForm.case_type }])
    : '',
}))

const {
  isFetching: loading,
  data: rawData,
  execute: fetchData,
} = useGet<any>(ApiSecScan.caseList, queryParams, { immediate: true })

const tableData = computed(() => rawData.value?.list || [])
const pagination = computed(() => ({
  current: pageNum.value,
  pageSize: pageSize.value,
  total: rawData.value?.total || 0,
  showTotal: true,
  showPageSize: true,
}))

// ── 删除（软删除，已删除用例不再出现在列表与任务用例清单中）──
function handleDelete(record: any) {
  const name = record.entity_number || record.api_path || '该用例'
  Modal.confirm({
    title: '删除用例',
    content: `确认删除「${name}」？删除后该用例不再参与后续扫描。`,
    okText: '删除',
    cancelText: '取消',
    onOk: async () => {
      const res = await postAction<string>(resolveStaticScanApi(ApiSecScan.caseDelete, { id: record.id }))
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
  searchForm.case_type = ''
  handleSearch()
}

function handlePageChange(page: number) {
  pageNum.value = page
  fetchData()
}

// 改每页条数必须同时回到第 1 页（否则新页可能已超出总页数，看起来像"数据没了"）
function handlePageSizeChange(size: number) {
  pageSize.value = size
  pageNum.value = 1
  fetchData()
}
</script>

<template>
  <div>
    <ListPage>
      <!-- 筛选区：控件外层必须是原生 div，Arco Input/Select 的 inheritAttrs: false 会吞掉 class -->
      <template #filter>
        <div class="filter-bar">
          <div class="f-wide">
            <a-input
              v-model="searchForm.keyword"
              placeholder="实体编码 / 名称 / API路径"
              allow-clear
              @press-enter="handleSearch"
              @clear="handleSearch"
            />
          </div>
          <div class="f-mid">
            <a-select v-model="searchForm.case_type" placeholder="用例类型" allow-clear @change="handleSearch">
              <a-option v-for="t in CASE_TYPE_OPTIONS" :key="t.value" :value="t.value">
                {{ t.label }}
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

      <template #default="{ tableHeight }">
        <a-table
          :data="tableData"
          :loading="loading"
          :pagination="pagination"
          :scroll="{ minWidth: 940, y: tableHeight }"
          row-key="id"
          @page-change="handlePageChange"
          @page-size-change="handlePageSizeChange"
        >
          <template #columns>
            <a-table-column title="实体" :width="240" ellipsis tooltip>
              <template #cell="{ record }">
                <span>{{ record.entity_number || record.api_path || '--' }}</span>
                <span v-if="record.entity_name" class="entity-name">（{{ record.entity_name }}）</span>
              </template>
            </a-table-column>
            <a-table-column title="用例类型" data-index="case_type" :width="110">
              <template #cell="{ record }">
                {{ caseTypeText(record.case_type) }}
              </template>
            </a-table-column>
            <a-table-column title="测试类型" data-index="test_type" :width="110">
              <template #cell="{ record }">
                {{ testTypeText(record.test_type) }}
              </template>
            </a-table-column>
            <a-table-column title="测试角色" data-index="test_role" :width="120">
              <template #cell="{ record }">
                {{ testRoleText(record.test_role) }}
              </template>
            </a-table-column>
            <a-table-column title="执行方式" data-index="exec_mode" :width="110">
              <template #cell="{ record }">
                {{ execModeText(record.exec_mode) }}
              </template>
            </a-table-column>
            <a-table-column title="启用" data-index="enabled" :width="80">
              <template #cell="{ record }">
                <a-tag :color="record.enabled === 'Y' ? 'green' : 'gray'" size="small">
                  {{ record.enabled === 'Y' ? '启用' : '停用' }}
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column title="操作" :width="90" fixed="right">
              <template #cell="{ record }">
                <a-popconfirm content="确认删除该用例？" @ok="handleDelete(record)">
                  <a-link status="danger">
                    删除
                  </a-link>
                </a-popconfirm>
              </template>
            </a-table-column>
          </template>
        </a-table>
      </template>
    </ListPage>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

/* 宽度必须落在包裹 div 上：Arco 的 Input / Select 是 inheritAttrs: false */
.f-wide {
  width: 240px;
}
.f-mid {
  width: 150px;
}

.filter-bar > div :deep(.arco-select),
.filter-bar > div :deep(.arco-input-wrapper) {
  width: 100%;
}

.entity-name {
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
