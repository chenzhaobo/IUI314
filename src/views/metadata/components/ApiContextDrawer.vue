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
const requiredFieldsText = ref('[]')
const riskProfileText = ref('[]')
const sourceType = ref('')
const confidence = ref<number | null>(null)
const reviewStatus = ref('')
const reviewedBy = ref('')
const reviewedAt = ref('')
const reviewComment = ref('')
const reviewRound = ref(0)

function reset() {
  form.biz_summary = ''
  form.related_forms = ''
  form.form_relations = ''
  form.remark = ''
  requiredFieldsText.value = '[]'
  riskProfileText.value = '[]'
  sourceType.value = ''
  confidence.value = null
  reviewStatus.value = ''
  reviewedBy.value = ''
  reviewedAt.value = ''
  reviewComment.value = ''
  reviewRound.value = 0
}

const SOURCE_LABELS: Record<string, string> = {
  manual: '人工录入',
  ai_source: 'AI 源码调研',
  ai_doc: 'AI 需求文档梳理',
}
const RELATED_FORMS_PLACEHOLDER = 'JSON，如 {"forms":[{"id":"fircm_creditarg","kind":"meta_table","role":"前置数据","create_via":{"type":"api","ref":"..."},"sample":{"bizbill":"{{BILL_TYPE}}"}}],"variables":{"BILL_TYPE":{"value":"","source":"fircm_creditarg.bizbill","required":true}},"data_setup_required":true}'
const FORM_RELATIONS_PLACEHOLDER = 'JSON，如 {"relations":[{"from":"fircm_creditarg","to":"bill","join":"fircm_creditarg.bizbill = bill.billNumber"}],"creation_order":["fircm_creditarg","bill"],"cleanup_order":["bill","fircm_creditarg"]}'
const RISK_PROFILE_PLACEHOLDER = 'JSON 数组，如 [{"risk":"authz","status":"applicable","level":"high","evidence":"未校验 userId 组织权限","suggested_tests":["idor","horizon"]}]'
const REVIEW_LABELS: Record<string, string> = {
  draft: 'AI 草稿（待确认）',
  needs_fix: '待修复',
  approved: '已确认',
  rejected: '已驳回',
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
    requiredFieldsText.value = JSON.stringify(res.required_fields || [], null, 2)
    riskProfileText.value = JSON.stringify(res.risk_profile_json || [], null, 2)
    sourceType.value = res.source_type || 'manual'
    confidence.value = res.confidence ?? null
    reviewStatus.value = res.review_status || 'approved'
    reviewedBy.value = res.reviewed_by || ''
    reviewedAt.value = res.reviewed_at || ''
    reviewComment.value = res.review_comment || ''
    reviewRound.value = res.review_round || 0
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
  let requiredFields: unknown[] = []
  try {
    const parsed = JSON.parse(requiredFieldsText.value || '[]')
    requiredFields = Array.isArray(parsed) ? parsed : []
  }
  catch {
    Message.warning('强制字段必须是合法 JSON 数组')
    return
  }
  let riskProfile: unknown[] = []
  try {
    const parsed = JSON.parse(riskProfileText.value || '[]')
    riskProfile = Array.isArray(parsed) ? parsed : []
  }
  catch {
    Message.warning('风险自检清单必须是合法 JSON 数组')
    return
  }
  saving.value = true
  try {
    const res = await postAction(ApiMetadataInventory.context, {
      api_key: props.apiKey,
      ...form,
      // 人工保存视为确认；保留 AI 来源/证据，只把评审状态改为 approved
      review_status: 'approved',
      required_fields: requiredFields,
      risk_profile: riskProfile,
    })
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
        <a-descriptions-item v-if="sourceType" label="需求来源">
          {{ SOURCE_LABELS[sourceType] || sourceType }}
          <a-tag v-if="sourceType !== 'manual'" color="arcoblue" size="small" style="margin-left: 6px">
            AI 生成
          </a-tag>
          <span v-if="confidence !== null" class="confidence">置信度 {{ confidence }}</span>
        </a-descriptions-item>
        <a-descriptions-item v-if="reviewStatus" label="确认状态">
          {{ REVIEW_LABELS[reviewStatus] || reviewStatus }}
          <a-tag v-if="reviewRound > 0" color="arcoblue" size="small" style="margin-left: 6px">
            R{{ reviewRound }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item v-if="reviewedBy" label="评审人">
          {{ reviewedBy }}
          <span v-if="reviewedAt" class="confidence">{{ reviewedAt }}</span>
        </a-descriptions-item>
        <a-descriptions-item v-if="reviewComment" label="评审意见" :span="2">
          {{ reviewComment }}
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
        <a-form-item label="关联表单 / 实体 / 表（造数用）">
          <a-textarea
            v-model="form.related_forms"
            :placeholder="RELATED_FORMS_PLACEHOLDER"
            :auto-size="{ minRows: 4, maxRows: 10 }"
          />
          <template #extra>
            写接口必须回写：表单/实体/表、造数入口 create_via、查询入口 query_via、关键字段和样例；AI 生成用例和换环境造数都会读这里。
          </template>
        </a-form-item>
        <a-form-item label="表单 / 实体关系（造数顺序与清理）">
          <a-textarea
            v-model="form.form_relations"
            :placeholder="FORM_RELATIONS_PLACEHOLDER"
            :auto-size="{ minRows: 4, maxRows: 10 }"
          />
          <template #extra>
            写清 join 字段、依赖方向、创建顺序和清理顺序；单表单无关联时写 relations=[] + reason。
          </template>
        </a-form-item>
        <a-form-item label="接口强制字段（JSON 数组）">
          <a-textarea
            v-model="requiredFieldsText"
            placeholder="[{&quot;name&quot;:&quot;billId&quot;,&quot;type&quot;:&quot;string&quot;,&quot;source&quot;:&quot;DTO@NotNull&quot;}]"
            :auto-size="{ minRows: 3, maxRows: 10 }"
          />
          <template #extra>
            从源码 DTO/OpenAPI/文档梳理出的强制字段；AI 生成用例的请求体必须覆盖，否则质量门禁会驳回。
          </template>
        </a-form-item>
        <a-form-item label="首轮风险自检清单（JSON 数组）">
          <a-textarea
            v-model="riskProfileText"
            :placeholder="RISK_PROFILE_PLACEHOLDER"
            :auto-size="{ minRows: 4, maxRows: 14 }"
          />
          <template #extra>
            十个风险面（authz/injection/dynamic_service_invocation/deserialization/reflection_privilege/ssrf_xxe/mass_assignment/write_side_effect/data_leak/thirdapp_auth）三态结论 + 证据；applicable 必须有 suggested_tests。
          </template>
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

<style scoped>
.confidence { margin-left: 8px; color: var(--color-text-3); font-size: 12px; }
</style>
