<script lang="ts" setup>
import SecCrudPage from './components/SecCrudPage.vue'
import { ApiSecUserStory } from '@/api/apis'
defineOptions({ name: 'SecUserStory' })
const columns = [
  { title: '故事代码', dataIndex: 'story_code', width: 120 },
  { title: '故事标题', dataIndex: 'story_title', width: 200, ellipsis: true, tooltip: true },
  { title: '状态', dataIndex: 'story_status', width: 100 },
  { title: '安全属性', dataIndex: 'security_attribute', width: 120, ellipsis: true, tooltip: true },
  { title: 'PIA状态', dataIndex: 'pia_status', width: 80 },
  { title: '测试用例', dataIndex: 'test_case_count', width: 80 },
  { title: '发现数', dataIndex: 'finding_count', width: 80 },
  { title: '缺陷数', dataIndex: 'defect_count', width: 80 },
  { title: '操作', dataIndex: 'operations', slotName: 'operations', width: 120, fixed: 'right' as const },
]
const fields = [
  { label: '故事代码', field: 'story_code', required: true },
  { label: '故事标题', field: 'story_title', required: true, span: 24 },
  { label: '项目组ID', field: 'project_group_id' },
  { label: '发布窗口ID', field: 'release_window_id' },
  { label: '状态', field: 'story_status', type: 'select' as const, options: [{ label: '待分析', value: 'pending' }, { label: '分析中', value: 'analyzing' }, { label: '已分析', value: 'analyzed' }, { label: '已测试', value: 'tested' }, { label: '已关闭', value: 'closed' }] },
  { label: '安全属性', field: 'security_attribute', span: 24 },
  { label: '威胁模型ID', field: 'threat_model_id' },
  { label: 'PIA状态', field: 'pia_status', type: 'select' as const, options: [{ label: '未评估', value: 'pending' }, { label: '已评估', value: 'assessed' }, { label: '需复审', value: 'review' }] },
  { label: '备注', field: 'remark', type: 'textarea' as const, span: 24 },
]
</script>
<template>
  <SecCrudPage title="用户故事" :api-list="ApiSecUserStory.getList" :api-add="ApiSecUserStory.add" :api-edit="ApiSecUserStory.edit" :api-delete="ApiSecUserStory.delete" :columns="columns" :fields="fields" id-field="id" name-field="story_title" />
</template>
