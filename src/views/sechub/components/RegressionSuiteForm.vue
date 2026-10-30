<script setup lang="ts">
/**
 * 回归套件 新建 / 编辑 弹窗
 *
 * 后端 POST/PUT 的入参是 SuiteInput（service/regression_suite.rs）：
 * suite_code/name/product_line/test_types 必填，test_types 不能为空
 * （空值会触发全量静态/表单扫描），scope/schedule_cron 可空。
 */
import type { SecProductLine, SecRegressionSuite, SecRegressionSuiteInput } from '@/api/sechubApis'
import { Message } from '@arco-design/web-vue'
import { computed, reactive, ref, watch } from 'vue'

import { ApiSecRegressionSuite, resolveStaticScanApi } from '@/api/sechubApis'
import { postAction, putAction } from '@/hooks'
import { validateCron } from '@/utils/cron'
import TaskScheduleFields from './TaskScheduleFields.vue'

const props = defineProps<{
  visible: boolean
  suite: SecRegressionSuite | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'saved': []
}>()

const TEST_TYPE_OPTIONS = [
  { value: 'api', label: 'API 接口测试' },
  { value: 'form_perm', label: '表单权限测试' },
  { value: 'form_url', label: '表单URL直达' },
  { value: 'xss', label: 'XSS注入' },
  { value: 'sqli', label: 'SQL注入' },
  { value: 'java_reflect', label: 'Java反射注入' },
  { value: 'openapi', label: 'OpenAPI测试' },
  { value: 'script', label: 'Python脚本' },
]

const PRODUCT_LINES: SecProductLine[] = ['星瀚', '星空']

const isEdit = computed(() => Boolean(props.suite))
const submitting = ref(false)

const form = reactive({
  suite_code: '',
  name: '',
  product_line: '星瀚' as SecProductLine,
  test_types: [] as string[],
  scope: '',
  schedule_enabled: false,
  schedule_cron: '',
  status: 'active',
})

function parseTestTypes(raw?: string | null): string[] {
  if (!raw)
    return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.map(String) : []
  }
  catch {
    // 存量脏数据按逗号列表兜底，避免编辑时丢配置
    return raw.split(',').map(item => item.trim()).filter(Boolean)
  }
}

function fill(suite: SecRegressionSuite | null) {
  form.suite_code = suite?.suite_code || ''
  form.name = suite?.name || ''
  form.product_line = suite?.product_line || '星瀚'
  form.test_types = suite ? parseTestTypes(suite.test_types) : TEST_TYPE_OPTIONS.map(o => o.value)
  form.scope = suite?.scope || ''
  form.schedule_enabled = suite?.schedule_enabled === '1'
  form.schedule_cron = suite?.schedule_cron || ''
  form.status = suite?.status || 'active'
}

watch(() => props.visible, (visible) => {
  if (visible)
    fill(props.suite)
}, { immediate: true })

function close() {
  emit('update:visible', false)
}

async function submit() {
  const code = form.suite_code.trim()
  if (!code) {
    Message.warning('请填写套件编码')
    return
  }
  if (!/^[\w.-]+$/.test(code) || code.length > 64) {
    Message.warning('套件编码只能包含字母、数字、下划线、点或短横线，且不超过 64 个字符')
    return
  }
  if (!form.name.trim()) {
    Message.warning('请填写套件名称')
    return
  }
  if (!form.test_types.length) {
    Message.warning('请至少选择一种测试类型')
    return
  }
  if (form.schedule_enabled && !validateCron(form.schedule_cron)) {
    Message.warning('请填写合法的 6 段 cron 表达式（秒 分 时 日 月 周）')
    return
  }

  const payload: SecRegressionSuiteInput = {
    suite_code: code,
    name: form.name.trim(),
    product_line: form.product_line,
    test_types: JSON.stringify(form.test_types),
    scope: form.scope.trim() || null,
    schedule_cron: form.schedule_cron.trim() || null,
    schedule_enabled: form.schedule_enabled ? '1' : '0',
    status: form.status,
  }

  submitting.value = true
  try {
    const res = props.suite
      ? await putAction<string>(resolveStaticScanApi(ApiSecRegressionSuite.byId, { id: props.suite.id }), payload)
      : await postAction<string>(ApiSecRegressionSuite.list, payload)
    if (res === null)
      return
    Message.success(props.suite ? '已保存' : '创建成功')
    emit('saved')
    close()
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <a-modal
    :visible="visible"
    :title="isEdit ? '编辑回归套件' : '新建回归套件'"
    :width="680"
    :ok-loading="submitting"
    @ok="submit"
    @cancel="close"
  >
    <a-form :model="form" layout="vertical">
      <a-form-item label="套件编码" required>
        <a-input v-model="form.suite_code" placeholder="如 fin-v32-regression" :max-length="64" />
      </a-form-item>
      <a-form-item label="套件名称" required>
        <a-input v-model="form.name" placeholder="如：财务 V3.2 发版回归" :max-length="200" />
      </a-form-item>
      <a-form-item label="产品线" required>
        <a-select v-model="form.product_line">
          <a-option v-for="line in PRODUCT_LINES" :key="line" :value="line">
            {{ line }}
          </a-option>
        </a-select>
      </a-form-item>
      <a-form-item label="测试类型" required>
        <a-checkbox-group v-model="form.test_types" :options="TEST_TYPE_OPTIONS" />
      </a-form-item>
      <a-form-item label="范围">
        <a-textarea
          v-model="form.scope"
          placeholder="可选：限定项目组 / 应用 / 表单，留空表示全部范围"
          :auto-size="{ minRows: 2, maxRows: 4 }"
        />
      </a-form-item>
      <a-form-item label="定时执行">
        <TaskScheduleFields
          v-model:enabled="form.schedule_enabled"
          v-model:cron="form.schedule_cron"
        />
      </a-form-item>
      <a-form-item v-if="isEdit" label="状态">
        <a-select v-model="form.status">
          <a-option value="active">
            启用调度
          </a-option>
          <a-option value="archived">
            已归档（不调度）
          </a-option>
        </a-select>
      </a-form-item>
    </a-form>
  </a-modal>
</template>
