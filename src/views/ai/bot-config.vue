<script lang="ts" setup>
import { computed, ref } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import { useGet, usePost } from '@/hooks'
import { ApiBotConfig, type BotConfigItem, type BotUserAccess, type AiListResult } from '@/api/aiApis'

defineOptions({ name: 'ai-bot-config' })

// ── Tab 状态 ──────────────────────────────────
const activeTab = ref('basic')

// ── 基础配置 ──────────────────────────────────
const { isFetching: cfgLoading, data: cfgRaw, execute: fetchConfig } = useGet<BotConfigItem[]>(
  ApiBotConfig.list,
  undefined,
  { immediate: true },
)
const configList = computed(() => cfgRaw.value || [])

// 可编辑表单
const form = ref<Record<string, string>>({})
const formInited = ref(false)

// 监听配置加载完成后初始化表单
import { watch } from 'vue'
watch(configList, (list) => {
  if (list.length && !formInited.value) {
    const m: Record<string, string> = {}
    list.forEach((item) => { m[item.config_key] = item.config_value })
    form.value = m
    formInited.value = true
  }
}, { immediate: true })

const saving = ref(false)
async function handleSaveConfig() {
  saving.value = true
  try {
    const items = Object.entries(form.value).map(([key, value]) => ({ key, value }))
    const { execute, error } = usePost(ApiBotConfig.update, { items })
    await execute()
    if (error.value) return
    Message.success('配置已保存，即时生效')
    formInited.value = false
    fetchConfig()
  } finally {
    saving.value = false
  }
}

// ── 用户准入 ──────────────────────────────────
const { isFetching: accessLoading, data: accessRaw, execute: fetchAccess } = useGet<AiListResult<BotUserAccess>>(
  ApiBotConfig.accessList,
  undefined,
  { immediate: true },
)
const accessList = computed(() => accessRaw.value?.list || [])

const addForm = ref({ user_identifier: '', user_name: '', access_type: 'allow', remark: '' })
const addVisible = ref(false)
const addSubmitting = ref(false)

function handleAddAccess() {
  addForm.value = { user_identifier: '', user_name: '', access_type: 'allow', remark: '' }
  addVisible.value = true
}

async function handleSubmitAccess() {
  if (!addForm.value.user_identifier.trim()) {
    Message.warning('请输入用户标识')
    return
  }
  addSubmitting.value = true
  try {
    const { execute, error } = usePost(ApiBotConfig.accessAdd, addForm.value)
    await execute()
    if (error.value) return
    Message.success('添加成功')
    addVisible.value = false
    fetchAccess()
  } finally {
    addSubmitting.value = false
  }
}

function handleRemoveAccess(record: BotUserAccess) {
  Modal.warning({
    title: '确认删除',
    content: `确定移除用户「${record.user_name || record.user_identifier}」的准入记录？`,
    hideCancel: false,
    onOk: async () => {
      const { execute, error } = usePost(ApiBotConfig.accessRemove, { id: record.id })
      await execute()
      if (error.value) return
      Message.success('已删除')
      fetchAccess()
    },
  })
}

// 准入模式标签
const accessModeLabel = computed(() => {
  const mode = form.value.access_mode
  if (mode === 'whitelist') return '白名单模式'
  if (mode === 'blacklist') return '黑名单模式'
  return '全部开放'
})
</script>

