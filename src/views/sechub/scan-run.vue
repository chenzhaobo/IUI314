<script lang="ts" setup>
import { computed, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import { ApiSecScanRun } from '@/api/apis'
import { useGet, usePost } from '@/hooks'

defineOptions({ name: 'SecScanRun' })

const queryParams = ref({ page_num: 1, page_size: 10 })
const { isFetching: isLoading, data: rawListData, execute: getList } = useGet<any>(ApiSecScanRun.getList, queryParams, { immediate: true })
const dataList = computed(() => rawListData.value?.list || [])
const total = computed(() => rawListData.value?.total || 0)

// 触发手动扫描
const triggerVisible = ref(false)
const triggerForm = ref({ task_id: '', params: '' })
async function handleTrigger() {
  if (!triggerForm.value.task_id) { Message.warning('请输入任务ID'); return }
  const { execute, error } = usePost(ApiSecScanRun.trigger, triggerForm)
  await execute()
  if (error.value) { Message.error('触发失败'); return }
  Message.success('触发成功')
  triggerVisible.value = false
  getList()
}

const columns = [
  { title: '任务ID', dataIndex: 'task_id', width: 120 },
  { title: '工具代码', dataIndex: 'tool_code', width: 100 },
  { title: '运行状态', dataIndex: 'run_status', width: 100 },
  { title: '触发方式', dataIndex: 'trigger_type', width: 80 },
  { title: '触发人', dataIndex: 'trigger_by', width: 100 },
  { title: '开始时间', dataIndex: 'started_at', width: 160 },
  { title: '结束时间', dataIndex: 'finished_at', width: 160 },
  { title: '耗时(秒)', dataIndex: 'duration_sec', width: 80 },
  { title: '总发现', dataIndex: 'total_findings', width: 80 },
  { title: '新发现', dataIndex: 'new_findings', width: 80 },
  { title: '错误信息', dataIndex: 'error_msg', ellipsis: true, tooltip: true },
]
</script>
<template>
  <div>
    <a-card :bordered="false" class="m-b-8px">
      <a-space>
        <a-button type="primary" status="success" @click="triggerVisible = true">
          <template #icon><icon-thunderbolt /></template>
          手动触发扫描
        </a-button>
        <a-button @click="() => getList()">刷新</a-button>
      </a-space>
    </a-card>
    <a-card :bordered="false">
      <a-table
        :loading="isLoading"
        :data="dataList"
        :columns="columns"
        :pagination="{ total, current: queryParams.page_num, pageSize: queryParams.page_size, showTotal: true }"
        row-key="id"
        @page-change="(p: number) => { queryParams.page_num = p; getList() }"
      />
    </a-card>
    <a-modal v-model:visible="triggerVisible" title="手动触发扫描" @ok="handleTrigger">
      <a-form :model="triggerForm" layout="vertical">
        <a-form-item label="任务ID" required>
          <a-input v-model="triggerForm.task_id" placeholder="请输入扫描任务ID" />
        </a-form-item>
        <a-form-item label="额外参数">
          <a-textarea v-model="triggerForm.params" placeholder="JSON格式参数（可选）" :auto-size="{ minRows: 2, maxRows: 4 }" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
