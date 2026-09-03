<script lang="ts" setup>
import { Message, Modal } from '@arco-design/web-vue'
import { computed, ref } from 'vue'
import { ApiMcArtifact, ApiMcEnvironment } from '@/api/apis'
import { formatTime, useGet, usePost, usePut } from '@/hooks'

defineOptions({ name: 'McEnvironment' })

// ── 环境总览 ──────────────────────────────────
const { isFetching, data: envRaw, execute: fetchEnvs } = useGet<any>(ApiMcEnvironment.getList, {}, { immediate: true })
const envs = computed(() => (Array.isArray(envRaw.value) ? envRaw.value : []))

// 可发布的版本（只取 Linux 制品）
const artifactQuery = ref({ kind: 'linux_artifact', page_size: 50 })
const { data: artifactRaw, execute: fetchArtifacts } = useGet<any>(ApiMcArtifact.getList, artifactQuery, { immediate: true })
const versionOptions = computed(() =>
  (artifactRaw.value?.list || []).map((a: any) => ({ label: `${a.version}  (${a.sha256?.slice(0, 12)}…)`, value: a.version })),
)

function refresh() {
  fetchEnvs()
  fetchArtifacts()
}

const kindLabel: Record<string, string> = {
  k8s: 'K8s',
  compose: 'Compose',
  windows_offline: 'Windows 离线',
}

// ── 立即探测 ──────────────────────────────────
async function handleProbe(env: any) {
  const { data } = await usePost(ApiMcEnvironment.probe, { code: env.code })
  if (data.value !== null) {
    Message.success(`已探测 ${env.code}`)
    fetchEnvs()
  }
}

// ── 发布（改期望版本）──────────────────────────
const promoteVisible = ref(false)
const promoteForm = ref<{ code: string, version: string, notes: string, is_production: boolean }>({
  code: '',
  version: '',
  notes: '',
  is_production: false,
})
const promoteResult = ref<any>(null)

function openPromote(env: any) {
  promoteForm.value = { code: env.code, version: env.desired_version || '', notes: '', is_production: env.is_production }
  promoteResult.value = null
  promoteVisible.value = true
}

async function submitPromote() {
  if (!promoteForm.value.version) {
    Message.warning('请选择目标版本')
    return false
  }
  const { data } = await usePost(ApiMcEnvironment.setDesired, {
    code: promoteForm.value.code,
    version: promoteForm.value.version,
    notes: promoteForm.value.notes,
  })
  if (data.value === null)
    return false
  promoteResult.value = data.value
  fetchEnvs()
  return false // 保持弹窗打开，让人看到迁移判定与下一步动作
}

// ── 环境编辑 ──────────────────────────────────
const editVisible = ref(false)
const editForm = ref<any>({})

function openEdit(env: any) {
  editForm.value = { ...env }
  editVisible.value = true
}

async function submitEdit() {
  const f = editForm.value
  const { data } = await usePut(ApiMcEnvironment.edit, {
    id: f.id,
    code: f.code,
    name: f.name,
    kind: f.kind,
    converge_mode: f.converge_mode,
    probe_url: f.probe_url || null,
    is_production: f.is_production,
    allow_ai_promote: f.allow_ai_promote,
    remark: f.remark || null,
  })
  if (data.value === null)
    return false
  Message.success('已保存')
  editVisible.value = false
  fetchEnvs()
  return true
}

function confirmAiToggle(env: any, next: boolean) {
  if (!next || !env.is_production) {
    editForm.value.allow_ai_promote = next
    return
  }
  // 生产环境放开 AI 直接改期望版本是一个安全决策，不能顺手一点就过
  Modal.warning({
    title: '放开生产的 AI 发布权限？',
    content:
      '打开后，AI 通过能力通道即可把生产的期望版本改成任意已入库制品，'
      + '下次重启即生效，中间没有人工确认。确认要放开吗？',
    hideCancel: false,
    onOk: () => { editForm.value.allow_ai_promote = true },
    onCancel: () => { editForm.value.allow_ai_promote = false },
  })
}
</script>

