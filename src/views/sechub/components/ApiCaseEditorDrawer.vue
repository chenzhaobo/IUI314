<script setup lang="ts">
/**
 * API 用例编排编辑器（平台编排，不写代码）
 *
 * 用例模型（sec_sec_case）参考迁移 m20260912_000008_case_context_fields：
 *   上下文四件套：case_code（业务用例ID）/ title / test_point / background_data
 *   编排三件套：request_body（支持 {{ALL_UID}}/{{LIM_ORG}}/{{TARGET_ORG}} 变量）
 *               request_headers / assertion（断言类型）
 * 保存：新建 POST /sechub/scan/cases、编辑 PUT /sechub/scan/cases/{id}
 *   （PUT 的 body 是完整模型，task_id 不可改 —— 用例归属任务后不迁移）
 *
 * 编排用例不写代码：请求体交给执行器按角色 token 发起，响应按 assertion 判定。
 */
import { Message } from '@arco-design/web-vue'
import { computed, reactive, ref, watch } from 'vue'

import { ApiMetadataInventory } from '@/api/metadataApis'
import { ApiSecScan, resolveStaticScanApi } from '@/api/sechubApis'
import { postAction, putAction, useGet } from '@/hooks'
import { useUserStore } from '@/stores'
import { ASSERTION_OPTIONS, newCaseId, TEST_ROLE_OPTIONS } from './apiTestShared'

const props = defineProps<{
  /** 编辑对象；空 = 新建（从列表行直接带入，避免再查一次详情） */
  record?: Record<string, any> | null
  /** 左树选中的 API：新建时预填调用路径 */
  presetApiPath?: string
}>()

const emit = defineEmits<{
  (e: 'saved'): void
}>()

const visible = defineModel<boolean>('visible', { default: false })

interface OrchestrationForm {
  task_id: string
  case_code: string
  title: string
  test_point: string
  steps: string
  background_data: string
  api_path: string
  api_version: string
  http_method: string
  test_role: string
  assertion: string
  expected_verdict: string
  expected_hint: string
  request_body: string
  request_headers: string
}

const form = reactive<OrchestrationForm>({
  task_id: '',
  case_code: '',
  title: '',
  test_point: '',
  steps: '',
  background_data: '',
  api_path: '',
  api_version: '',
  http_method: '',
  test_role: 'NONE',
  assertion: 'denied',
  expected_verdict: 'PASS',
  expected_hint: '',
  request_body: '',
  request_headers: '',
})

const editId = ref('')
const saving = ref(false)

// 提示文案放脚本里：模板里的 {{...}} 会被当成插值，必须用绑定属性传入
const VAR_TIP = '支持变量：{{ALL_UID}} / {{LIM_ORG}} / {{TARGET_ORG}}，执行器按角色替换后发起请求'
const REQUEST_BODY_PLACEHOLDER = '{"userId": "{{ALL_UID}}", "orgIds": [{{LIM_ORG}}]}'
const REQUEST_HEADERS_PLACEHOLDER = '{"X-BD-CTRL-ORGIDS": "{{TARGET_ORG}}"}'

// ── 所属任务下拉（新建用例必须归属任务）─────────────
const { data: taskRes } = useGet<any>(ApiSecScan.taskList, { page_num: 1, page_size: 200 }, { immediate: true })
const taskOptions = computed(() => (taskRes.value?.list || []).map((t: any) => ({
  value: t.id,
  label: t.name ? `${t.name}` : t.id,
})))

// ── 接口下拉（按编号/名称/路径可搜索，选中自动带出 路径/版本/方法）──
const { data: apiRes } = useGet<any>(
  ApiMetadataInventory.list,
  { page_num: 1, page_size: 200 },
  { immediate: true },
)
const apiOptions = computed(() => (apiRes.value?.list || []).map((a: any) => ({
  value: a.call_path,
  label: `${a.number || ''} ${a.name || ''}（${a.http_method || '--'} ${a.call_path || ''}）`,
  api: a,
})))

function handleApiSelect(value: unknown) {
  const v = String(value || '')
  form.api_path = v
  const hit = apiOptions.value.find((o: any) => o.value === v)
  if (hit) {
    form.api_version = hit.api.api_version || ''
    form.http_method = hit.api.http_method || ''
  }
}

