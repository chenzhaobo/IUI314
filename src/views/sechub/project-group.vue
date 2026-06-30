<script lang="ts" setup>
import SecCrudPage from './components/SecCrudPage.vue'
import { ApiSecProjectGroup } from '@/api/apis'

defineOptions({ name: 'SecProjectGroup' })

const columns = [
  { title: '名称', dataIndex: 'name', width: 160, ellipsis: true, tooltip: true },
  { title: '代码', dataIndex: 'code', width: 120 },
  { title: '产品组', dataIndex: 'product_group_name', width: 120 },
  { title: 'Scrum团队', dataIndex: 'scrum_team_name', width: 120 },
  { title: '云名称', dataIndex: 'cloud_name', width: 100 },
  { title: '业务域', dataIndex: 'business_area', width: 100 },
  { title: '安全SE', dataIndex: 'security_se', width: 100 },
  { title: '排序', dataIndex: 'order_num', width: 60 },
  { title: '状态', dataIndex: 'status', width: 60 },
  { title: '操作', dataIndex: 'operations', slot: 'operations', width: 120, fixed: 'right' as const },
]
const fields = [
  { label: '名称', field: 'name', required: true },
  { label: '代码', field: 'code', required: true },
  { label: '产品组', field: 'product_group_name' },
  { label: 'Scrum团队', field: 'scrum_team_name' },
  { label: '云名称', field: 'cloud_name' },
  { label: '业务域', field: 'business_area' },
  { label: '安全SE', field: 'security_se' },
  { label: '云之家群ID', field: 'yzj_group_id' },
  { label: '联系邮箱', field: 'contact_emails', span: 24 },
  { label: '排序', field: 'order_num', type: 'number' as const },
  { label: '状态', field: 'status', type: 'select' as const, options: [{ label: '启用', value: '1' }, { label: '禁用', value: '0' }] },
  { label: '备注', field: 'remark', type: 'textarea' as const, span: 24 },
]
</script>
<template>
  <SecCrudPage title="项目组" :api-list="ApiSecProjectGroup.getList" :api-add="ApiSecProjectGroup.add" :api-edit="ApiSecProjectGroup.edit" :api-delete="ApiSecProjectGroup.delete" :columns="columns" :fields="fields" id-field="id" name-field="name" />
</template>