<template>
  <div class="p-4">
    <a-card title="环境总览" :bordered="false">
      <template #extra>
        <a-button @click="refresh">
          刷新
        </a-button>
      </template>

      <a-alert type="normal" class="mb-4">
        「期望版本」就是该环境 <span class="font-mono">latest.txt</span> 的内容；
        「实际版本」由 MC 轮询目标的 <span class="font-mono">/api/comm/version</span> 得到。
        两者不一致即漂移 —— 要么正在发布，要么发布没生效。
        <b>改期望版本不会重启任何东西</b>，目标重启时才拉新制品。
      </a-alert>

      <a-spin :loading="isFetching" style="width: 100%">
        <a-row :gutter="16">
          <a-col v-for="env in envs" :key="env.id" :span="12" class="mb-4">
            <a-card :bordered="true" size="small">
              <template #title>
                <a-space>
                  <span class="font-semibold">{{ env.name }}</span>
                  <a-tag>{{ env.code }}</a-tag>
                  <a-tag color="arcoblue">
                    {{ kindLabel[env.kind] || env.kind }}
                  </a-tag>
                  <a-tag v-if="env.is_production" color="red">
                    生产
                  </a-tag>
                  <a-tag v-if="env.allow_ai_promote" color="orange">
                    AI 可发布
                  </a-tag>
                </a-space>
              </template>
              <template #extra>
                <a-space>
                  <a-button size="mini" @click="handleProbe(env)">
                    探测
                  </a-button>
                  <a-button size="mini" @click="openEdit(env)">
                    设置
                  </a-button>
                  <a-button size="mini" type="primary" @click="openPromote(env)">
                    发布
                  </a-button>
                </a-space>
              </template>

              <a-descriptions :column="1" size="small" bordered>
                <a-descriptions-item label="期望版本">
                  <span class="font-mono">{{ env.desired_version || '未设置' }}</span>
                  <span v-if="env.desired_sha256" class="text-gray-400 text-xs ml-2">
                    {{ env.desired_sha256.slice(0, 12) }}…
                  </span>
                </a-descriptions-item>
                <a-descriptions-item label="实际版本">
                  <span class="font-mono">{{ env.observed_version || '未探测到' }}</span>
                  <a-tag v-if="env.drifted" color="orange" class="ml-2">
                    漂移
                  </a-tag>
                  <a-tag v-else-if="env.observed_version" color="green" class="ml-2">
                    一致
                  </a-tag>
                </a-descriptions-item>
                <a-descriptions-item label="健康">
                  <a-tag :color="env.observed_healthy ? 'green' : 'gray'">
                    {{ env.observed_healthy ? '正常' : '未知/不可达' }}
                  </a-tag>
                  <span v-if="env.observed_error" class="text-red-500 text-xs ml-2">{{ env.observed_error }}</span>
                  <span v-if="env.observed_at" class="text-gray-400 text-xs ml-2">
                    {{ formatTime(env.observed_at) }}
                  </span>
                </a-descriptions-item>
                <a-descriptions-item label="上次健康版本">
                  <span class="font-mono">{{ env.last_good_version || '-' }}</span>
                  <span class="text-gray-400 text-xs ml-2">回滚的默认目标</span>
                </a-descriptions-item>
                <a-descriptions-item label="已应用迁移">
                  {{ env.observed_migrations ?? '-' }}
                </a-descriptions-item>
                <a-descriptions-item label="分发地址">
                  <span class="font-mono text-xs">{{ env.dist_base_path }}</span>
                  <a-tooltip content="把目标的 ARTIFACT_BASE_URL 指到这里、ARTIFACT_VERSION 填 latest，容器侧无需其他改动">
                    <icon-question-circle class="ml-1" />
                  </a-tooltip>
                </a-descriptions-item>
                <a-descriptions-item label="探测地址">
                  <span class="font-mono text-xs">{{ env.probe_url || '未配置（无法观测实际版本）' }}</span>
                </a-descriptions-item>
              </a-descriptions>
            </a-card>
          </a-col>
        </a-row>
      </a-spin>
    </a-card>

    <!-- 发布弹窗 -->
    <a-modal v-model:visible="promoteVisible" title="设置期望版本" :on-before-ok="submitPromote" width="640px">
      <a-form :model="promoteForm" layout="vertical">
        <a-form-item label="环境">
          <a-input :model-value="promoteForm.code" disabled />
        </a-form-item>
        <a-form-item label="目标版本">
          <a-select v-model="promoteForm.version" placeholder="选择已入库的制品版本" allow-search>
            <a-option v-for="o in versionOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </a-option>
          </a-select>
        </a-form-item>
        <a-form-item label="变更说明">
          <a-textarea v-model="promoteForm.notes" placeholder="这次发了什么、为什么" :auto-size="{ minRows: 2 }" />
        </a-form-item>
      </a-form>

      <a-alert v-if="promoteForm.is_production" type="warning" class="mb-2">
        这是生产环境。改完期望版本后仍需重启目标实例才会生效。
      </a-alert>

      <template v-if="promoteResult">
        <a-divider>结果</a-divider>
        <a-descriptions :column="1" size="small" bordered>
          <a-descriptions-item label="版本变更">
            <span class="font-mono">{{ promoteResult.from_version || '（未设置）' }} → {{ promoteResult.to_version }}</span>
          </a-descriptions-item>
          <a-descriptions-item label="制品摘要">
            <span class="font-mono text-xs">{{ promoteResult.sha256 }}</span>
          </a-descriptions-item>
          <a-descriptions-item label="迁移判定">
            <a-tag :color="promoteResult.migration.state === 'required' ? 'red' : promoteResult.migration.state === 'not_required' ? 'green' : 'gray'">
              {{ promoteResult.migration.state }}
            </a-tag>
            <span class="ml-2">{{ promoteResult.migration.message }}</span>
          </a-descriptions-item>
          <a-descriptions-item label="下一步">
            {{ promoteResult.next_step }}
          </a-descriptions-item>
        </a-descriptions>
      </template>
    </a-modal>

    <!-- 环境设置弹窗 -->
    <a-modal v-model:visible="editVisible" title="环境设置" :on-before-ok="submitEdit" width="600px">
      <a-form :model="editForm" layout="vertical">
        <a-form-item label="名称">
          <a-input v-model="editForm.name" />
        </a-form-item>
        <a-form-item label="类型">
          <a-select v-model="editForm.kind">
            <a-option value="k8s">
              K8s
            </a-option>
            <a-option value="compose">
              Compose
            </a-option>
            <a-option value="windows_offline">
              Windows 离线
            </a-option>
          </a-select>
        </a-form-item>
        <a-form-item label="探测地址" help="目标实例根地址，如 http://172.20.198.24:30300；MC 会请求它的 /api/comm/version">
          <a-input v-model="editForm.probe_url" placeholder="http://host:port" />
        </a-form-item>
        <a-form-item label="生产环境">
          <a-switch v-model="editForm.is_production" />
        </a-form-item>
        <a-form-item label="允许 AI 直接改期望版本" help="关闭时，AI 走能力通道会被拒绝，只有人在页面上能发布">
          <a-switch :model-value="editForm.allow_ai_promote" @change="(v: any) => confirmAiToggle(editForm, Boolean(v))" />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model="editForm.remark" :auto-size="{ minRows: 2 }" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
