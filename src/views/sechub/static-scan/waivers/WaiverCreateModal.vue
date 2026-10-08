<script setup lang="ts">
/**
 * 新建白名单申请弹窗（从 waivers.vue 拆出，控制页面规模）。
 * 状态与提交仍在 ./useWaivers，这里只渲染表单；20261008 B 增加可选的方法名范围。
 */
import type { WaiverForm } from './types'
import type { SelectOption } from '@/types/static-scan'
import {
  WAIVER_METHOD_PATTERN_PLACEHOLDER,
  WAIVER_PATH_GLOB_PLACEHOLDER,
  WAIVER_SCOPE_KIND_OPTIONS,
  WAIVER_TYPE_OPTIONS,
  waiverSupportsMethodPattern,
} from './types'

defineProps<{
  loading: boolean
  pgOptions: SelectOption[]
  scopeValueOptions: SelectOption[]
}>()
const emit = defineEmits<{ submit: [], scopeKindChange: [] }>()
const visible = defineModel<boolean>('visible', { required: true })
const form = defineModel<WaiverForm>('form', { required: true })
</script>

<template>
  <a-modal v-model:visible="visible" title="新建白名单申请" :ok-loading="loading" @ok="emit('submit')">
    <a-form :model="form" layout="vertical">
      <a-form-item label="白名单类型">
        <a-select v-model="form.waiver_type" :options="WAIVER_TYPE_OPTIONS" placeholder="不选则由规则版本/路径推断" allow-clear />
      </a-form-item>
      <a-form-item label="规则版本ID" required>
        <a-input v-model="form.rule_version_id" placeholder="规则版本 ID（范围排除可留空）" data-testid="form-rule-version" />
      </a-form-item>
      <a-form-item label="规则代码">
        <a-input v-model="form.rule_code" placeholder="如: SEC-001" />
      </a-form-item>
      <a-form-item label="豁免范围维度">
        <a-select
          v-model="form.scope_kind"
          :options="WAIVER_SCOPE_KIND_OPTIONS"
          placeholder="可选；选了才发送 scope_kind"
          allow-clear
          @change="emit('scopeKindChange')"
        />
      </a-form-item>
      <a-form-item label="范围值">
        <!-- 枚举维度走下拉，path_glob 走自由输入的 glob；顺序由 scopeValueOptions 决定，模板不猜 -->
        <a-select
          v-if="scopeValueOptions.length"
          v-model="form.scope_value"
          :options="scopeValueOptions"
          placeholder="选择范围值"
          allow-clear
        />
        <a-input
          v-else
          v-model="form.scope_value"
          :disabled="!form.scope_kind"
          :placeholder="form.scope_kind ? WAIVER_PATH_GLOB_PLACEHOLDER : '先选豁免范围维度'"
        />
      </a-form-item>
      <a-form-item v-if="waiverSupportsMethodPattern(form.waiver_type)" label="方法名范围">
        <a-input v-model="form.method_pattern" :placeholder="WAIVER_METHOD_PATTERN_PLACEHOLDER" allow-clear data-testid="form-method-pattern" />
        <template #extra>
          可选；glob，匹配候选所在方法（如 OrderService#export*、*Test#*）。留空 = 不限方法。
        </template>
      </a-form-item>
      <a-form-item label="项目组">
        <a-select v-model="form.project_group_id" :options="pgOptions" placeholder="可选，空=全局" allow-clear />
      </a-form-item>
      <a-form-item label="模块仓库ID">
        <a-input v-model="form.module_repository_id" placeholder="可选" />
      </a-form-item>
      <a-form-item label="路径模式">
        <a-input v-model="form.path_pattern" :placeholder="WAIVER_PATH_GLOB_PLACEHOLDER" />
      </a-form-item>
      <a-form-item label="原因说明" required>
        <a-textarea v-model="form.reason" placeholder="申请白名单的原因" data-testid="form-reason" />
      </a-form-item>
      <a-form-item label="影响说明">
        <a-textarea v-model="form.impact" placeholder="可选" />
      </a-form-item>
      <a-form-item label="过期时间">
        <a-date-picker v-model="form.effective_to" show-time value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>
