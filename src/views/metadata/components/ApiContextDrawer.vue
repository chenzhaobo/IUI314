<script setup lang="ts">
/**
 * API 背景需求录入（meta_api_context）—— 设计态业务上下文，代码/元数据推不出来：
 *   业务说明 / 后台表单 / 表单之间的联系 / 其他备注。
 *   AI 复核测试结果（真漏洞 vs 用例设计不对）时会把它作为上下文，所以由人工维护。
 *
 * 关联键 api_key = 调用路径（与清单行的 call_path 一致），存表时按 (env_id, api_key) 关联。
 */
import { Message } from '@arco-design/web-vue'
import { reactive, ref, watch } from 'vue'

import { ApiMetadataInventory } from '@/api/metadataApis'
import { getAction, postAction } from '@/hooks'

const props = defineProps<{
  /** 关联键：调用路径 */
  apiKey: string
  /** 展示用：接口编号 / 名称 */
  apiLabel?: string
}>()

const emit = defineEmits<{
  /** 保存成功：页面刷新列表以更新「已录入」标记 */
  (e: 'saved'): void
}>()

const visible = defineModel<boolean>('visible', { default: false })

const loading = ref(false)
const saving = ref(false)
const form = reactive({
  biz_summary: '',
  related_forms: '',
  form_relations: '',
  remark: '',
})

function reset() {
  form.biz_summary = ''
  form.related_forms = ''
  form.form_relations = ''
  form.remark = ''
}

async function load() {
  reset()
  if (!props.apiKey)
    return
  loading.value = true
  try {
    const res = await getAction<any>(ApiMetadataInventory.context, { api_key: props.apiKey })
    // 未录入时后端返回 null（拦截器会落成 {}），全部字段为空即可
    if (!res)
      return
    form.biz_summary = res.biz_summary || ''
    form.related_forms = res.related_forms || ''
    form.form_relations = res.form_relations || ''
    form.remark = res.remark || ''
  }
  finally {
    loading.value = false
  }
}

async function handleSave() {
  if (!props.apiKey) {
    Message.warning('缺少接口标识（调用路径），无法保存')
    return
  }
  saving.value = true
  try {
    const res = await postAction(ApiMetadataInventory.context, { api_key: props.apiKey, ...form })
    if (res === null)
      return
    Message.success('已保存，AI 复核该接口结果时会用到')
    visible.value = false
    emit('saved')
  }
  finally {
    saving.value = false
  }
}

watch(visible, (v) => {
  if (v)
    void load()
})
</script>

<template>
  <a-drawer
    v-model:visible="visible"
    :width="560"
    :title="`API 背景需求${apiLabel ? ` · ${apiLabel}` : ''}`"
    :ok-loading="saving"
    ok-text="保存"
    @ok="handleSave"
  >
    <a-spin :loading="loading" style="display: block; min-height: 120px">
      <a-alert type="info" style="margin-bottom: 12px">
        这些是给人和 AI 看的业务上下文 —— AI 复核测试结果时会用到（判断「真漏洞」还是「用例设计不对」）。
      </a-alert>
      <a-descriptions :column="1" size="small" bordered style="margin-bottom: 12px">
        <a-descriptions-item label="调用路径">
          {{ apiKey || '--' }}
        </a-descriptions-item>
      </a-descriptions>
      <a-form :model="form" layout="vertical">
        <a-form-item label="业务说明">
          <a-textarea
            v-model="form.biz_summary"
            placeholder="这个接口在业务上干什么、谁在用（如：按组织取用户有查询权限的许可清单）"
            :auto-size="{ minRows: 3, maxRows: 8 }"
          />
        </a-form-item>
        <a-form-item label="后台表单">
          <a-textarea
            v-model="form.related_forms"
            placeholder="如 gl_voucher, gl_vouchertype"
            :auto-size="{ minRows: 2, maxRows: 6 }"
          />
        </a-form-item>
        <a-form-item label="表单之间的联系">
          <a-textarea
            v-model="form.form_relations"
            placeholder="如 主单-子单 / 上下游 / 数据流说明"
            :auto-size="{ minRows: 3, maxRows: 8 }"
          />
        </a-form-item>
        <a-form-item label="其他备注">
          <a-textarea
            v-model="form.remark"
            placeholder="调用前置条件、注意事项等"
            :auto-size="{ minRows: 2, maxRows: 6 }"
          />
        </a-form-item>
      </a-form>
    </a-spin>
  </a-drawer>
</template>
