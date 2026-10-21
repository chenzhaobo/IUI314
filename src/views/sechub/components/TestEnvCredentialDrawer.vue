<script setup lang="ts">
/**
 * 测试环境应用凭据 + 连接自检。
 *
 * app_secret 只在保存时提交，读取接口只回 app_secret_set；留空表示保留原值。
 * 8023 旧环境 secret_field=appSecuret；新环境一般是 appSecret 且需要 tenantid。
 */
import { Message } from '@arco-design/web-vue'
import { ref, watch } from 'vue'
import { ApiSecScan } from '@/api/sechubApis'
import { getAction, postAction } from '@/hooks'

const props = defineProps<{ env: any }>()
const visible = defineModel<boolean>('visible', { required: true })

const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const secretSet = ref(false)
const testResult = ref<any>(null)
const form = ref<any>({
  app_id: '',
  app_secret: '',
  account_id: '',
  secret_field: 'appSecuret',
  tenant_id: '',
  verify_ssl: true,
})

async function load() {
  if (!props.env?.id)
    return
  loading.value = true
  testResult.value = null
  try {
    const data = await getAction<any>(ApiSecScan.envCredential, { env_id: props.env.id })
    if (data) {
      secretSet.value = !!data.app_secret_set
      form.value = {
        app_id: data.app_id || '',
        app_secret: '',
        account_id: data.account_id || '',
        secret_field: data.secret_field || 'appSecuret',
        tenant_id: data.tenant_id || '',
        verify_ssl: data.verify_ssl !== false,
      }
    }
  }
  finally {
    loading.value = false
  }
}

watch(visible, (open) => {
  if (open)
    void load()
})

async function save() {
  if (!form.value.app_id || !form.value.account_id) {
    Message.warning('app_id 和 account_id 必填')
    return
  }
  saving.value = true
  try {
    const res = await postAction<string>(ApiSecScan.envCredential, {
      env_id: props.env.id,
      app_id: form.value.app_id,
      app_secret: form.value.app_secret || undefined,
      account_id: form.value.account_id,
      secret_field: form.value.secret_field,
      tenant_id: form.value.tenant_id || undefined,
      verify_ssl: form.value.verify_ssl,
    })
    if (res === null)
      return
    Message.success('凭据已保存')
    form.value.app_secret = ''
    await load()
  }
  finally {
    saving.value = false
  }
}

async function testConnection() {
  testing.value = true
  testResult.value = null
  try {
    const data = await postAction<any>(ApiSecScan.envCredentialTest, { env_id: props.env.id })
    if (data === null)
      return
    testResult.value = data
    const failed = (data.roles || []).filter((r: any) => !r.login_ok)
    if (failed.length)
      Message.warning(`连接完成：${failed.length} 个角色登录失败`)
    else
      Message.success('连接成功：三角色 API 登录通过')
  }
  finally {
    testing.value = false
  }
}
</script>

<template>
  <a-drawer v-model:visible="visible" :width="620" :title="`应用凭据 — ${env?.env_name || env?.id || ''}`" unmount-on-close>
    <a-spin :loading="loading" style="display: block">
      <a-alert type="info" style="margin-bottom: 12px">
        secret 加密存储，读取接口不回显。8023 老环境用 <b>appSecuret</b>；新环境一般用 <b>appSecret</b> 并填 tenantid。
        <template v-if="!secretSet">
          当前未配置 DB secret，执行层会回退内置 8023 值。
        </template>
      </a-alert>
      <a-form :model="form" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="app_id" required>
              <a-input v-model="form.app_id" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="account_id" required>
              <a-input v-model="form.account_id" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="app_secret">
              <a-input-password v-model="form.app_secret" :placeholder="secretSet ? '已配置，留空不修改' : '留空则回退 8023 内置值'" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="secret_field">
              <a-select v-model="form.secret_field">
                <a-option value="appSecuret">
                  appSecuret（老环境）
                </a-option>
                <a-option value="appSecret">
                  appSecret（新环境）
                </a-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="tenant_id">
              <a-input v-model="form.tenant_id" placeholder="新环境可能需要" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="校验证书">
              <a-switch v-model="form.verify_ssl" />
              <span class="hint">SIT 自签通常关闭校验</span>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
      <a-space>
        <a-button type="primary" :loading="saving" @click="save">
          保存凭据
        </a-button>
        <a-button :loading="testing" @click="testConnection">
          测试连接（三角色）
        </a-button>
      </a-space>

      <a-card v-if="testResult" title="连接结果" :bordered="false" style="margin-top: 16px">
        <div class="app-token">
          app token：<a-tag :color="testResult.app_token_ok ? 'green' : 'red'">
            {{ testResult.app_token_ok ? 'OK' : 'FAIL' }}
          </a-tag>
        </div>
        <a-table :data="testResult.roles || []" :pagination="false" row-key="role" size="small">
          <template #columns>
            <a-table-column title="角色" data-index="role" :width="80" />
            <a-table-column title="用户名" data-index="username" :width="150" />
            <a-table-column title="结果" :width="90">
              <template #cell="{ record }">
                <a-tag :color="record.login_ok ? 'green' : 'red'">
                  {{ record.login_ok ? 'OK' : 'FAIL' }}
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column title="说明" data-index="message" ellipsis tooltip />
          </template>
        </a-table>
      </a-card>
    </a-spin>
  </a-drawer>
</template>

<style scoped>
.hint { margin-left: 8px; color: var(--color-text-3); font-size: 12px; }
.app-token { margin-bottom: 8px; }
</style>
