<script setup lang="ts">
/**
 * API安全测试 → 环境与账号。
 *
 * 主表来自「基础配置 → 测试环境」的 perf_env（API 清单/meta 库环境），
 * 每个 perf_env 再绑定一个「基础配置 → 安全环境」的 sec_test_env（执行地址/账号/凭据）。
 * 这样安全测试看到的两个环境与基础配置完全一致，而不是只列 sec_test_env。
 */
import { Message } from '@arco-design/web-vue'
import { computed, onMounted, ref } from 'vue'
import { ApiPerfEnv } from '@/api/apis'
import { ApiSecScan, ApiSecTestEnv } from '@/api/sechubApis'
import { getAction, postAction, putAction } from '@/hooks'
import TestEnvAccountsDrawer from './components/TestEnvAccountsDrawer.vue'
import TestEnvCredentialDrawer from './components/TestEnvCredentialDrawer.vue'

// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'sec-env-accounts' })

const loading = ref(false)
const perfEnvs = ref<any[]>([])
const secEnvs = ref<any[]>([])
const accountsByEnv = ref<Record<string, any[]>>({})
const credentialByEnv = ref<Record<string, any>>({})

const accountsVisible = ref(false)
const credentialVisible = ref(false)
const activeSecEnv = ref<any>(null)

function trimId(value: any): string {
  return String(value || '').trim()
}

function numberTokens(value: string): string[] {
  return (value.match(/\d{4,}/g) || [])
}

function nameMatches(perfName: string, secName: string): boolean {
  const a = perfName.toLowerCase()
  const b = secName.toLowerCase()
  if (a && b && (a.includes(b) || b.includes(a)))
    return true
  const an = numberTokens(a)
  return an.some(n => b.includes(n))
}

function linkedSecEnv(perf: any): any | null {
  const id = trimId(perf.id)
  return secEnvs.value.find(s => trimId(s.meta_env_id) === id)
    || secEnvs.value.find(s => !trimId(s.meta_env_id) && nameMatches(String(perf.env_name || ''), String(s.env_name || '')))
    || null
}

const rows = computed(() => perfEnvs.value.map((p: any) => {
  const sec = linkedSecEnv(p)
  return {
    ...p,
    secEnv: sec,
    accounts: sec ? (accountsByEnv.value[trimId(sec.id)] || []) : [],
    credential: sec ? credentialByEnv.value[trimId(sec.id)] : null,
  }
}))

const readyCount = computed(() => rows.value.filter(r => r.secEnv && ['ALL', 'LIM', 'NONE'].every(role => r.accounts.some((a: any) => a.role === role))).length)

async function load() {
  loading.value = true
  try {
    const [perf, sec] = await Promise.all([
      getAction<any>(ApiPerfEnv.getList, { page_num: 1, page_size: 200 }),
      getAction<any>(ApiSecTestEnv.getList, { page_num: 1, page_size: 200 }),
    ])
    perfEnvs.value = Array.isArray(perf?.list) ? perf.list : []
    secEnvs.value = Array.isArray(sec?.list) ? sec.list : []
    const accountEntries: Record<string, any[]> = {}
    const credentialEntries: Record<string, any> = {}
    await Promise.all(secEnvs.value.map(async (env: any) => {
      const id = trimId(env.id)
      const [accounts, credential] = await Promise.all([
        getAction<any>(ApiSecScan.envAccounts, { env_id: id }),
        getAction<any>(ApiSecScan.envCredential, { env_id: id }),
      ])
      accountEntries[id] = Array.isArray(accounts) ? accounts : []
      credentialEntries[id] = credential || null
    }))
    accountsByEnv.value = accountEntries
    credentialByEnv.value = credentialEntries
  }
  finally {
    loading.value = false
  }
}

onMounted(load)

// ── 创建/编辑安全执行环境 ──────────────────────────────
const formVisible = ref(false)
const formSubmitting = ref(false)
const editingId = ref('')
const formPerf = ref<any>(null)
const form = ref<any>({})

function openCreate(perf: any) {
  editingId.value = ''
  formPerf.value = perf
  form.value = {
    env_name: perf.env_name || '',
    env_type: perf.env_type === 'uat' ? 'sit' : (perf.env_type || 'sit'),
    env_url: '',
    release_window_id: 'rw-default',
    business_area: '',
    security_contact: '',
    env_account: 'ALL/LIM/NONE 三角色',
    remark: `由基础配置环境 ${perf.env_name || perf.id} 创建`,
  }
  formVisible.value = true
}

function openEdit(record: any) {
  editingId.value = trimId(record.secEnv.id)
  formPerf.value = record
  form.value = {
    env_name: record.secEnv.env_name || '',
    env_type: record.secEnv.env_type || 'sit',
    env_url: record.secEnv.env_url || '',
    release_window_id: record.secEnv.release_window_id || 'rw-default',
    business_area: record.secEnv.business_area || '',
    security_contact: record.secEnv.security_contact || '',
    env_account: record.secEnv.env_account || '',
    remark: record.secEnv.remark || '',
  }
  formVisible.value = true
}

async function submitForm() {
  if (!form.value.env_name || !form.value.env_url) {
    Message.warning('环境名称和环境地址必填')
    return
  }
  formSubmitting.value = true
  try {
    const payload: any = {
      ...form.value,
      meta_env_id: trimId(formPerf.value.id),
    }
    if (editingId.value)
      payload.id = editingId.value
    const res = editingId.value
      ? await putAction<string>(ApiSecTestEnv.edit, payload)
      : await postAction<string>(ApiSecTestEnv.add, payload)
    if (res === null)
      return
    Message.success(editingId.value ? '安全环境已更新' : '安全环境已创建')
    formVisible.value = false
    await load()
  }
  finally {
    formSubmitting.value = false
  }
}

