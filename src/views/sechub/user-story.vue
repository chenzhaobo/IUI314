<script lang="ts" setup>
import { computed } from 'vue'
import SecCrudPage from './components/SecCrudPage.vue'
import { ApiSecReleaseWindow, ApiSecUserStory } from '@/api/apis'
import { useGet } from '@/hooks'

defineOptions({ name: 'user-story' })

// 字段以 sec_user_story 实际列为准（story_name / security_risk_level / has_security_story），
// 不再使用旧页面里的 story_title / security_attribute / pia_status 等不存在的列。
const columns = [
  { title: '故事代码', dataIndex: 'story_code', width: 130 },
  { title: '故事标题', dataIndex: 'story_name', width: 240, ellipsis: true, tooltip: true },
  { title: '状态', dataIndex: 'story_status', width: 110 },
  { title: '优先级', dataIndex: 'priority', width: 80 },
  { title: '项目组', dataIndex: 'project_group_id', width: 120, ellipsis: true, tooltip: true },
  { title: '发布窗口', dataIndex: 'release_window_code', width: 140, ellipsis: true, tooltip: true },
  { title: '安全风险', dataIndex: 'security_risk_level', width: 90 },
  { title: '安全故事', dataIndex: 'has_security_story', width: 90 },
  { title: '来源', dataIndex: 'source', width: 100, ellipsis: true, tooltip: true },
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
  { label: '故事代码', field: 'story_code', required: true },
  { label: '故事标题', field: 'story_name', required: true, span: 24 },
  { label: '状态', field: 'story_status', type: 'select' as const, options: [
    { label: '计划', value: '计划' },
    { label: '需求编写完成', value: '需求编写完成' },
    { label: '基线测试完成', value: '基线测试完成' },
    { label: '发布完成', value: '发布完成' },
  ] },
  { label: '需求类型', field: 'story_type', type: 'select' as const, options: [
    { label: '软件需求', value: '软件需求' },
    { label: '产品需求分析', value: '产品需求分析' },
    { label: '研发内部', value: '研发内部' },
  ] },
  { label: '优先级', field: 'priority' },
  { label: '项目组ID', field: 'project_group_id' },
  { label: '发布窗口', field: 'release_window_id', type: 'select' as const, options: releaseWindowOptions.value },
  { label: '安全风险', field: 'security_risk_level', type: 'select' as const, options: [
    { label: '高', value: 'high' },
    { label: '中', value: 'medium' },
    { label: '低', value: 'low' },
    { label: '无', value: 'none' },
  ] },
  { label: '已建安全故事', field: 'has_security_story', type: 'select' as const, options: [
    { label: '否', value: '0' },
    { label: '是', value: '1' },
  ] },
  { label: '安全SE', field: 'security_se' },
  { label: '来源', field: 'source' },
  { label: '客户', field: 'customer_name' },
  { label: '负责人', field: 'owner_names' },
  { label: '开发人员', field: 'dev_names' },
  { label: '测试人员', field: 'test_names' },
  { label: '迭代阶段', field: 'iteration_phase' },
  { label: '发布计划', field: 'release_plan' },
  { label: '应用', field: 'app_name' },
  { label: '所属云', field: 'cloud_name' },
  { label: '故事描述', field: 'story_description', type: 'textarea' as const, span: 24 },
  { label: '验收标准', field: 'acceptance_criteria', type: 'textarea' as const, span: 24 },
])
</script>

<template>
  <SecCrudPage
    title="用户故事"
    :api-list="ApiSecUserStory.getList"
    :api-add="ApiSecUserStory.add"
    :api-edit="ApiSecUserStory.edit"
    :api-delete="ApiSecUserStory.delete"
    :columns="columns"
    :fields="fields"
    id-field="id"
    name-field="story_name"
  />
</template>
