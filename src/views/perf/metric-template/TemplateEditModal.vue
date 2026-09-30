<script lang="ts" setup>
/**
 * 指标模板编辑 / 新增弹窗（同一个组件两种模式）。
 *
 * 编辑模式只放开后端 `TemplateEditReq` 接受的四个字段（显示名 / PromQL / 启用 / 备注），
 * 身份字段（service_type、metric_key、unit、agg、prom_purpose）只读 —— 后端也不接受它们，
 * 放开输入只会让用户以为改得动。
 */
import type { TemplateForm } from './types'
import { AGG_OPTIONS, PROM_PURPOSE_OPTIONS, SERVICE_TYPE_OPTIONS, UNIT_OPTIONS } from './types'

defineProps<{
  mode: 'edit' | 'add'
  submitting: boolean
}>()
const emit = defineEmits<{
  (e: 'submit'): void
}>()
const visible = defineModel<boolean>('visible', { required: true })
const form = defineModel<TemplateForm>('form', { required: true })
</script>

<template>
  <a-modal
    v-model:visible="visible"
    :title="mode === 'edit' ? '编辑指标模板' : '新增自定义指标模板'"
    :width="720"
    :ok-loading="submitting"
    :ok-text="mode === 'edit' ? '保存' : '新增'"
    @ok="emit('submit')"
  >
    <a-form :model="form" layout="vertical">
      <a-row :gutter="16">
        <a-col :span="8">
          <a-form-item label="服务类型" required>
            <a-select
              v-model="form.service_type"
              :options="SERVICE_TYPE_OPTIONS"
              :disabled="mode === 'edit'"
            />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="metric_key" required>
            <a-input
              v-model="form.metric_key"
              placeholder="如 cpu_cores"
              :disabled="mode === 'edit'"
            />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="排序">
            <a-input-number
              v-model="form.sort"
              :min="0"
              :disabled="mode === 'edit'"
              class="mtm-num"
            />
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item label="显示名" required>
        <a-input v-model="form.display_name" placeholder="如 容器 CPU（核）" />
      </a-form-item>

      <a-form-item label="PromQL 模板" required>
        <template #extra>
          占位符在回查时按绑定目标替换：<code v-pre>{{namespace}}</code> <code v-pre>{{pod_re}}</code>
          <code v-pre>{{instance}}</code> <code v-pre>{{env_label}}</code> <code v-pre>{{app}}</code>
        </template>
        <a-textarea v-model="form.promql_tpl" :auto-size="{ minRows: 3, maxRows: 8 }" />
      </a-form-item>

      <a-row :gutter="16">
        <a-col :span="8">
          <a-form-item label="单位">
            <a-select v-model="form.unit" :options="UNIT_OPTIONS" :disabled="mode === 'edit'" />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="展示口径">
            <a-select v-model="form.agg" :options="AGG_OPTIONS" :disabled="mode === 'edit'" />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="数据源">
            <a-select
              v-model="form.prom_purpose"
              :options="PROM_PURPOSE_OPTIONS"
              :disabled="mode === 'edit'"
            />
          </a-form-item>
        </a-col>
      </a-row>

      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="启用">
            <a-switch v-model="form.enabled" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="备注">
            <a-input v-model="form.remark" placeholder="用途 / 口径说明" />
          </a-form-item>
        </a-col>
      </a-row>
    </a-form>
  </a-modal>
</template>

<style scoped>
.mtm-num {
  width: 100%;
}
</style>
