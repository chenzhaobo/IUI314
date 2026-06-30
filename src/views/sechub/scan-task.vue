<script lang="ts" setup>
import SecCrudPage from './components/SecCrudPage.vue'
import { ApiSecScanTask } from '@/api/apis'
defineOptions({ name: 'SecScanTask' })
const columns = [
  { title: '任务名称', dataIndex: 'task_name', width: 160, ellipsis: true, tooltip: true },
  { title: '工具代码', dataIndex: 'tool_code', width: 100 },
  { title: 'Cron表达式', dataIndex: 'cron_expr', width: 140 },
  { title: '参数', dataIndex: 'params_json', ellipsis: true, tooltip: true },
  { title: '启用', dataIndex: 'enabled', width: 60 },
  { title: '最后运行', dataIndex: 'last_run_at', width: 160 },
  { title: '操作', dataIndex: 'operations', slot: 'operations', width: 120, fixed: 'right' as const },
]
const fields = [
  { label: '任务名称', field: 'task_name', required: true },
  { label: '工具代码', field: 'tool_code', required: true },
  { label: '项目组ID', field: 'project_group_id' },
  { label: '发布窗口ID', field: 'release_window_id' },
  { label: '测试环境ID', field: 'test_env_id' },
  { label: 'Cron表达式', field: 'cron_expr', span: 24 },
  { label: '参数JSON', field: 'params_json', type: 'textarea' as const, span: 24 },
  { label: '启用', field: 'enabled', type: 'select' as const, options: [{ label: '启用', value: '1' }, { label: '禁用', value: '0' }] },
  { label: '备注', field: 'remark', type: 'textarea' as const, span: 24 },
]
</script>
<template>
  <SecCrudPage title="扫描任务" :api-list="ApiSecScanTask.getList" :api-add="ApiSecScanTask.add" :api-edit="ApiSecScanTask.edit" :api-delete="ApiSecScanTask.delete" :columns="columns" :fields="fields" id-field="id" name-field="task_name" />
</template>