// ── 表单初始化 ────────────────────────────────────
function initForm() {
  const r = props.record
  editId.value = r?.id || ''
  form.task_id = r?.task_id || taskOptions.value[0]?.value || ''
  form.case_code = r?.case_code || ''
  form.title = r?.title || r?.entity_name || ''
  form.test_point = r?.test_point || ''
  form.steps = r?.steps || ''
  form.background_data = r?.background_data || ''
  form.api_path = r?.api_path || props.presetApiPath || ''
  form.api_version = r?.api_version || ''
  form.http_method = r?.http_method || ''
  form.test_role = r?.test_role || 'NONE'
  form.assertion = r?.assertion || 'denied'
  form.expected_verdict = r?.expected_verdict || 'PASS'
  form.expected_hint = r?.expected_hint || ''
  form.request_body = r?.request_body || ''
  form.request_headers = r?.request_headers || ''
}

// 任务列表是异步来的：抽屉已打开但下拉还没数据时，补一个默认任务
watch(taskOptions, (opts) => {
  if (!form.task_id && opts.length)
    form.task_id = opts[0].value
})

watch(visible, (v) => {
  if (v)
    initForm()
})

// ── 保存 ──────────────────────────────────────────
function isJsonText(text: string) {
  try {
    JSON.parse(text)
    return true
  }
  catch {
    return false
  }
}

const userStore = useUserStore()

