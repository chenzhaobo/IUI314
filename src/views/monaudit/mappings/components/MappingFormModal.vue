<script setup lang="ts">
/** 领域映射新增 / 编辑弹窗：默认处理人候选为所选项目组成员 */
import type { LabelValue } from '../../shared/types'
import type { MappingForm } from '../types'
import { MATCH_TYPE, tagOptions } from '../../shared/types'

defineProps<{
  loading: boolean
  projectGroups: LabelValue[]
  handlerOptions: LabelValue[]
  handlerLoading: boolean
  submit: () => Promise<boolean>
}>()

const emit = defineEmits<{
  (e: 'groupChange'): void
}>()

const visible = defineModel<boolean>('visible', { required: true })
const form = defineModel<MappingForm>('form', { required: true })

const matchTypeOptions = tagOptions(MATCH_TYPE)

const PATTERN_HINT: Record<string, string> = {
  domain_exact: '领域精确等于该值，如 fi.er',
  domain_prefix: '领域以该值开头，如 tmc.（最长前缀优先）',
  class_prefix: '调用类以该包名开头，如 kd.hr.hspm（最长前缀优先）',
}
</script>

<template>
  <a-modal
    v-model:visible="visible"
    :title="form.id ? '编辑映射' : '新增映射'"
    :ok-loading="loading"
    :on-before-ok="submit"
    :width="560"
  >
    <a-form :model="form" layout="vertical">
      <a-form-item label="匹配方式" required>
        <a-radio-group v-model="form.match_type" type="button">
          <a-radio v-for="opt in matchTypeOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </a-radio>
        </a-radio-group>
      </a-form-item>
      <a-form-item label="匹配值" required :extra="PATTERN_HINT[form.match_type]">
        <a-input v-model="form.pattern" allow-clear />
      </a-form-item>
      <a-form-item label="项目组" required>
        <a-select
          v-model="form.project_group_id"
          :options="projectGroups"
          placeholder="选择项目组"
          allow-search
          @change="emit('groupChange')"
        />
      </a-form-item>
      <a-form-item label="默认处理人" extra="新问题归属到该映射且未分派时，自动分派给此人">
        <a-select
          v-model="form.default_handler_id"
          :options="handlerOptions"
          :loading="handlerLoading"
          :disabled="!form.project_group_id"
          placeholder="可选"
          allow-clear
          allow-search
        />
      </a-form-item>
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="优先级" extra="同长度规则按数值升序">
            <a-input-number v-model="form.priority" :min="0" :max="9999" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="启用">
            <a-switch v-model="form.status" checked-value="1" unchecked-value="0" />
          </a-form-item>
        </a-col>
      </a-row>
      <a-form-item label="备注">
        <a-textarea v-model="form.remark" :auto-size="{ minRows: 2, maxRows: 4 }" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>
