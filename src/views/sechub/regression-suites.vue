<script setup lang="ts">
/**
 * 安全测试 → 安全扫描 → 回归套件
 *
 * 一个套件 = 一套回归配置（test_types/scope/cron）+ N 个环境绑定；
 * 触发时后端按环境复用/创建单环境任务并建 run，运行记录见「环境与运行」。
 * 接口见 api/src/sechub/regression_suite.rs，字段见 temp/共享项目组api安全测试/reports/suite-model.md。
 */
import type { SecRegressionSuite, SecRegressionSuiteTriggerResult } from '@/api/sechubApis'
import { Message, Modal } from '@arco-design/web-vue'
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ApiSecRegressionSuite, resolveStaticScanApi } from '@/api/sechubApis'
import ListPage from '@/components/common/ListPage.vue'
import { postAction, useGet } from '@/hooks'
import RegressionSuiteEnvs from './components/RegressionSuiteEnvs.vue'
import RegressionSuiteForm from './components/RegressionSuiteForm.vue'
import RegressionSuiteTable from './components/RegressionSuiteTable.vue'
import { firstQueryText, toSuiteRuns } from './composables/secNavigation'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive 按它匹配缓存
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'regression-suites' })

const route = useRoute()
const router = useRouter()

const searchForm = reactive({
  // 测试结果详情「套件」跳过来时按编码过滤（后端 keyword 同时匹配名称与 suite_code）
  keyword: firstQueryText(route.query.suite_code),
  product_line: '',
  status: '',
})
const pageNum = ref(1)
const pageSize = ref(20)

const { isFetching: loading, data: rawData, execute: fetchData } = useGet<{ list: SecRegressionSuite[], total: number }>(
  ApiSecRegressionSuite.list,
  computed(() => ({
    page_num: pageNum.value,
    page_size: pageSize.value,
    keyword: searchForm.keyword || undefined,
    product_line: searchForm.product_line || undefined,
    status: searchForm.status || undefined,
  })),
  { immediate: true },
)

const tableData = computed(() => rawData.value?.list || [])
const pagination = computed(() => ({
  current: pageNum.value,
  pageSize: pageSize.value,
  total: rawData.value?.total || 0,
  showTotal: true,
  showPageSize: true,
}))

const formVisible = ref(false)
const editingSuite = ref<SecRegressionSuite | null>(null)
const envsVisible = ref(false)
const envsSuite = ref<SecRegressionSuite | null>(null)

function openAdd() {
  editingSuite.value = null
  formVisible.value = true
}

function openEdit(record: SecRegressionSuite) {
  editingSuite.value = record
  formVisible.value = true
}

function openEnvs(record: SecRegressionSuite) {
  envsSuite.value = record
  envsVisible.value = true
}

/** 套件运行只认「所属任务 ∈ 该套件」，runs 接口原生支持 suite_id 过滤 */
function openRuns(record: SecRegressionSuite) {
  router.push(toSuiteRuns(record.id, record.name))
}

function handleSaved() {
  fetchData()
}

function handleDelete(record: SecRegressionSuite) {
  Modal.confirm({
    title: '删除套件',
    content: `确认删除「${record.name}」？删除后不再调度，已产生的任务与运行记录保留。`,
    okText: '删除',
    cancelText: '取消',
    onOk: async () => {
      const res = await postAction<string>(resolveStaticScanApi(ApiSecRegressionSuite.delete, { id: record.id }))
      if (res === null)
        return
      Message.success('删除成功')
      await fetchData()
    },
  })
}

function handleTrigger(record: SecRegressionSuite) {
  Modal.confirm({
    title: '手动触发套件',
    content: `确认触发「${record.name}」？将为每个启用环境各建一条运行记录，已有未结束运行的环境会被跳过。`,
    okText: '触发',
    cancelText: '取消',
    onOk: async () => {
      const res = await postAction<SecRegressionSuiteTriggerResult>(
        resolveStaticScanApi(ApiSecRegressionSuite.run, { id: record.id }),
      )
      if (res === null)
        return
      if (res.skipped)
        Message.warning(`已触发 ${res.triggered} 个环境，跳过 ${res.skipped} 个`)
      else
        Message.success(`已触发 ${res.triggered} 个环境`)
      if (res.skipped_envs.length) {
        Modal.info({
          title: '跳过的环境',
          content: res.skipped_envs.map(item => `${item.env_id}：${item.reason}`).join('；'),
        })
      }
      await fetchData()
    },
  })
}

function handleSearch() {
  pageNum.value = 1
  fetchData()
}

function handleReset() {
  searchForm.keyword = ''
  searchForm.product_line = ''
  searchForm.status = ''
  handleSearch()
}

function handlePageChange(page: number) {
  pageNum.value = page
  fetchData()
}

function handlePageSizeChange(size: number) {
  pageSize.value = size
  pageNum.value = 1
  fetchData()
}
</script>

<template>
  <div>
    <ListPage>
      <template #filter>
        <div class="filter-bar">
          <div class="f-wide">
            <a-input
              v-model="searchForm.keyword"
              placeholder="套件名称 / 编码"
              allow-clear
              @press-enter="handleSearch"
              @clear="handleSearch"
            />
          </div>
          <div class="f-mid">
            <a-select v-model="searchForm.product_line" placeholder="产品线" allow-clear @change="handleSearch">
              <a-option value="星瀚">
                星瀚
              </a-option>
              <a-option value="星空">
                星空
              </a-option>
            </a-select>
          </div>
          <div class="f-mid">
            <a-select v-model="searchForm.status" placeholder="状态" allow-clear @change="handleSearch">
              <a-option value="active">
                启用
              </a-option>
              <a-option value="archived">
                已归档
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
        <div class="toolbar-spacer" />
        <a-button type="primary" @click="openAdd">
          新建套件
        </a-button>
      </template>

      <template #default="{ tableHeight }">
        <RegressionSuiteTable
          :rows="tableData"
          :loading="loading"
          :pagination="pagination"
          :table-height="tableHeight"
          @page-change="handlePageChange"
          @page-size-change="handlePageSizeChange"
          @open-envs="openEnvs"
          @open-runs="openRuns"
          @edit="openEdit"
          @trigger="handleTrigger"
          @delete="handleDelete"
        />
      </template>
    </ListPage>

    <RegressionSuiteForm
      v-model:visible="formVisible"
      :suite="editingSuite"
      @saved="handleSaved"
    />
    <RegressionSuiteEnvs
      v-model:visible="envsVisible"
      :suite="envsSuite"
      @changed="handleSaved"
    />
  </div>
</template>

<style scoped>
/* 筛选区：按需宽度 + 放不下自动换行（与 scan-task-list.vue 一致） */
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.f-wide {
  width: 240px;
}
.f-mid {
  width: 150px;
}

/* Arco 的 Input / Select 是 inheritAttrs: false，宽度必须落在包裹 div 上 */
.filter-bar > div :deep(.arco-select),
.filter-bar > div :deep(.arco-input-wrapper) {
  width: 100%;
}

.toolbar-spacer {
  flex: 1;
}
</style>