<template>
  <div class="bot-config-container">
    <a-card title="智能助手配置" :bordered="false">
      <a-tabs v-model:active-key="activeTab">
        <!-- 基础设置 -->
        <a-tab-pane key="basic" title="基础设置">
          <a-spin :loading="cfgLoading" style="width: 100%">
            <a-form :model="form" layout="vertical" style="max-width: 600px">
              <a-form-item label="Bot 总开关">
                <a-switch v-model="form.enabled" checked-value="true" unchecked-value="false" />
                <span style="margin-left: 8px; color: var(--color-text-3)">
                  {{ form.enabled === 'true' ? '已启用' : '已停用' }}
                </span>
              </a-form-item>
              <a-form-item label="AI 执行器编码">
                <a-input v-model="form.agent_code" placeholder="对应 ai_agent 表的 agent_code" />
              </a-form-item>
              <a-form-item label="云之家机器人 webhook">
                <a-input
                  v-model="form.send_msg_url"
                  allow-clear
                  placeholder="https://www.yunzhijia.com/gateway/robot/webhook/send?yzjtype=0&yzjtoken=xxx"
                />
                <template #extra>
                  <span>
                    用于在云之家群里 @机器人 指挥平台：平台据此推导 WebSocket 地址收消息、回复走同一地址。
                    留空则回落到 config.toml 的 [notification.yunzhijia] send_msg_url。改动需重启服务生效。
                  </span>
                </template>
              </a-form-item>
              <a-form-item label="系统提示词">
                <a-textarea v-model="form.system_prompt" :auto-size="{ minRows: 3, maxRows: 6 }" placeholder="Bot 的系统角色设定" />
              </a-form-item>
              <a-form-item label="会话超时（分钟）">
                <a-input-number
                  :model-value="form.session_timeout_min ? Number(form.session_timeout_min) : undefined"
                  :min="5"
                  :max="1440"
                  style="width: 120px"
                  @change="(value: number | undefined) => form.session_timeout_min = value === undefined ? '' : String(value)"
                />
              </a-form-item>
              <a-form-item label="最大历史轮数">
                <a-input-number
                  :model-value="form.max_history ? Number(form.max_history) : undefined"
                  :min="5"
                  :max="100"
                  style="width: 120px"
                  @change="(value: number | undefined) => form.max_history = value === undefined ? '' : String(value)"
                />
              </a-form-item>
              <a-form-item label="准入模式">
                <a-select v-model="form.access_mode" style="width: 200px">
                  <a-option value="all">全部开放</a-option>
                  <a-option value="whitelist">白名单模式</a-option>
                  <a-option value="blacklist">黑名单模式</a-option>
                </a-select>
              </a-form-item>
              <a-form-item>
                <a-button type="primary" :loading="saving" @click="handleSaveConfig">保存配置</a-button>
              </a-form-item>
            </a-form>
          </a-spin>
        </a-tab-pane>

        <!-- 用户准入 -->
        <a-tab-pane key="access" title="用户准入">
          <div style="margin-bottom: 16px; display: flex; align-items: center; gap: 12px">
            <a-tag :color="form.access_mode === 'whitelist' ? 'green' : form.access_mode === 'blacklist' ? 'red' : 'blue'">
              当前模式：{{ accessModeLabel }}
            </a-tag>
            <a-button type="primary" size="small" @click="handleAddAccess">添加用户</a-button>
          </div>
          <a-table :data="accessList" :loading="accessLoading" :pagination="false" row-key="id" size="small">
            <template #columns>
              <a-table-column title="用户标识" data-index="user_identifier" />
              <a-table-column title="用户名" data-index="user_name">
                <template #cell="{ record }">{{ record.user_name || '-' }}</template>
              </a-table-column>
              <a-table-column title="类型" data-index="access_type" :width="80">
                <template #cell="{ record }">
                  <a-tag :color="record.access_type === 'allow' ? 'green' : 'red'" size="small">
                    {{ record.access_type === 'allow' ? '允许' : '拒绝' }}
                  </a-tag>
                </template>
              </a-table-column>
              <a-table-column title="备注" data-index="remark">
                <template #cell="{ record }">{{ record.remark || '-' }}</template>
              </a-table-column>
              <a-table-column title="操作" :width="80">
                <template #cell="{ record }">
                  <a-button type="text" status="danger" size="mini" @click="handleRemoveAccess(record)">删除</a-button>
                </template>
              </a-table-column>
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-card>

    <!-- 添加准入用户弹窗 -->
    <a-modal v-model:visible="addVisible" title="添加准入用户" :ok-loading="addSubmitting" @ok="handleSubmitAccess">
      <a-form :model="addForm" layout="vertical">
        <a-form-item label="用户标识" required>
          <a-input v-model="addForm.user_identifier" placeholder="云之家 OpenID 或系统用户ID" />
        </a-form-item>
        <a-form-item label="用户名（可选）">
          <a-input v-model="addForm.user_name" placeholder="便于识别的名称" />
        </a-form-item>
        <a-form-item label="准入类型">
          <a-radio-group v-model="addForm.access_type">
            <a-radio value="allow">允许</a-radio>
            <a-radio value="deny">拒绝</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="备注">
          <a-input v-model="addForm.remark" placeholder="可选备注" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.bot-config-container {
  padding: 16px;
}
</style>
