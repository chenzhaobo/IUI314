<script setup lang="ts">
import { Message } from '@arco-design/web-vue'
/**
 * 迭代新增 / 编辑弹窗。
 *
 * 产品线必选：迭代归属决定后续发版、缺陷、报表按哪条产品线统计，
 * 新增时默认带出字典 perf_product_line 的 is_default 项（星瀚）。
 * 提交动作由父页面注入，弹窗只负责表单校验与状态。
 */
import { computed, ref, watch } from 'vue'

defineOptions({ name: 'IterationFormModal' })

const props = withDefaults(defineProps<{
  /** 传入记录表示编辑，null 表示新增 */
  record?: IterationRecord | null
  productLineOptions?: SelectOption[]
  /** 新增时的默认产品线（字典 is_default 项） */
  defaultProductLine?: string
  /** 提交回调；返回 true 表示成功并关闭弹窗 */
  submit: (value: IterationFormValue) => Promise<boolean>
}>(), {
  record: null,
  productLineOptions: () => [],
  defaultProductLine: '',
})

export interface IterationFormValue {
  /** 编辑时必带；新增由后端生成 */
  id?: string
  code: string
  name: string
  product_line: string
  project_name: string
  start_date: string
  end_date: string
  build_no: string
  status: string
  remark: string
}

export interface IterationRecord extends IterationFormValue {
  id: string
  is_current?: string
}

interface SelectOption {
  label: string
  value: string
}

const visible = defineModel<boolean>('visible', { required: true })

const submitting = ref(false)
const isEdit = computed(() => Boolean(props.record?.id))

function emptyForm(): IterationFormValue {
  return {
    code: '',
    name: '',
    product_line: props.defaultProductLine,
    project_name: '金蝶云苍穹&星瀚V8.0',
    start_date: '',
    end_date: '',
    build_no: '',
    status: '1',
    remark: '',
  }
}

const form = ref<IterationFormValue>(emptyForm())

watch(visible, (open) => {
  if (!open)
    return
  form.value = props.record ? { ...props.record } : emptyForm()
})

async function handleSubmit(): Promise<void> {
  const value = form.value
  if (!value.code.trim()) {
    Message.warning('请输入迭代编码')
    return
  }
  if (!value.name.trim()) {
    Message.warning('请输入迭代名称')
    return
  }
  if (!value.product_line) {
    Message.warning('请选择产品线')
    return
  }
  if (!value.start_date) {
    Message.warning('请选择开始日期')
    return
  }
  if (!value.end_date) {
    Message.warning('请选择结束日期')
    return
  }
  submitting.value = true
  try {
    if (await props.submit(value))
      visible.value = false
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <a-modal
    v-model:visible="visible"
    :title="isEdit ? '编辑迭代' : '新增迭代'"
    :width="600"
    :ok-loading="submitting"
    @ok="handleSubmit"
  >
    <a-form :model="form" layout="vertical">
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="迭代编码" required>
            <a-input v-model="form.code" placeholder="如：PM-000006-151" :disabled="isEdit" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="迭代名称" required>
            <a-input v-model="form.name" placeholder="如：2026年6月迭代二" />
          </a-form-item>
        </a-col>
      </a-row>
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="产品线" required>
            <a-select v-model="form.product_line" :options="productLineOptions" placeholder="选择产品线" allow-search />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="项目名称">
            <a-input v-model="form.project_name" placeholder="如：金蝶云苍穹&星瀚V8.0" />
          </a-form-item>
        </a-col>
      </a-row>
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="开始日期" required>
            <a-date-picker v-model="form.start_date" value-format="YYYY-MM-DD" style="width: 100%" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="结束日期" required>
            <a-date-picker v-model="form.end_date" value-format="YYYY-MM-DD" style="width: 100%" />
          </a-form-item>
        </a-col>
      </a-row>
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="构建号">
            <a-input v-model="form.build_no" placeholder="如：BIZ_V8.0.15" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="状态">
            <a-select v-model="form.status">
              <a-option value="1">
                启用
              </a-option>
              <a-option value="0">
                禁用
              </a-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>
      <a-form-item label="备注">
        <a-textarea v-model="form.remark" :auto-size="{ minRows: 2, maxRows: 4 }" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>
