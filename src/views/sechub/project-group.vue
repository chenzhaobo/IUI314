<script lang="ts" setup>
import { computed } from 'vue'
import SecCrudPage from './components/SecCrudPage.vue'
import { useGet } from '@/hooks'
import { ApiSecProjectGroup, ApiSysDictData } from '@/api/apis'

defineOptions({ name: 'SecProjectGroup' })

// ── 数据字典：产品领域 / 业务领域 ──────────────────────
const { data: domainDict } = useGet<any>(ApiSysDictData.getByType, { dict_type: 'sec_pg_product_domain' }, { immediate: true })
const { data: areaDict } = useGet<any>(ApiSysDictData.getByType, { dict_type: 'sec_pg_business_area' }, { immediate: true })

const domainOptions = computed(() => (Array.isArray(domainDict.value) ? domainDict.value : []).map((d: any) => ({ label: d.dict_label, value: d.dict_value })))
const areaOptions = computed(() => (Array.isArray(areaDict.value) ? areaDict.value : []).map((d: any) => ({ label: d.dict_label, value: d.dict_value })))

const columns = [
  { title: '名称', dataIndex: 'name', width: 160, ellipsis: true, tooltip: true },
  { title: '代码', dataIndex: 'code', width: 120 },
  { title: '产品领域', dataIndex: 'product_group_name', width: 120 },
  { title: 'Scrum团队', dataIndex: 'scrum_team_name', width: 120 },
  { title: '云名称', dataIndex: 'cloud_name', width: 100 },
  { title: '业务领域', dataIndex: 'business_area', width: 100 },
  { title: '安全SE', dataIndex: 'security_se', width: 100 },
  { title: '产品总监', dataIndex: 'product_director', width: 100 },
  { title: '开发总监', dataIndex: 'dev_director', width: 100 },
  { title: '领域架构师', dataIndex: 'domain_architect', width: 100 },
  { title: '排序', dataIndex: 'order_num', width: 60 },
  { title: '状态', dataIndex: 'status', width: 60 },
  { title: '操作', dataIndex: 'operations', slotName: 'operations', width: 120, fixed: 'right' as const },
]

const filters = computed(() => [
  { label: '产品领域', field: 'product_group_name', type: 'select' as const, options: domainOptions.value, placeholder: '选择产品领域' },
  { label: '业务领域', field: 'business_area', type: 'select' as const, options: areaOptions.value, placeholder: '选择业务领域' },
])

const fields = computed(() => [
  { label: '名称', field: 'name', required: true },
  { label: '代码', field: 'code', required: true },
  { label: '产品领域', field: 'product_group_name', type: 'select' as const, options: domainOptions.value },
  { label: 'Scrum团队', field: 'scrum_team_name' },
  { label: '云名称', field: 'cloud_name' },
  { label: '业务领域', field: 'business_area', type: 'select' as const, options: areaOptions.value },
  { label: '安全SE', field: 'security_se' },
  { label: '产品总监', field: 'product_director' },
  { label: '开发总监', field: 'dev_director' },
  { label: '领域架构师', field: 'domain_architect' },
  { label: '云之家群ID', field: 'yzj_group_id' },
  { label: '联系邮箱', field: 'contact_emails', span: 24 },
  { label: '排序', field: 'order_num', type: 'number' as const },
  { label: '状态', field: 'status', type: 'select' as const, options: [{ label: '启用', value: '1' }, { label: '禁用', value: '0' }] },
  { label: '备注', field: 'remark', type: 'textarea' as const, span: 24 },
])
</script>
<template>
  <SecCrudPage title="项目组" :api-list="ApiSecProjectGroup.getList" :api-add="ApiSecProjectGroup.add" :api-edit="ApiSecProjectGroup.edit" :api-delete="ApiSecProjectGroup.delete" :columns="columns" :fields="fields" :filters="filters" id-field="id" name-field="name" />
</template>
