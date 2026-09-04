<script lang="ts" setup>
/**
 * 迭代扫描计划管理 — Campaign CRUD + 状态转换
 */
import { computed, ref } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import { useGet, usePost, usePut } from '@/hooks'
import { ApiSecCampaign, ApiSecProjectGroup } from '@/api/sechubApis'

defineOptions({ name: 'campaigns' })

// ── 查询 ──────────────────────────────────────────
const queryParams = ref<Record<string, any>>({
  page_num: 1,
  page_size: 10,
  keyword: '',
  project_group_id: '',
  status: '',
})

const { isFetching: loading, data: rawData, execute: refresh } = useGet<any>(ApiSecCampaign.getList, queryParams, { immediate: true })

const dataList = computed(() => rawData.value?.list || [])
const total = computed(() => rawData.value?.total || 0)

// ── 项目组选项 ────────────────────────────────────
const { data: pgData } = useGet<any>(ApiSecProjectGroup.getAll, {}, { immediate: true })
const pgOptions = computed(() => (Array.isArray(pgData.value) ? pgData.value : []).map((g: any) => ({ label: g.name, value: g.id })))

const statusOptions = [
  { label: '草稿', value: 'draft' },
  { label: '就绪', value: 'ready' },
  { label: '执行中', value: 'executing' },
  { label: '评估中', value: 'assessing' },
  { label: '已通过', value: 'passed' },
  { label: '阻塞', value: 'blocked' },
]

const statusMap: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: 'gray' },
  ready: { text: '就绪', color: 'blue' },
  executing: { text: '执行中', color: 'orangered' },
  assessing: { text: '评估中', color: 'orange' },
  passed: { text: '已通过', color: 'green' },
  blocked: { text: '阻塞', color: 'red' },
}

// ── 创建/编辑弹窗 ─────────────────────────────────
const formVisible = ref(false)
const formLoading = ref(false)
const isEdit = ref(false)
const formData = ref<Record<string, any>>({
  project_group_id: '',
  iteration_id: '',
  iteration_name: '',
  name: '',
  owner_user_id: '',
  remark: '',
})

function openCreate() {
  isEdit.value = false
  formData.value = { project_group_id: '', iteration_id: '', iteration_name: '', name: '', owner_user_id: '', remark: '' }
  formVisible.value = true
}

function openEdit(row: any) {
  isEdit.value = true
  formData.value = { id: row.id, name: row.name, owner_user_id: row.owner_user_id, remark: row.remark, version: row.version }
  formVisible.value = true
}

const { execute: doAdd } = usePost(ApiSecCampaign.add, formData, { immediate: false })
const { execute: doEdit } = usePut(ApiSecCampaign.edit, formData, { immediate: false })

async function submitForm() {
  formLoading.value = true
  try {
    if (isEdit.value) {
      await doEdit()
      Message.success('编辑成功')
    }
    else {
      await doAdd()
      Message.success('创建成功')
    }
    formVisible.value = false
    refresh()
  }
  catch (e: any) {
    Message.error(e?.message || '操作失败')
  }
  finally {
    formLoading.value = false
  }
}

// ── 状态操作 ──────────────────────────────────────
async function postAction(url: string, payload: Record<string, any>) {
  const request = usePost(url, payload, { immediate: false })
  await request.execute()
  if (request.error.value)
    throw new Error(String(request.error.value))
  return request.data.value
}

async function handleAction(action: string, row: any) {
  const id = row.id
  if (action === 'delete') {
    Modal.warning({
      title: '确认删除',
      content: `确定删除计划「${row.name}」？`,
      hideCancel: false,
      onOk: async () => {
        await postAction(ApiSecCampaign.delete, { id })
        Message.success('删除成功')
        refresh()
      },
    })
    return
  }

  const actionMap: Record<string, { url: string; label: string }> = {
    activate: { url: ApiSecCampaign.activate, label: '激活' },
    execute: { url: ApiSecCampaign.execute, label: '开始执行' },
    assess: { url: ApiSecCampaign.assess, label: '请求评估' },
    report: { url: ApiSecCampaign.report, label: '上报' },
  }

  const item = actionMap[action]
  if (!item) return

  try {
    const res = await postAction(item.url, { id })
    if (action === 'assess' && res) {
      Message.info(`评估结论: ${(res as any).status}`)
    }
    else {
      Message.success(`${item.label}成功`)
    }
    refresh()
  }
  catch (e: any) {
    Message.error(e?.message || `${item.label}失败`)
  }
}

// ── 分页 ──────────────────────────────────────────
function onPageChange(page: number) {
  queryParams.value.page_num = page
  refresh()
}

