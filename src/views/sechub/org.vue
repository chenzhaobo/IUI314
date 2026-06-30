<script lang="ts" setup>
import SecCrudPage from './components/SecCrudPage.vue'
import { ApiSecOrg } from '@/api/apis'
defineOptions({ name: 'SecOrg' })
const columns = [
  { title: '名称', dataIndex: 'name', width: 160, ellipsis: true, tooltip: true },
  { title: '代码', dataIndex: 'code', width: 120 },
  { title: '组织类型', dataIndex: 'org_type', width: 100 },
  { title: '全路径', dataIndex: 'full_path', width: 200, ellipsis: true, tooltip: true },
  { title: '层级', dataIndex: 'level_no', width: 60 },
  { title: '排序', dataIndex: 'order_num', width: 60 },
  { title: '状态', dataIndex: 'status', width: 60 },
  { title: '操作', dataIndex: 'operations', slot: 'operations', width: 120, fixed: 'right' as const },
]
const fields = [
  { label: '父节点ID', field: 'pid' },
  { label: '组织类型', field: 'org_type', type: 'select' as const, options: [{ label: '云', value: 'cloud' }, { label: '应用', value: 'app' }, { label: '菜单L1', value: 'menu_l1' }, { label: '菜单L2', value: 'menu_l2' }, { label: '菜单L3', value: 'menu_l3' }, { label: '菜单L4', value: 'menu_l4' }] },
  { label: '名称', field: 'name', required: true },
  { label: '代码', field: 'code' },
  { label: '全路径', field: 'full_path', span: 24 },
  { label: '层级', field: 'level_no', type: 'number' as const },
  { label: '排序', field: 'order_num', type: 'number' as const },
  { label: '状态', field: 'status', type: 'select' as const, options: [{ label: '启用', value: '1' }, { label: '禁用', value: '0' }] },
  { label: '备注', field: 'remark', type: 'textarea' as const, span: 24 },
]
</script>
<template>
  <SecCrudPage title="组织管理" :api-list="ApiSecOrg.getList" :api-add="ApiSecOrg.add" :api-edit="ApiSecOrg.edit" :api-delete="ApiSecOrg.delete" :columns="columns" :fields="fields" id-field="id" name-field="name" />
</template>