async function handleSave() {
  if (!form.task_id) {
    Message.warning('请选择所属任务')
    return
  }
  if (!form.api_path.trim()) {
    Message.warning('请选择或手工填写接口调用路径')
    return
  }
  if (form.request_body.trim() && !isJsonText(form.request_body)) {
    Message.warning('请求体不是合法 JSON，请检查')
    return
  }
  if (form.request_headers.trim() && !isJsonText(form.request_headers)) {
    Message.warning('请求头不是合法 JSON，请检查')
    return
  }

  const apiPath = form.api_path.trim()
  // 只提交本编辑器管理的字段：编辑自动生成的用例（如 openapi_inject）时
  // 不能顺手把 case_type/exec_mode/test_type 改掉，否则会把它变成另一种用例。
  const editable: Record<string, any> = {
    case_code: form.case_code || null,
    title: form.title || null,
    test_point: form.test_point || null,
    steps: form.steps || null,
    background_data: form.background_data || null,
    api_path: apiPath,
    api_version: form.api_version || null,
    http_method: form.http_method || null,
    test_role: form.test_role || null,
    assertion: form.assertion || null,
    expected_verdict: form.expected_verdict || null,
    expected_hint: form.expected_hint || null,
    request_body: form.request_body || null,
    request_headers: form.request_headers || null,
    // 结果页/其它视图按 entity_* 展示表单/接口，这里与 api_path / title 对齐
    entity_number: apiPath,
    entity_name: form.title || null,
  }

  saving.value = true
  try {
    if (editId.value) {
      // PUT 的 body 是完整模型（task_id 不可改）：在原记录上覆盖可编辑字段
      const res = await putAction<string>(
        resolveStaticScanApi(ApiSecScan.caseUpdate, { id: editId.value }),
        { ...(props.record || {}), ...editable, task_id: props.record?.task_id },
      )
      if (res === null)
        return
      Message.success('已保存')
    }
    else {
      // 新建编排用例固定：API 域权限用例 + 平台编排 + 手工来源（与自动生成用例区分）
      const res = await postAction<string>(ApiSecScan.caseList, {
        ...editable,
        id: newCaseId(),
        task_id: form.task_id,
        case_type: 'openapi_perm',
        exec_mode: 'orchestration',
        case_source: 'manual',
        test_type: 'perm',
        enabled: 'Y',
        create_by: userStore.user.uid || '',
      })
      if (res === null)
        return
      Message.success('用例已创建')
    }
    visible.value = false
    emit('saved')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <a-drawer
    v-model:visible="visible"
    :width="720"
    :title="editId ? '编辑用例（平台编排）' : '新建用例（平台编排）'"
    :ok-loading="saving"
    ok-text="保存"
    unmount-on-close
    @ok="handleSave"
  >
    <a-form :model="form" layout="vertical">
      <a-form-item label="所属任务" required>
        <a-select v-model="form.task_id" placeholder="用例必须归属到扫描任务" :disabled="!!editId" allow-search>
          <a-option v-for="t in taskOptions" :key="t.value" :value="t.value">
            {{ t.label }}
          </a-option>
        </a-select>
        <template v-if="editId" #extra>
          用例归属任务后不可迁移
        </template>
      </a-form-item>

      <a-row :gutter="12">
        <a-col :span="8">
          <a-form-item>
            <template #label>
              业务用例ID
              <a-tooltip content="与灵基用例一一对应，如 V-PERMORG-NONE" mini>
                <icon-question-circle style="margin-left: 4px" />
              </a-tooltip>
            </template>
            <a-input v-model="form.case_code" placeholder="如 V-PERMORG-NONE" allow-clear />
          </a-form-item>
        </a-col>
        <a-col :span="16">
          <a-form-item label="标题">
            <a-input v-model="form.title" placeholder="一句话说清这个用例测什么" allow-clear />
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item>
        <template #label>
          接口
          <a-tooltip content="从 API 清单搜索（编号/名称/路径），选中后自动带出路径、版本、方法；也可直接输入手工路径" mini>
            <icon-question-circle style="margin-left: 4px" />
          </a-tooltip>
        </template>
        <a-select
          :model-value="form.api_path"
          placeholder="搜索接口编号 / 名称 / 路径，或直接输入"
          allow-search
          allow-create
          @change="handleApiSelect"
        >
          <a-option v-for="o in apiOptions" :key="o.value" :value="o.value" :label="o.label" />
        </a-select>
      </a-form-item>

      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item label="调用路径（api_path）">
            <a-input v-model="form.api_path" placeholder="/kapi/v3/xxx/getList" allow-clear />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item label="版本">
            <a-input v-model="form.api_version" placeholder="v3" allow-clear />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item label="HTTP 方法">
            <a-input v-model="form.http_method" placeholder="GET" allow-clear />
          </a-form-item>
        </a-col>
      </a-row>

      <a-row :gutter="12">
        <a-col :span="8">
          <a-form-item label="测试角色">
            <a-select v-model="form.test_role">
              <a-option v-for="r in TEST_ROLE_OPTIONS" :key="r.value" :value="r.value">
                {{ r.label }}
              </a-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item>
            <template #label>
              断言
              <a-tooltip mini>
                <icon-question-circle style="margin-left: 4px" />
                <template #content>
                  <div v-for="a in ASSERTION_OPTIONS" :key="a.value" style="margin-bottom: 4px">
                    <b>{{ a.label }}</b>：{{ a.tip }}
                  </div>
                </template>
              </a-tooltip>
            </template>
            <a-select v-model="form.assertion">
              <a-option v-for="a in ASSERTION_OPTIONS" :key="a.value" :value="a.value">
                {{ a.label }}
              </a-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="期望判定">
            <a-select v-model="form.expected_verdict" allow-clear>
              <a-option value="PASS">
                PASS
              </a-option>
              <a-option value="FAIL">
                FAIL
              </a-option>
              <a-option value="REVIEW">
                REVIEW
              </a-option>
              <a-option value="BLOCKED">
                BLOCKED
              </a-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item label="期望提示">
        <a-input v-model="form.expected_hint" placeholder="期望在响应里出现/判定的文本（assertion=custom 时必填）" allow-clear />
      </a-form-item>

      <a-form-item label="测试点（为什么设计这个用例）">
        <a-textarea v-model="form.test_point" :auto-size="{ minRows: 2, maxRows: 5 }" placeholder="如：NONE 角色不应读到他人组织清单 → 纵向越权" />
      </a-form-item>

      <a-form-item label="测试步骤">
        <a-textarea v-model="form.steps" :auto-size="{ minRows: 2, maxRows: 6 }" placeholder="1) 用 NONE 账号请求 2) 校验响应判定" />
      </a-form-item>

      <a-form-item label="背景数据（业务前置/单据状态/组织）">
        <a-textarea v-model="form.background_data" :auto-size="{ minRows: 2, maxRows: 6 }" placeholder="如：SIT 环境，ALL/LIM/NONE 三个账号同租户；有已审核的凭证数据" />
      </a-form-item>

      <a-form-item>
        <template #label>
          请求体（JSON）
          <a-tooltip :content="VAR_TIP" mini>
            <icon-question-circle style="margin-left: 4px" />
          </a-tooltip>
        </template>
        <a-textarea
          v-model="form.request_body"
          :auto-size="{ minRows: 3, maxRows: 10 }"
          :placeholder="REQUEST_BODY_PLACEHOLDER"
        />
      </a-form-item>

      <a-form-item label="请求头（JSON）">
        <a-textarea
          v-model="form.request_headers"
          :auto-size="{ minRows: 2, maxRows: 6 }"
          :placeholder="REQUEST_HEADERS_PLACEHOLDER"
        />
      </a-form-item>
    </a-form>
  </a-drawer>
</template>