function onSearch() {
  queryParams.value.page_num = 1
  refresh()
}
</script>

<template>
  <div class="p-4">
    <a-card title="迭代扫描计划">
      <template #extra>
        <a-button type="primary" size="small" data-testid="btn-create-campaign" @click="openCreate">
          新建计划
        </a-button>
      </template>

      <!-- 筛选栏 -->
      <div class="mb-4 flex flex-wrap gap-3">
        <a-input v-model="queryParams.keyword" placeholder="搜索名称/迭代" allow-clear style="width: 200px" data-testid="input-campaign-keyword" @press-enter="onSearch" />
        <a-select v-model="queryParams.project_group_id" placeholder="项目组" allow-clear style="width: 180px" :options="pgOptions" data-testid="select-campaign-pg" @change="onSearch" />
        <a-select v-model="queryParams.status" placeholder="状态" allow-clear style="width: 140px" :options="statusOptions" data-testid="select-campaign-status" @change="onSearch" />
        <a-button type="primary" size="small" @click="onSearch">
          查询
        </a-button>
      </div>

      <!-- 表格 -->
      <a-table :data="dataList" :loading="loading" :pagination="{ total, current: queryParams.page_num, pageSize: queryParams.page_size }" row-key="id" @page-change="onPageChange">
        <template #columns>
          <a-table-column title="计划名称" data-index="name" :width="180" ellipsis tooltip />
          <a-table-column title="迭代" data-index="iteration_name" :width="120" ellipsis />
          <a-table-column title="状态" data-index="status" :width="100">
            <template #cell="{ record }">
              <a-tag :color="statusMap[record.status]?.color || 'gray'" :data-testid="`status-${record.id}`">
                {{ statusMap[record.status]?.text || record.status }}
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="上报状态" data-index="report_status" :width="100">
            <template #cell="{ record }">
              <a-tag v-if="record.report_status === 'reported'" color="green">已上报</a-tag>
              <span v-else class="text-gray-400">-</span>
            </template>
          </a-table-column>
          <a-table-column title="创建时间" data-index="created_at" :width="160" />
          <a-table-column title="操作" :width="280" fixed="right">
            <template #cell="{ record }">
              <a-space>
                <a-button v-if="record.status === 'draft'" size="mini" @click="openEdit(record)">
                  编辑
                </a-button>
                <a-button v-if="record.status === 'draft'" size="mini" type="primary" status="success" data-testid="btn-activate" @click="handleAction('activate', record)">
                  激活
                </a-button>
                <a-button v-if="record.status === 'ready' || record.status === 'blocked'" size="mini" type="primary" data-testid="btn-execute" @click="handleAction('execute', record)">
                  执行
                </a-button>
                <a-button v-if="record.status === 'executing' || record.status === 'assessing' || record.status === 'blocked'" size="mini" type="outline" data-testid="btn-assess" @click="handleAction('assess', record)">
                  评估
                </a-button>
                <a-button v-if="record.status === 'passed' && record.report_status !== 'reported'" size="mini" type="outline" status="success" data-testid="btn-report" @click="handleAction('report', record)">
                  上报
                </a-button>
                <a-button v-if="record.status === 'draft'" size="mini" status="danger" @click="handleAction('delete', record)">
                  删除
                </a-button>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>

    <!-- 创建/编辑弹窗 -->
    <a-modal v-model:visible="formVisible" :title="isEdit ? '编辑计划' : '新建计划'" :ok-loading="formLoading" @ok="submitForm">
      <a-form :model="formData" layout="vertical">
        <a-form-item v-if="!isEdit" label="项目组" required>
          <a-select v-model="formData.project_group_id" :options="pgOptions" placeholder="选择项目组" data-testid="form-pg" />
        </a-form-item>
        <a-form-item v-if="!isEdit" label="迭代ID" required>
          <a-input v-model="formData.iteration_id" placeholder="迭代唯一标识" data-testid="form-iteration-id" />
        </a-form-item>
        <a-form-item v-if="!isEdit" label="迭代名称">
          <a-input v-model="formData.iteration_name" placeholder="如: Sprint 24" />
        </a-form-item>
        <a-form-item label="计划名称" required>
          <a-input v-model="formData.name" placeholder="如: 2026-Q3 安全扫描" data-testid="form-name" />
        </a-form-item>
        <a-form-item v-if="!isEdit" label="负责人ID">
          <a-input v-model="formData.owner_user_id" placeholder="负责人用户ID" />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model="formData.remark" placeholder="可选" :max-length="500" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
