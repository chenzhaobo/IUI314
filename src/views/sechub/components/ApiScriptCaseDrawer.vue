<script setup lang="ts">
/**
 * Python 脚本用例（上传脚本 → 选用例脚本 → 建 script 用例）
 *
 * 脚本接口（api/src/sechub/sec_script.rs）：
 *   · POST /sechub/scan/scripts（multipart，字段名 file，仅 .py）→ data 为相对路径（sechub_scripts/x.py）
 *   · GET  /sechub/scan/scripts → [{name, size_bytes, modified_at}]
 * 用例保存：case_type=script、exec_mode=script、script_path=相对路径。
 * multipart 用裸 fetch（useRequest 只封装 JSON 请求体），与 mc/artifact.vue 的上传写法一致。
 */
import { Message } from '@arco-design/web-vue'
import { computed, reactive, ref, watch } from 'vue'

import { ApiSecScan, resolveStaticScanApi } from '@/api/sechubApis'
import { getAction, postAction, putAction, useGet, useToken } from '@/hooks'
import { useUserStore } from '@/stores'
import { newCaseId, TEST_ROLE_OPTIONS } from './apiTestShared'

const props = defineProps<{
  /** 编辑对象（exec_mode=script 的用例）；空 = 新建 */
  record?: Record<string, any> | null
  /** 左树选中的 API：新建时可关联为用例的 api_path（脚本用例可以不关联） */
  presetApiPath?: string
}>()

const emit = defineEmits<{
  (e: 'saved'): void
}>()

const visible = defineModel<boolean>('visible', { default: false })

interface ScriptForm {
  task_id: string
  script_path: string
  case_code: string
  title: string
  test_role: string
  api_path: string
  test_point: string
  background_data: string
}

const form = reactive<ScriptForm>({
  task_id: '',
  script_path: '',
  case_code: '',
  title: '',
  test_role: 'NONE',
  api_path: '',
  test_point: '',
  background_data: '',
})

const editId = ref('')
const saving = ref(false)
const uploading = ref(false)

// ── 任务下拉 ──────────────────────────────────────
const { data: taskRes } = useGet<any>(ApiSecScan.taskList, { page_num: 1, page_size: 200 }, { immediate: true })
const taskOptions = computed(() => (taskRes.value?.list || []).map((t: any) => ({
  value: t.id,
  label: t.name || t.id,
})))

// ── 脚本列表 ──────────────────────────────────────
const scripts = ref<any[]>([])
const scriptsLoading = ref(false)

async function loadScripts() {
  scriptsLoading.value = true
  try {
    const res = await getAction<any[]>(ApiSecScan.scripts)
    scripts.value = Array.isArray(res) ? res : []
  }
  finally {
    scriptsLoading.value = false
  }
}

function scriptLabel(s: any) {
  const kb = s.size_bytes != null ? `（${Math.max(1, Math.round(s.size_bytes / 1024))} KB）` : ''
  return `${s.name}${kb}`
}

async function handleUpload(file: File) {
  if (!/\.py$/i.test(file.name)) {
    Message.warning('只支持 .py 脚本')
    return
  }
  uploading.value = true
  try {
    const { token } = useToken()
    const formData = new FormData()
    formData.append('file', file)
    const resp = await fetch(import.meta.env.VITE_API_BASE_URL + ApiSecScan.scripts, {
      method: 'POST',
      body: formData,
      headers: { Authorization: token },
    })
    const data = await resp.json()
    if (data?.code === 200) {
      Message.success(`上传成功：${data.data}`)
      await loadScripts()
      form.script_path = data.data || ''
    }
    else {
      Message.error(data?.msg || '上传失败')
    }
  }
  catch (e: any) {
    Message.error(e?.message || '上传失败')
  }
  finally {
    uploading.value = false
  }
  return false
}

// ── 表单初始化 / 保存 ─────────────────────────────
function initForm() {
  const r = props.record
  editId.value = r?.id || ''
  form.task_id = r?.task_id || taskOptions.value[0]?.value || ''
  form.script_path = r?.script_path || ''
  form.case_code = r?.case_code || ''
  form.title = r?.title || r?.entity_name || ''
  form.test_role = r?.test_role || 'NONE'
  form.api_path = r?.api_path || props.presetApiPath || ''
  form.test_point = r?.test_point || ''
  form.background_data = r?.background_data || ''
}

