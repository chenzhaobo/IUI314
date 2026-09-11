<script lang="ts" setup>
/**
 * 测试类型维护（安全测试 → 表单测试）
 *
 * 测试类型字典（sec_test_type）：表单概览的列、用例/结果页的类型下拉都由它驱动。
 *   · source=cases      → 该类型按 sec_sec_case 口径统计（case_type[/test_type] 过滤）
 *   · source=meta_scan  → 该类型按 sec_meta_scan_form 三态口径统计（元数据直扫）
 * 内置类型（表单权限/静态权限检查/静态日志检查…）不可删、不可改 code/case_type（执行器按它们取数）。
 */
import SecCrudPage from './components/SecCrudPage.vue'
import { ApiSecFormTest } from '@/api/sechubApis'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive :include 按它对上缓存
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'test-types' })

const columns = [
  { title: '类型编码', dataIndex: 'code', width: 150 },
  { title: '类型名称', dataIndex: 'name', width: 140, ellipsis: true, tooltip: true },
  { title: '分类', dataIndex: 'category', width: 90 },
  { title: '数据来源', dataIndex: 'source', width: 100 },
  { title: '用例类型', dataIndex: 'case_type', width: 140, ellipsis: true, tooltip: true },
  { title: '测试类型', dataIndex: 'test_type', width: 110 },
  { title: '排序', dataIndex: 'order_sort', width: 70 },
  { title: '启用', dataIndex: 'enabled', width: 70 },
  { title: '内置', dataIndex: 'is_builtin', width: 70 },
  { title: '备注', dataIndex: 'remark', ellipsis: true, tooltip: true },
  { title: '操作', dataIndex: 'operations', slotName: 'operations', width: 120, fixed: 'right' as const },
]

const fields = [
  { label: '类型编码', field: 'code', required: true, placeholder: '如 form_perm（内置类型不可改）' },
  { label: '类型名称', field: 'name', required: true },
  { label: '分类', field: 'category', type: 'select' as const, options: [
    { label: '表单权限', value: 'form' },
    { label: '静态检查', value: 'meta' },
    { label: '注入', value: 'inject' },
    { label: 'API', value: 'api' },
  ]},
  { label: '数据来源', field: 'source', type: 'select' as const, options: [
    { label: '用例统计（cases）', value: 'cases' },
    { label: '元数据直扫（meta_scan）', value: 'meta_scan' },
  ]},
  { label: '用例类型', field: 'case_type', placeholder: 'sec_sec_case.case_type' },
  { label: '测试类型', field: 'test_type', placeholder: 'sec_sec_case.test_type（可空）' },
  { label: '颜色', field: 'color', placeholder: 'Arco 颜色名，如 arcoblue' },
  { label: '排序', field: 'order_sort', type: 'number' as const },
  { label: '启用', field: 'enabled', type: 'select' as const, options: [
    { label: '启用', value: 'Y' },
    { label: '停用', value: 'N' },
  ]},
  { label: '备注', field: 'remark', type: 'textarea' as const, span: 24 },
]

const filters = [
  { label: '分类', field: 'category', type: 'select' as const, options: [
    { label: '表单权限', value: 'form' },
    { label: '静态检查', value: 'meta' },
    { label: '注入', value: 'inject' },
    { label: 'API', value: 'api' },
  ]},
  { label: '启用', field: 'enabled', type: 'select' as const, options: [
    { label: '启用', value: 'Y' },
    { label: '停用', value: 'N' },
  ]},
]
</script>

<template>
  <SecCrudPage
    title="测试类型"
    :api-list="ApiSecFormTest.typeList"
    :api-add="ApiSecFormTest.typeList"
    :api-edit="ApiSecFormTest.typeList"
    :api-delete="ApiSecFormTest.typeDelete"
    :columns="columns"
    :fields="fields"
    :filters="filters"
    id-field="id"
    name-field="name"
  />
</template>
