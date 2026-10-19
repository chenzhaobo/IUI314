<script lang="ts" setup>
import SecCrudPage from './components/SecCrudPage.vue'
import { ApiSecReleaseWindow } from '@/api/apis'

defineOptions({ name: 'release-window' })

// 字段以 sec_release_window 实际列为准（code / name / window_type / planned_release_at /
// actual_release_at），不再使用旧页面里的 window_code / window_name / start_date 等别名。
const columns = [
  { title: '窗口代码', dataIndex: 'code', width: 130 },
  { title: '窗口名称', dataIndex: 'name', width: 180, ellipsis: true, tooltip: true },
  { title: '类型', dataIndex: 'window_type', width: 90 },
  { title: '季度', dataIndex: 'quarter', width: 90 },
  { title: '计划发布', dataIndex: 'planned_release_at', width: 110 },
  { title: '实际发布', dataIndex: 'actual_release_at', width: 110 },
  { title: '当前窗口', dataIndex: 'is_current', width: 90 },
  { title: '状态', dataIndex: 'status', width: 70 },
  { title: '操作', dataIndex: 'operations', slotName: 'operations', width: 120, fixed: 'right' as const },
]

const fields = [
  { label: '窗口代码', field: 'code', required: true },
  { label: '窗口名称', field: 'name', required: true },
  { label: '窗口类型', field: 'window_type', type: 'select' as const, required: true, options: [
    { label: 'Release', value: 'release' },
    { label: '迭代', value: 'iteration' },
    { label: '补丁', value: 'patch' },
  ] },
  { label: '父窗口ID', field: 'pid' },
  { label: '季度', field: 'quarter' },
  { label: '计划发布日期', field: 'planned_release_at', type: 'date' as const },
  { label: '实际发布日期', field: 'actual_release_at', type: 'date' as const },
  { label: '补丁状态', field: 'patch_status' },
  { label: '当前窗口', field: 'is_current', type: 'select' as const, options: [
    { label: '否', value: '0' },
    { label: '是', value: '1' },
  ] },
  { label: '状态', field: 'status', type: 'select' as const, options: [
    { label: '禁用', value: '0' },
    { label: '启用', value: '1' },
  ] },
  { label: '备注', field: 'remark', type: 'textarea' as const, span: 24 },
]
</script>

<template>
  <SecCrudPage
    title="发布窗口"
    :api-list="ApiSecReleaseWindow.getList"
    :api-add="ApiSecReleaseWindow.add"
    :api-edit="ApiSecReleaseWindow.edit"
    :api-delete="ApiSecReleaseWindow.delete"
    :columns="columns"
    :fields="fields"
    id-field="id"
    name-field="name"
  />
</template>
