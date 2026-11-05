<script setup lang="ts">
/**
 * 问题清单的批量弹窗：批量填写 / 分派 / 归类到项目组。
 *
 * 状态与提交在 useIssueBatch；提交函数返回 false 时弹窗保持打开。
 */
import type { LabelValue } from '../../shared/types'
import type { ClassifyForm, HandleForm } from '../types'
import IssueHandleFields from './IssueHandleFields.vue'

defineProps<{
  selectedCount: number
  submitting: boolean
  handlerOptions: LabelValue[]
  handlerLoading: boolean
  projectGroups: LabelValue[]
  submitEdit: () => Promise<boolean>
  submitAssign: () => Promise<boolean>
  submitClassify: () => Promise<boolean>
}>()

const editVisible = defineModel<boolean>('editVisible', { required: true })
const editForm = defineModel<HandleForm>('editForm', { required: true })
const assignVisible = defineModel<boolean>('assignVisible', { required: true })
const assignHandler = defineModel<string>('assignHandler', { required: true })
const classifyVisible = defineModel<boolean>('classifyVisible', { required: true })
const classifyForm = defineModel<ClassifyForm>('classifyForm', { required: true })
</script>

<template>
  <div class="batch-modals">
    <a-modal
      v-model:visible="editVisible"
      :title="`批量填写（${selectedCount} 条）`"
      :ok-loading="submitting"
      :on-before-ok="submitEdit"
    >
      <IssueHandleFields v-model:form="editForm" batch />
    </a-modal>

    <a-modal
      v-model:visible="assignVisible"
      :title="`分派处理人（${selectedCount} 条）`"
      :ok-loading="submitting"
      :on-before-ok="submitAssign"
    >
      <a-form layout="vertical" :model="{}">
        <a-form-item label="处理人" extra="候选为所选问题所属项目组的成员；留空 = 取消分派">
          <a-select
            v-model="assignHandler"
            :options="handlerOptions"
            :loading="handlerLoading"
            placeholder="选择处理人"
            allow-clear
            allow-search
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:visible="classifyVisible"
      :title="`归类到项目组（${selectedCount} 条）`"
      :ok-loading="submitting"
      :on-before-ok="submitClassify"
    >
      <a-form layout="vertical" :model="classifyForm">
        <a-form-item label="项目组" required>
          <a-select v-model="classifyForm.project_group_id" :options="projectGroups" placeholder="选择项目组" allow-search />
        </a-form-item>
        <a-form-item extra="按问题的领域（无领域时按调用类前 3 段包名）建映射，后续同类问题自动归属">
          <a-checkbox v-model="classifyForm.create_mapping">
            同时建立映射规则
          </a-checkbox>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