watch(taskOptions, (opts) => {
  if (!form.task_id && opts.length)
    form.task_id = opts[0].value
})

watch(visible, (v) => {
  if (v) {
    initForm()
    void loadScripts()
  }
})

const userStore = useUserStore()

async function handleSave() {
  if (!form.task_id) {
    Message.warning('请选择所属任务')
    return
  }
  if (!form.script_path) {
    Message.warning('请上传并选择脚本')
    return
  }
  const apiPath = form.api_path.trim()
  // 只提交本编辑器管理的字段；case_type/exec_mode 只在新建时固定为脚本用例
  const editable: Record<string, any> = {
    case_code: form.case_code || null,
    title: form.title || null,
    test_point: form.test_point || null,
    background_data: form.background_data || null,
    script_path: form.script_path,
    test_role: form.test_role || null,
    api_path: apiPath || null,
    entity_number: apiPath || null,
    entity_name: form.title || null,
  }

  saving.value = true
  try {
    if (editId.value) {
      const res = await putAction<string>(
        resolveStaticScanApi(ApiSecScan.caseUpdate, { id: editId.value }),
        { ...(props.record || {}), ...editable, task_id: props.record?.task_id },
      )
      if (res === null)
        return
      Message.success('已保存')
    }
    else {
      const res = await postAction<string>(ApiSecScan.caseList, {
        ...editable,
        id: newCaseId(),
        task_id: form.task_id,
        case_type: 'script',
        exec_mode: 'script',
        case_source: 'manual',
        enabled: 'Y',
        create_by: userStore.user.uid || '',
      })
      if (res === null)
        return
      Message.success('脚本用例已创建')
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
    :width="640"
    :title="editId ? '编辑用例（Python脚本）' : '新建用例（Python脚本）'"
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
      </a-form-item>

      <a-form-item>
        <template #label>
          脚本（.py）
          <a-tooltip content="脚本由平台 Python 执行器运行，需自行读取 token（平台注入角色变量）" mini>
            <icon-question-circle style="margin-left: 4px" />
          </a-tooltip>
        </template>
        <a-space>
          <a-select
            v-model="form.script_path"
            placeholder="选择已上传的脚本"
            :loading="scriptsLoading"
            allow-search
            style="width: 380px"
          >
            <a-option v-for="s in scripts" :key="s.name" :value="`sechub_scripts/${s.name}`" :label="scriptLabel(s)" />
          </a-select>
          <a-upload
            :auto-upload="false"
            :show-file-list="false"
            accept=".py"
            @change="(files: any) => { if (files?.[0]?.file) handleUpload(files[0].file) }"
          >
            <template #upload-button>
              <a-button :loading="uploading">
                上传脚本
              </a-button>
            </template>
          </a-upload>
        </a-space>
      </a-form-item>

      <a-row :gutter="12">
        <a-col :span="10">
          <a-form-item label="业务用例ID">
            <a-input v-model="form.case_code" placeholder="如 S-ORGPERM-NONE" allow-clear />
          </a-form-item>
        </a-col>
        <a-col :span="14">
          <a-form-item label="标题">
            <a-input v-model="form.title" placeholder="一句话说清这个用例测什么" allow-clear />
          </a-form-item>
        </a-col>
      </a-row>

      <a-row :gutter="12">
        <a-col :span="10">
          <a-form-item label="测试角色">
            <a-select v-model="form.test_role" allow-clear>
              <a-option v-for="r in TEST_ROLE_OPTIONS" :key="r.value" :value="r.value">
                {{ r.label }}
              </a-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="14">
          <a-form-item label="关联接口（可选）">
            <a-input v-model="form.api_path" placeholder="如 /kapi/v3/gl/gl_voucherlist" allow-clear />
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item label="测试点">
        <a-textarea v-model="form.test_point" :auto-size="{ minRows: 2, maxRows: 5 }" placeholder="为什么写这个脚本用例" />
      </a-form-item>

      <a-form-item label="背景数据">
        <a-textarea v-model="form.background_data" :auto-size="{ minRows: 2, maxRows: 5 }" placeholder="业务前置/单据状态/组织等" />
      </a-form-item>
    </a-form>
  </a-drawer>
</template>
