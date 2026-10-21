<script setup lang="ts">
/**
 * 测试环境角色账号抽屉（ALL/LIM/NONE）。
 *
 * 密码可留空：API 登录只需要 app token + 用户名；Web 登录（表单 batchinvoke）
 * 才需要密码。留空时后端跳过 Web 登录，不会把整轮扫描拖成 BLOCKED。
 */
import { Message, Modal } from '@arco-design/web-vue'
import { ref, watch } from 'vue'
import { ApiSecScan, resolveStaticScanApi } from '@/api/sechubApis'
import { getAction, postAction } from '@/hooks'

const props = defineProps<{ env: any }>()
const visible = defineModel<boolean>('visible', { required: true })

const loading = ref(false)
const rows = ref<any[]>([])
const editorVisible = ref(false)
const editing = ref<any>(null)
const form = ref<any>({})

const ROLE_OPTIONS = [
  { value: 'ALL', label: 'ALL（全功能）' },
  { value: 'LIM', label: 'LIM（受限组织）' },
  { value: 'NONE', label: 'NONE（无权限）' },
]

async function load() {
  if (!props.env?.id)
    return
  loading.value = true
  try {
    const data = await getAction<any[]>(ApiSecScan.envAccounts, { env_id: props.env.id })
    rows.value = Array.isArray(data) ? data : []
  }
  finally {
    loading.value = false
  }
}

watch(visible, (open) => {
  if (open)
    void load()
})

function openAdd(role?: string) {
  editing.value = null
  form.value = { env_id: props.env.id, role: role || 'ALL', username: '', password: '', user_id: '', org_id: '', remark: '' }
  editorVisible.value = true
}

function openEdit(record: any) {
  editing.value = record
  form.value = { ...record, password: '' }
  editorVisible.value = true
}

async function save() {
  if (!form.value.role || !form.value.username) {
    Message.warning('角色和用户名必填')
    return
  }
  const res = await postAction<string>(ApiSecScan.envAccounts, {
    id: editing.value?.id,
    env_id: props.env.id,
    role: form.value.role,
    username: form.value.username,
    password: form.value.password || undefined,
    user_id: form.value.user_id || undefined,
    org_id: form.value.org_id || undefined,
    remark: form.value.remark || undefined,
  })
  if (res === null)
    return
  Message.success('已保存')
  editorVisible.value = false
  await load()
}

function remove(record: any) {
  Modal.confirm({
    title: '删除账号',
    content: `确认删除 ${record.role} / ${record.username}？`,
    okText: '删除',
    cancelText: '取消',
    onOk: async () => {
      const res = await postAction<string>(resolveStaticScanApi(ApiSecScan.envAccountDelete, { id: record.id }))
      if (res === null)
        return
      Message.success('已删除')
      await load()
    },
  })
}
</script>

<template>
  <a-drawer v-model:visible="visible" :width="720" :title="`环境账号 — ${env?.env_name || env?.id || ''}`" unmount-on-close>
    <a-alert type="info" style="margin-bottom: 12px">
      密码可留空：API 测试只需要应用 token + 用户名；需要跑表单测试时再补密码。
    </a-alert>
    <div class="toolbar">
      <a-space>
        <a-button type="primary" @click="openAdd()">
          新增账号
        </a-button>
        <a-button @click="load">
          刷新
        </a-button>
      </a-space>
    </div>
    <a-table :data="rows" :loading="loading" row-key="id" :pagination="false">
      <template #columns>
        <a-table-column title="角色" data-index="role" :width="90" />
        <a-table-column title="用户名" data-index="username" :width="160" />
        <a-table-column title="user_id" data-index="user_id" :width="200" ellipsis tooltip />
        <a-table-column title="org_id" data-index="org_id" :width="200" ellipsis tooltip />
        <a-table-column title="备注" data-index="remark" ellipsis tooltip />
        <a-table-column title="操作" :width="120" fixed="right">
          <template #cell="{ record }">
            <a-space>
              <a-link @click="openEdit(record)">
                编辑
              </a-link>
              <a-link status="danger" @click="remove(record)">
                删除
              </a-link>
            </a-space>
          </template>
        </a-table-column>
      </template>
      <template #empty>
        <a-empty description="还没有角色账号；至少补齐 ALL/LIM/NONE 才能一键 Agent 测试" />
      </template>
    </a-table>

    <a-modal v-model:visible="editorVisible" :title="editing ? '编辑账号' : '新增账号'" width="520" @ok="save">
      <a-form :model="form" layout="vertical">
        <a-form-item label="角色" required>
          <a-select v-model="form.role" :options="ROLE_OPTIONS" :disabled="!!editing" />
        </a-form-item>
        <a-form-item label="用户名" required>
          <a-input v-model="form.username" placeholder="如 17299999999" />
        </a-form-item>
        <a-form-item label="密码（可留空）">
          <a-input-password v-model="form.password" placeholder="留空表示只做 API 登录" />
        </a-form-item>
        <a-form-item label="user_id">
          <a-input v-model="form.user_id" placeholder="IDOR 伪造目标 / 变量 ALL_UID" />
        </a-form-item>
        <a-form-item label="org_id">
          <a-input v-model="form.org_id" placeholder="受限账号授权组织 / 变量 LIM_ORG" />
        </a-form-item>
        <a-form-item label="备注">
          <a-input v-model="form.remark" />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-drawer>
</template>

<style scoped>
.toolbar { margin-bottom: 12px; }
</style>
