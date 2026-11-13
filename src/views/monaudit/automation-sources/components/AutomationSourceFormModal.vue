<script setup lang="ts">
import type { AutomationSourceForm } from '../types'

defineProps<{
  isEdit: boolean
  loading: boolean
  submit: () => Promise<boolean>
}>()

const visible = defineModel<boolean>('visible', { required: true })
const form = defineModel<AutomationSourceForm>('form', { required: true })
</script>

<template>
  <a-modal
    v-model:visible="visible"
    :title="isEdit ? '编辑自动化源' : '新增自动化源'"
    :ok-loading="loading"
    :on-before-ok="submit"
    :width="760"
    :body-style="{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto', overflowX: 'hidden' }"
  >
    <a-alert type="info" class="form-tip">
      新增配置默认停用。密钥不回显，编辑时留空表示保留旧密钥；请先测试连接，再启用。
    </a-alert>
    <a-form :model="form" layout="vertical">
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="编码" required>
            <a-input v-model="form.code" placeholder="唯一编码，如 perf-governance" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="名称" required>
            <a-input v-model="form.name" placeholder="自动化源名称" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="状态">
            <a-switch v-model="form.status" checked-value="1" unchecked-value="0" />
            <span class="status-text">{{ form.status === '1' ? '启用' : '停用' }}</span>
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="分页大小">
            <a-input-number v-model="form.page_size" :min="1" :max="500" />
          </a-form-item>
        </a-col>
        <a-col :span="24">
          <a-form-item label="自动化平台地址" required extra="不包含 /open/getAppToken；执行批次接口也使用该 origin">
            <a-input v-model="form.base_url" placeholder="https://apiautotest.example.com" />
          </a-form-item>
        </a-col>
        <a-col :span="24">
          <a-form-item label="token 路径" extra="默认 /open/getAppToken；网关带 /api 前缀时填 /api/open/getAppToken">
            <a-input v-model="form.token_path" placeholder="/open/getAppToken" />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="应用 appId" required>
            <a-input v-model="form.app_id" />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="应用密钥" :extra="isEdit ? '留空则保留旧密钥' : '新增必填'">
            <a-input-password v-model="form.app_secret" :placeholder="isEdit ? '留空则保留' : '应用密钥'" />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="accountId" required>
            <a-input v-model="form.account_id" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="任务 taskId" required>
            <a-input v-model="form.task_id" placeholder="任务定义 ID，不是执行批次 ID" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="任务名称" required>
            <a-input v-model="form.task_name" placeholder="集团财务-性能指标问题治理自动化" />
          </a-form-item>
        </a-col>
        <a-col :span="24">
          <a-form-item label="备注 / 停用原因">
            <a-textarea v-model="form.remark" :auto-size="{ minRows: 2, maxRows: 4 }" placeholder="连接失败原因或配置说明" />
          </a-form-item>
        </a-col>
      </a-row>
    </a-form>
  </a-modal>
</template>

<style scoped>
.form-tip { margin-bottom: 12px; }
.status-text { margin-left: 8px; }
</style>
