<script lang="ts" setup>
import { computed } from 'vue'
import SecCrudPage from './components/SecCrudPage.vue'
import { ApiSecReleaseWindow, ApiSecTestEnv } from '@/api/apis'
import { useGet } from '@/hooks'

defineOptions({ name: 'test-env' })

// 字段以 sec_test_env 实际列为准：env_url（不是 base_url）、release_window_id（必填）、
// env_account；旧页面的 api_prefix / db_conn_str / credential_code / status 在表里不存在。
const columns = [
  { title: '环境名称', dataIndex: 'env_name', width: 150 },
  { title: '类型', dataIndex: 'env_type', width: 70 },
  { title: '发布窗口', dataIndex: 'release_window_id', width: 150, ellipsis: true, tooltip: true },
  { title: '项目组', dataIndex: 'project_group_id', width: 120, ellipsis: true, tooltip: true },
  { title: '业务领域', dataIndex: 'business_area', width: 110 },
  { title: '安全接口人', dataIndex: 'security_contact', width: 110 },
  { title: '环境地址', dataIndex: 'env_url', width: 220, ellipsis: true, tooltip: true },
  { title: '账号说明', dataIndex: 'env_account', width: 140, ellipsis: true, tooltip: true },
  { title: '操作', dataIndex: 'operations', slotName: 'operations', width: 120, fixed: 'right' as const },
]

const { data: windowRes } = useGet<any>(ApiSecReleaseWindow.getList, { page_num: 1, page_size: 200 }, { immediate: true })
const releaseWindowOptions = computed(() =>
  (Array.isArray(windowRes.value?.list) ? windowRes.value.list : []).map((w: any) => ({
    label: w.name ? `${w.code} ${w.name}` : w.code,
    value: w.id,
  })),
)

const fields = computed(() => [
  { label: '发布窗口', field: 'release_window_id', type: 'select' as const, required: true, options: releaseWindowOptions.value },
  { label: '环境类型', field: 'env_type', type: 'select' as const, required: true, options: [
    { label: 'SIT', value: 'sit' },
    { label: 'UAT', value: 'uat' },
    { label: '生产', value: 'prod' },
    { label: '性能', value: 'perf' },
  ] },
  { label: '环境名称', field: 'env_name' },
  { label: '项目组ID', field: 'project_group_id' },
  { label: '业务领域', field: 'business_area' },
  { label: '安全接口人', field: 'security_contact' },
  { label: '环境地址', field: 'env_url', span: 24 },
  { label: '账号说明', field: 'env_account' },
  { label: '备注', field: 'remark', type: 'textarea' as const, span: 24 },
])
</script>

<template>
  <SecCrudPage
    title="测试环境"
    :api-list="ApiSecTestEnv.getList"
    :api-add="ApiSecTestEnv.add"
    :api-edit="ApiSecTestEnv.edit"
    :api-delete="ApiSecTestEnv.delete"
    :columns="columns"
    :fields="fields"
    id-field="id"
    name-field="env_name"
  />
</template>