function openAccounts(record: any) {
  if (!record.secEnv) {
    Message.warning('该环境还没有绑定安全执行环境，请先创建')
    return
  }
  activeSecEnv.value = record.secEnv
  accountsVisible.value = true
}

function openCredential(record: any) {
  if (!record.secEnv) {
    Message.warning('该环境还没有绑定安全执行环境，请先创建')
    return
  }
  activeSecEnv.value = record.secEnv
  credentialVisible.value = true
}

async function testConnection(record: any) {
  if (!record.secEnv)
    return
  const res = await postAction<any>(ApiSecScan.envCredentialTest, { env_id: trimId(record.secEnv.id) })
  if (res === null)
    return
  const failed = (res.roles || []).filter((r: any) => !r.login_ok)
  if (failed.length)
    Message.warning(`连接完成：${failed.length} 个角色失败`)
  else
    Message.success('连接成功：三角色 API 登录通过')
}

function roleTag(record: any, role: string) {
  return record.accounts.some((a: any) => a.role === role)
}
</script>

<template>
  <div class="sec-env-page">
    <a-alert type="info" style="margin-bottom: 12px">
      环境列表来自「基础配置 → 测试环境」（perf_env，当前 {{ rows.length }} 个）。
      每个环境绑定一个安全执行环境（sec_test_env）用于真实调用；账号和凭据挂在执行环境上。
      当前就绪：{{ readyCount }} / {{ rows.length }}。
    </a-alert>

    <a-card :bordered="false">
      <template #extra>
        <a-button type="primary" @click="load">
          刷新
        </a-button>
      </template>
      <a-table :data="rows" :loading="loading" row-key="id" :pagination="false">
        <template #columns>
          <a-table-column title="环境" :width="230" ellipsis tooltip>
            <template #cell="{ record }">
              <div>{{ record.env_name }}</div>
              <div class="sub">
                {{ record.env_code }} · {{ record.env_type }} · {{ record.product_line }}
              </div>
            </template>
          </a-table-column>
          <a-table-column title="Meta 库" :width="220" ellipsis tooltip>
            <template #cell="{ record }">
              {{ record.db_host }}:{{ record.db_port }} / {{ record.meta_db_name }}
            </template>
          </a-table-column>
          <a-table-column title="安全执行环境" :width="280">
            <template #cell="{ record }">
              <template v-if="record.secEnv">
                <a-tag color="green">
                  已绑定
                </a-tag>
                <div class="sub">
                  {{ record.secEnv.env_name }} · {{ record.secEnv.env_url || '未配置 URL' }}
                </div>
              </template>
              <a-tag v-else color="gray">
                未配置
              </a-tag>
            </template>
          </a-table-column>
          <a-table-column title="账号" :width="180">
            <template #cell="{ record }">
              <template v-if="record.secEnv">
                <a-tag v-for="role in ['ALL', 'LIM', 'NONE']" :key="role" :color="roleTag(record, role) ? 'green' : 'red'" size="small" style="margin-right: 4px">
                  {{ role }}
                </a-tag>
              </template>
              <span v-else class="sub">--</span>
            </template>
          </a-table-column>
          <a-table-column title="凭据" :width="120">
            <template #cell="{ record }">
              <a-tag v-if="record.credential?.app_secret_set" color="green" size="small">
                已配置
              </a-tag>
              <a-tag v-else-if="record.secEnv" color="orange" size="small">
                回退/未配置
              </a-tag>
              <span v-else class="sub">--</span>
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="300" fixed="right">
            <template #cell="{ record }">
              <a-space v-if="record.secEnv">
                <a-link @click="openAccounts(record)">
                  账号
                </a-link>
                <a-link @click="openCredential(record)">
                  凭据
                </a-link>
                <a-link @click="testConnection(record)">
                  测试连接
                </a-link>
                <a-link @click="openEdit(record)">
                  编辑
                </a-link>
              </a-space>
              <a-link v-else @click="openCreate(record)">
                创建安全环境
              </a-link>
            </template>
          </a-table-column>
        </template>
        <template #empty>
          <a-empty description="基础配置 → 测试环境 里还没有环境" />
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:visible="formVisible"
      :title="editingId ? '编辑安全执行环境' : '创建安全执行环境'"
      :ok-loading="formSubmitting"
      width="620"
      @ok="submitForm"
    >
      <a-alert type="info" style="margin-bottom: 12px">
        绑定到基础配置环境：<b>{{ formPerf?.env_name }}</b>（{{ formPerf?.env_code }}）
      </a-alert>
      <a-form :model="form" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="环境名称" required>
              <a-input v-model="form.env_name" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="类型">
              <a-select v-model="form.env_type">
                <a-option value="sit">
                  SIT
                </a-option>
                <a-option value="uat">
                  UAT
                </a-option>
                <a-option value="perf">
                  性能
                </a-option>
                <a-option value="prod">
                  生产
                </a-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="环境地址" required>
              <a-input v-model="form.env_url" placeholder="如 http://172.20.198.18:8023/ierp" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="发布窗口 ID">
              <a-input v-model="form.release_window_id" placeholder="默认 rw-default" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="业务领域">
              <a-input v-model="form.business_area" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="安全接口人">
              <a-input v-model="form.security_contact" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="账号说明">
              <a-input v-model="form.env_account" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="备注">
              <a-input v-model="form.remark" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <TestEnvAccountsDrawer v-model:visible="accountsVisible" :env="activeSecEnv" />
    <TestEnvCredentialDrawer v-model:visible="credentialVisible" :env="activeSecEnv" />
  </div>
</template>

<style scoped>
.sec-env-page { padding: 0; }
.sub { color: var(--color-text-3); font-size: 12px; margin-top: 2px; word-break: break-all; }
</style>
