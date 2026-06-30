<script lang="ts" setup>
import SecCrudPage from './components/SecCrudPage.vue'
import { ApiSecReleaseWindow } from '@/api/apis'
defineOptions({ name: 'SecReleaseWindow' })
const columns = [
  { title: '窗口代码', dataIndex: 'window_code', width: 120 },
  { title: '窗口名称', dataIndex: 'window_name', width: 160, ellipsis: true, tooltip: true },
  { title: '开始日期', dataIndex: 'start_date', width: 120 },
  { title: '结束日期', dataIndex: 'end_date', width: 120 },
  { title: '发布日期', dataIndex: 'release_date', width: 120 },
  { title: '状态', dataIndex: 'status', width: 80 },
  { title: '操作', dataIndex: 'operations', slot: 'operations', width: 120, fixed: 'right' as const },
]
const fields = [
  { label: '窗口代码', field: 'window_code', required: true },
  { label: '窗口名称', field: 'window_name', required: true },
  { label: '项目组ID', field: 'project_group_id' },
  { label: '开始日期', field: 'start_date', type: 'date' as const },
  { label: '结束日期', field: 'end_date', type: 'date' as const },
  { label: '代码冻结开始', field: 'code_freeze_start', type: 'date' as const },
  { label: '代码冻结结束', field: 'code_freeze_end', type: 'date' as const },
  { label: '发布日期', field: 'release_date', type: 'date' as const },
  { label: '状态', field: 'status', type: 'select' as const, options: [{ label: '规划中', value: 'planning' }, { label: '进行中', value: 'active' }, { label: '已发布', value: 'released' }, { label: '已取消', value: 'cancelled' }] },
  { label: '备注', field: 'remark', type: 'textarea' as const, span: 24 },
]
</script>
<template>
  <SecCrudPage title="发布窗口" :api-list="ApiSecReleaseWindow.getList" :api-add="ApiSecReleaseWindow.add" :api-edit="ApiSecReleaseWindow.edit" :api-delete="ApiSecReleaseWindow.delete" :columns="columns" :fields="fields" id-field="id" name-field="window_name" />
</template>
