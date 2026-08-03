<template>
  <div class="container">
    <a-card :bordered="false">
      <!-- 筛选栏 -->
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="5">
          <a-input v-model="searchForm.keyword" placeholder="场景名称" allow-clear @press-enter="fetchData" />
        </a-col>
        <a-col :span="4">
          <a-input v-model="searchForm.app_number" placeholder="应用编码" allow-clear @press-enter="fetchData" />
        </a-col>
        <a-col :span="4">
          <a-select v-model="searchForm.source" placeholder="来源" allow-clear>
            <a-option value="manual">手动创建</a-option>
            <a-option value="auto_recommend">自动推荐</a-option>
          </a-select>
        </a-col>
        <a-col :span="4">
          <a-select v-model="searchForm.status" placeholder="状态" allow-clear>
            <a-option value="pending">待确认</a-option>
            <a-option value="confirmed">已确认</a-option>
            <a-option value="implemented">已实现</a-option>
            <a-option value="ignored">已忽略</a-option>
          </a-select>
        </a-col>
        <a-col :span="5">
          <a-space>
            <a-button type="primary" @click="fetchData">查询</a-button>
            <a-button type="primary" @click="handleAdd">新增</a-button>
          </a-space>
        </a-col>
      </a-row>

      <!-- 数据表格 -->
      <a-table :data="tableData" :loading="loading" :pagination="pagination" @page-change="handlePageChange" row-key="id">
        <template #columns>
          <a-table-column title="场景名称" data-index="name" :width="200" />
          <a-table-column title="应用" data-index="app_name" :width="120" />
          <a-table-column title="表单" data-index="form_name" :width="150" />
          <a-table-column title="操作类型" data-index="operation_type" :width="100" />
          <a-table-column title="使用频次" data-index="usage_count" :width="100" />
          <a-table-column title="达标率" data-index="compliance_rate" :width="100">
            <template #cell="{ record }">
              <span v-if="record.compliance_rate">{{ record.compliance_rate?.toFixed(2) }}%</span>
              <span v-else>-</span>
            </template>
          </a-table-column>
          <a-table-column title="优先级" data-index="priority" :width="80">
            <template #cell="{ record }">
              <a-tag v-if="record.priority" :color="priorityColor(record.priority)">{{ record.priority }}</a-tag>
              <span v-else>-</span>
            </template>
          </a-table-column>
          <a-table-column title="来源" data-index="source" :width="100">
            <template #cell="{ record }">
              <a-tag :color="record.source === 'manual' ? 'blue' : 'orange'">
                {{ record.source === 'manual' ? '手动' : '推荐' }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="状态" data-index="status" :width="100">
            <template #cell="{ record }">
              <a-tag :color="statusColor(record.status)">{{ statusText(record.status) }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="180">
            <template #cell="{ record }">
              <a-space>
                <a-link @click="handleEdit(record)">编辑</a-link>
                <a-link v-if="record.status === 'pending'" @click="handleConfirm(record)">确认</a-link>
                <a-popconfirm content="确定删除？" @ok="handleDelete(record)">
                  <a-link status="danger">删除</a-link>
                </a-popconfirm>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑弹窗 -->
    <a-modal v-model:visible="modalVisible" :title="formData.id ? '编辑场景' : '新增场景'" @ok="handleSubmit" :width="600">
      <a-form :model="formData" layout="vertical">
        <a-form-item label="场景名称" required>
          <a-input v-model="formData.name" placeholder="请输入场景名称" :max-length="200" />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="应用编码">
              <a-input v-model="formData.app_number" placeholder="应用编码" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="应用名称">
              <a-input v-model="formData.app_name" placeholder="应用名称" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="表单ID">
              <a-input v-model="formData.form_id" placeholder="表单ID" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="表单名称">
              <a-input v-model="formData.form_name" placeholder="表单名称" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="操作类型">
              <a-input v-model="formData.operation_type" placeholder="新增/查询/修改/删除" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="优先级">
              <a-select v-model="formData.priority" placeholder="优先级" allow-clear>
                <a-option value="high">高</a-option>
                <a-option value="medium">中</a-option>
                <a-option value="low">低</a-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="描述">
          <a-textarea v-model="formData.description" placeholder="场景描述" :max-length="1000" />
        </a-form-item>
        <a-form-item label="测试步骤">
          <a-textarea v-model="formData.test_steps" placeholder="测试步骤" :max-length="2000" />
        </a-form-item>
        <a-form-item label="预期结果">
          <a-textarea v-model="formData.expected_result" placeholder="预期结果" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { Message } from '@arco-design/web-vue'
import { ApiPerfScenario } from '@/api/perfApis'
import { useGet, usePost, usePut, useDelete } from '@/hooks'

defineOptions({ name: 'scenario-list' })

const pageNum = ref(1)
const pageSize = ref(20)
const searchForm = reactive({ keyword: '', app_number: '', source: '', status: '' })
const modalVisible = ref(false)
const formData = reactive<any>({
  id: '', name: '', description: '', app_number: '', app_name: '', form_id: '', form_name: '',
  operation_type: '', test_steps: '', expected_result: '', priority: '',
})

const queryParams = computed(() => ({ ...searchForm, page_num: pageNum.value, page_size: pageSize.value }))
const { isFetching: loading, data: rawData, execute: fetchData } = useGet<any>(ApiPerfScenario.getList, queryParams, { immediate: true })
const tableData = computed(() => rawData.value?.list || [])
const pagination = computed(() => ({ current: pageNum.value, pageSize: pageSize.value, total: rawData.value?.total || 0 }))

const statusColor = (s: string) => ({ pending: 'orange', confirmed: 'blue', implemented: 'green', ignored: 'gray' }[s] || 'gray')
const statusText = (s: string) => ({ pending: '待确认', confirmed: '已确认', implemented: '已实现', ignored: '已忽略' }[s] || s)
const priorityColor = (p: string) => ({ high: 'red', medium: 'orange', low: 'blue' }[p] || 'gray')

const handlePageChange = (page: number) => { pageNum.value = page; fetchData() }

const handleAdd = () => {
  Object.assign(formData, { id: '', name: '', description: '', app_number: '', app_name: '', form_id: '', form_name: '', operation_type: '', test_steps: '', expected_result: '', priority: '' })
  modalVisible.value = true
}

const handleEdit = (record: any) => {
  Object.assign(formData, record)
  modalVisible.value = true
}

// 新增/编辑
const submitPayload = ref<any>({})
const { execute: doAdd } = usePost<any>(ApiPerfScenario.add, submitPayload, { immediate: false })
const { execute: doEdit } = usePut<any>(ApiPerfScenario.edit, submitPayload, { immediate: false })
const handleSubmit = async () => {
  if (!formData.name) { Message.warning('请填写场景名称'); return }
  submitPayload.value = { ...formData }
  if (formData.id) {
    await doEdit()
    Message.success('修改成功')
  } else {
    await doAdd()
    Message.success('新增成功')
  }
  modalVisible.value = false
  fetchData()
}

// 确认
const confirmPayload = ref<any>({})
const { execute: doConfirm } = usePut<any>(ApiPerfScenario.confirm, confirmPayload, { immediate: false })
const handleConfirm = async (record: any) => {
  confirmPayload.value = { id: record.id }
  await doConfirm()
  Message.success('确认成功')
  fetchData()
}

// 删除
const deletePayload = ref<any>({})
const { execute: doDelete } = useDelete<any>(ApiPerfScenario.delete, deletePayload, { immediate: false })
const handleDelete = async (record: any) => {
  deletePayload.value = { ids: [record.id] }
  await doDelete()
  Message.success('删除成功')
  fetchData()
}
</script>
