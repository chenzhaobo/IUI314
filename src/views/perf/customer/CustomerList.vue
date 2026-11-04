<template>
  <div class="page-container">
    <a-card :bordered="false">
      <!-- 搜索栏 -->
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="4">
          <a-input v-model="searchForm.keyword" placeholder="客户名称/DMP客户编号/域名" allow-clear @press-enter="handleSearch" />
        </a-col>
        <a-col :span="2">
          <a-select v-model="searchForm.cloud_type" placeholder="云类型" allow-clear :options="cloudTypeOptions" />
        </a-col>
        <a-col :span="2">
          <a-select v-model="searchForm.status" placeholder="状态" allow-clear>
            <a-option value="1">启用</a-option>
            <a-option value="0">禁用</a-option>
          </a-select>
        </a-col>
        <a-col :span="3">
          <a-input v-model="searchForm.product_version" placeholder="产品版本（精确）" allow-clear @press-enter="handleSearch" />
        </a-col>
        <a-col :span="3">
          <a-input v-model="searchForm.cosmic_version" placeholder="苍穹版本（精确）" allow-clear @press-enter="handleSearch" />
        </a-col>
        <a-col :span="10">
          <a-space>
            <a-button type="primary" @click="handleSearch">查询</a-button>
            <a-button @click="handleReset">重置</a-button>
            <a-button type="primary" status="success" @click="handleAdd">新增</a-button>
          </a-space>
        </a-col>
      </a-row>

      <!-- 表格 -->
      <!-- 原生 div 挂 ref：组件 ref 拿到的是实例、没有 getBoundingClientRect -->
      <div ref="tableWrap">
      <a-table :data="tableData" :loading="loading" :pagination="pagination" @page-change="handlePageChange"
 @page-size-change="handlePageSizeChange" :scroll="{ y: tableHeight, x: 2200 }">
        <template #columns>
          <a-table-column title="客户名称" data-index="customer_name" :width="200" fixed="left" />
          <a-table-column title="DMP 客户编号" data-index="tenant_code" :width="120" />
          <a-table-column title="租户ID" data-index="tenant_id" :width="150" ellipsis />
          <a-table-column title="云类型" data-index="cloud_type" :width="80">
            <template #cell="{ record }">
              <a-tag :color="record.cloud_type === 'public' ? 'blue' : 'green'">
                {{ getDictLabel(cloudTypeOptions, record.cloud_type) }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="产品名称" data-index="product_name" :width="160" ellipsis />
          <a-table-column title="产品版本" data-index="product_version" :width="120" ellipsis />
          <a-table-column title="苍穹版本" data-index="cosmic_version" :width="120" ellipsis />
          <a-table-column title="组织" data-index="org_name" :width="140" ellipsis />
          <a-table-column title="行业" data-index="industry" :width="120" ellipsis />
          <a-table-column title="点击量" data-index="click_count" :width="90" align="right">
            <template #cell="{ record }">{{ record.click_count == null ? '-' : record.click_count.toLocaleString() }}</template>
          </a-table-column>
          <a-table-column title="上报时间" data-index="report_time" :width="170">
            <template #cell="{ record }">{{ formatTime(record.report_time) }}</template>
          </a-table-column>
          <a-table-column title="域名" data-index="domain" :width="180" ellipsis />
          <a-table-column title="联系人" data-index="contact" :width="100" />
          <a-table-column title="状态" data-index="status" :width="80">
            <template #cell="{ record }">
              <a-badge :status="record.status === '1' ? 'success' : 'normal'" :text="record.status === '1' ? '启用' : '禁用'" />
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="150" fixed="right">
            <template #cell="{ record }">
              <a-space>
                <a-link @click="handleEdit(record)">编辑</a-link>
                <a-popconfirm content="确定删除该客户？" @ok="handleDelete(record)">
                  <a-link status="danger">删除</a-link>
                </a-popconfirm>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
      </div>
    </a-card>

    <!-- 新增/编辑弹窗 -->
    <a-modal v-model:visible="modalVisible" :title="modalTitle" @ok="handleSubmit" @cancel="modalVisible = false">
      <a-form :model="formData" layout="vertical">
        <!-- DMP 同步字段：编辑时只读，避免覆盖同步结果 -->
        <a-form-item label="客户名称" required>
          <a-input v-model="formData.customer_name" placeholder="请输入客户名称" :disabled="isEdit" />
        </a-form-item>
        <a-form-item label="DMP 客户编号" required>
          <a-input v-model="formData.tenant_code" placeholder="DMP 客户查询工具中的 number" :disabled="isEdit" />
        </a-form-item>
        <a-form-item label="租户ID">
          <a-input v-model="formData.tenant_id" placeholder="Ops UUID" :disabled="isEdit" />
        </a-form-item>
        <a-descriptions v-if="isEdit" :column="2" size="small" bordered class="m-b-16px">
          <a-descriptions-item label="产品名称">{{ formData.product_name || '-' }}</a-descriptions-item>
          <a-descriptions-item label="产品版本">{{ formData.product_version || '-' }}</a-descriptions-item>
          <a-descriptions-item label="苍穹版本">{{ formData.cosmic_version || '-' }}</a-descriptions-item>
          <a-descriptions-item label="组织">{{ formData.org_name || '-' }}</a-descriptions-item>
          <a-descriptions-item label="行业">{{ formData.industry || '-' }}</a-descriptions-item>
          <a-descriptions-item label="点击量">{{ formData.click_count ?? '-' }}</a-descriptions-item>
          <a-descriptions-item label="上报时间">{{ formatTime(formData.report_time) }}</a-descriptions-item>
        </a-descriptions>
        <a-form-item label="云类型">
          <a-select v-model="formData.cloud_type" :options="cloudTypeOptions" />
        </a-form-item>
        <a-form-item label="运行类型">
          <a-select v-model="formData.runtime_type" :options="runtimeTypeOptions" />
        </a-form-item>
        <a-form-item label="域名">
          <a-input v-model="formData.domain" placeholder="如: sxswfzjt.kdcloud.com" />
        </a-form-item>
        <a-form-item label="联系人">
          <a-input v-model="formData.contact" />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model="formData.remark" :auto-size="{ minRows: 2 }" />
        </a-form-item>
        <a-form-item label="状态">
          <a-switch v-model="formData.status" checked-value="1" unchecked-value="0" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { Message } from '@arco-design/web-vue'
import { ApiPerfCustomer } from '@/api/perfApis'
import { ApiSysDictData } from '@/api/apis'
import { formatTime, useGet, usePost, usePut, useDelete, useTableAutoHeight } from '@/hooks'

defineOptions({ name: 'customer-list' })

// ── 字典加载 ──────────────────────────────────
// 表格高度自适应：滚动条落在表格内、表头固定
const tableWrap = ref<HTMLElement>()
const { tableHeight } = useTableAutoHeight(tableWrap)

const { data: cloudTypeRaw } = useGet<any>(ApiSysDictData.getByType, { dict_type: 'perf_cloud_type' }, { immediate: true })
const cloudTypeOptions = computed(() => (Array.isArray(cloudTypeRaw.value) ? cloudTypeRaw.value : []).map((d: any) => ({ label: d.dict_label, value: d.dict_value })))
const { data: runtimeTypeRaw } = useGet<any>(ApiSysDictData.getByType, { dict_type: 'perf_runtime_type' }, { immediate: true })
const runtimeTypeOptions = computed(() => (Array.isArray(runtimeTypeRaw.value) ? runtimeTypeRaw.value : []).map((d: any) => ({ label: d.dict_label, value: d.dict_value })))

function getDictLabel(options: { label: string, value: string }[], value: string) {
  return options.find(o => o.value === value)?.label || value
}

const pageNum = ref(1)
const pageSize = ref(20)
const searchForm = reactive({ keyword: '', cloud_type: '', product_version: '', cosmic_version: '', status: '' })

const modalVisible = ref(false)
const modalTitle = ref('新增客户')
const isEdit = ref(false)
const formData = reactive<any>({
  id: '',
  customer_name: '',
  tenant_code: '',
  tenant_id: '',
  cloud_type: 'public',
  runtime_type: 'production',
  domain: '',
  contact: '',
  remark: '',
  status: '1',
})

const queryParams = computed(() => ({ ...searchForm, page_num: pageNum.value, page_size: pageSize.value }))
const { isFetching: loading, data: rawData, execute: fetchData } = useGet<any>(ApiPerfCustomer.getList, queryParams, { immediate: true })
const tableData = computed(() => rawData.value?.list || [])
const pagination = computed(() => ({ current: pageNum.value, pageSize: pageSize.value, total: rawData.value?.total || 0, showTotal: true, showPageSize: true }))

const handleSearch = () => { pageNum.value = 1; fetchData() }
const handleReset = () => {
  searchForm.keyword = ''
  searchForm.cloud_type = ''
  searchForm.product_version = ''
  searchForm.cosmic_version = ''
  searchForm.status = ''
  handleSearch()
}
const handlePageChange = (page: number) => { pageNum.value = page; fetchData() }
// 改每页条数必须同时回到第 1 页：原本停在第 5 页、条数改大后该页往往已超出总页数，
// 后端返回空列表，看起来像"数据没了"。
const handlePageSizeChange = (size: number) => { pageSize.value = size; pageNum.value = 1; fetchData() }

const handleAdd = () => {
  isEdit.value = false
  modalTitle.value = '新增客户'
  Object.assign(formData, {
    id: '', customer_name: '', tenant_code: '', tenant_id: '',
    cloud_type: 'public', runtime_type: 'production', domain: '', contact: '', remark: '', status: '1',
    product_name: null, product_version: null, cosmic_version: null,
    org_name: null, industry: null, click_count: null, report_time: null,
  })
  modalVisible.value = true
}

const handleEdit = (record: any) => {
  isEdit.value = true
  modalTitle.value = '编辑客户'
  Object.assign(formData, record)
  modalVisible.value = true
}

// 新增/编辑
const submitPayload = ref<any>({})
const { execute: doAdd } = usePost<any>(ApiPerfCustomer.add, submitPayload, { immediate: false })
const { execute: doEdit } = usePut<any>(ApiPerfCustomer.edit, submitPayload, { immediate: false })
const handleSubmit = async () => {
  if (!formData.customer_name || !formData.tenant_code) {
    Message.warning('请填写必填项')
    return
  }
  submitPayload.value = { ...formData }
  if (isEdit.value) {
    await doEdit()
    Message.success('编辑成功')
  } else {
    await doAdd()
    Message.success('新增成功')
  }
  modalVisible.value = false
  fetchData()
}

// 删除
const deletePayload = ref<any>({})
const { execute: doDelete } = useDelete<any>(ApiPerfCustomer.delete, deletePayload, { immediate: false })
const handleDelete = async (record: any) => {
  deletePayload.value = { ids: [record.id] }
  await doDelete()
  Message.success('删除成功')
  fetchData()
}
</script>
