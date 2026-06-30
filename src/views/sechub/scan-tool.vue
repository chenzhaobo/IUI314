<script lang="ts" setup>
import SecCrudPage from './components/SecCrudPage.vue'
import { ApiSecScanTool } from '@/api/apis'

defineOptions({ name: 'SecScanTool' })

const columns = [
  { title: '工具代码', dataIndex: 'code', width: 120 },
  { title: '工具名称', dataIndex: 'name', width: 160, ellipsis: true, tooltip: true },
  { title: '分类', dataIndex: 'category', width: 100 },
  { title: '自动化级别', dataIndex: 'automation_level', width: 100 },
  { title: 'Runner类型', dataIndex: 'runner_type', width: 100 },
  { title: '运行命令', dataIndex: 'runner_cmd', ellipsis: true, tooltip: true },
  { title: '文档URL', dataIndex: 'docs_url', width: 120, ellipsis: true, tooltip: true },
  { title: '排序', dataIndex: 'order_num', width: 60 },
  { title: '状态', dataIndex: 'status', width: 60 },
  { title: '操作', dataIndex: 'operations', slot: 'operations', width: 120, fixed: 'right' as const },
]

const fields = [
  { label: '工具代码', field: 'code', required: true },
  { label: '工具名称', field: 'name', required: true },
  { label: '分类', field: 'category', type: 'select' as const, options: [
    { label: 'SAST', value: 'sast' },
    { label: 'DAST', value: 'dast' },
    { label: 'SCA', value: 'sca' },
    { label: 'IAST', value: 'iast' },
    { label: '其他', value: 'other' },
  ]},
  { label: '自动化级别', field: 'automation_level', type: 'select' as const, options: [
    { label: '全自动', value: 'full' },
    { label: '半自动', value: 'semi' },
    { label: '手动', value: 'manual' },
  ]},
  { label: 'Runner类型', field: 'runner_type', type: 'select' as const, options: [
    { label: 'CLI', value: 'cli' },
    { label: 'Docker', value: 'docker' },
    { label: 'API', value: 'api' },
  ]},
  { label: '运行命令', field: 'runner_cmd', span: 24 },
  { label: '默认参数', field: 'default_params', span: 24 },
  { label: '凭证代码', field: 'credential_code' },
  { label: '文档URL', field: 'docs_url' },
  { label: '排序', field: 'order_num', type: 'number' as const },
  { label: '状态', field: 'status', type: 'select' as const, options: [
    { label: '启用', value: '1' },
    { label: '禁用', value: '0' },
  ]},
  { label: '备注', field: 'remark', type: 'textarea' as const, span: 24 },
]
</script>

<template>
  <SecCrudPage
    title="扫描工具"
    :api-list="ApiSecScanTool.getList"
    :api-add="ApiSecScanTool.add"
    :api-edit="ApiSecScanTool.edit"
    :api-delete="ApiSecScanTool.delete"
    :columns="columns"
    :fields="fields"
    id-field="id"
    name-field="name"
  />
</template>
