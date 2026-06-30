<script lang="ts" setup>
import SecCrudPage from './components/SecCrudPage.vue'
import { ApiSecTestEnv } from '@/api/apis'
defineOptions({ name: 'SecTestEnv' })
const columns = [
  { title: '环境名称', dataIndex: 'env_name', width: 140 },
  { title: '环境类型', dataIndex: 'env_type', width: 100 },
  { title: 'Base URL', dataIndex: 'base_url', ellipsis: true, tooltip: true },
  { title: 'API前缀', dataIndex: 'api_prefix', width: 120 },
  { title: '凭证代码', dataIndex: 'credential_code', width: 120 },
  { title: '状态', dataIndex: 'status', width: 60 },
  { title: '操作', dataIndex: 'operations', slot: 'operations', width: 120, fixed: 'right' as const },
]
const fields = [
  { label: '环境名称', field: 'env_name', required: true },
  { label: '环境类型', field: 'env_type', type: 'select' as const, options: [{ label: '开发', value: 'dev' }, { label: '测试', value: 'test' }, { label: '预发', value: 'staging' }, { label: '生产', value: 'prod' }] },
  { label: '项目组ID', field: 'project_group_id' },
  { label: 'Base URL', field: 'base_url', span: 24 },
  { label: 'API前缀', field: 'api_prefix' },
  { label: '数据库连接', field: 'db_conn_str', span: 24 },
  { label: '凭证代码', field: 'credential_code' },
  { label: '状态', field: 'status', type: 'select' as const, options: [{ label: '启用', value: '1' }, { label: '禁用', value: '0' }] },
  { label: '备注', field: 'remark', type: 'textarea' as const, span: 24 },
]
</script>
<template>
  <SecCrudPage title="测试环境" :api-list="ApiSecTestEnv.getList" :api-add="ApiSecTestEnv.add" :api-edit="ApiSecTestEnv.edit" :api-delete="ApiSecTestEnv.delete" :columns="columns" :fields="fields" id-field="id" name-field="env_name" />
</template>
