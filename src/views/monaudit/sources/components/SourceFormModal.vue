<script setup lang="ts">
/**
 * 同步源新增 / 编辑弹窗。应用密钥与 Monitor 口令只进不出：编辑时留空 = 保留旧值。
 */
import type { SourceForm } from '../types'
import { AUTH_MODE_OPTIONS, LOGIN_USER_TYPE_OPTIONS, SECRET_FIELD_OPTIONS } from '../types'

defineProps<{
  isEdit: boolean
  loading: boolean
  submit: () => Promise<boolean>
}>()

const visible = defineModel<boolean>('visible', { required: true })
const form = defineModel<SourceForm>('form', { required: true })
</script>

<template>
  <a-modal
    v-model:visible="visible"
    :title="isEdit ? '编辑同步源' : '新增同步源'"
    :ok-loading="loading"
    :on-before-ok="submit"
    :width="860"
    :body-style="{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto', overflowX: 'hidden' }"
  >
    <a-form :model="form" layout="vertical">
      <a-divider orientation="left">
        基本信息
      </a-divider>
      <a-row :gutter="16">
        <a-col :span="8">
          <a-form-item label="编码" required>
            <a-input v-model="form.code" placeholder="唯一，如 patchfiauto-pg" />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="名称" required>
            <a-input v-model="form.name" placeholder="如 patchfiauto · pg" />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="状态">
            <a-switch v-model="form.status" checked-value="1" unchecked-value="0" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="环境名">
            <a-input v-model="form.env_name" placeholder="如 patchfiauto" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="数据中心名">
            <a-input v-model="form.datacenter_name" placeholder="如 patchfiauto_test_pg" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-divider orientation="left">
        苍穹 OpenAPI
      </a-divider>
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="苍穹地址" required>
            <a-input v-model="form.base_url" placeholder="如 https://devtest.kingdee.com:2024/patchfiauto" />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item label="数据中心 accountId" required>
            <a-input v-model="form.account_id" />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item label="租户 tenantId">
            <a-input v-model="form.tenant_id" placeholder="可选" />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="应用 appId" required>
            <a-input v-model="form.app_id" />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="应用密钥" :extra="isEdit ? '凭据不回显，留空则保留' : undefined">
            <a-input-password v-model="form.app_secret" :placeholder="isEdit ? '留空则保留' : '应用密钥'" />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="密钥字段名">
            <a-select v-model="form.secret_field" :options="SECRET_FIELD_OPTIONS" />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="认证方式">
            <a-select v-model="form.auth_mode" :options="AUTH_MODE_OPTIONS" />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="登录用户" required>
            <a-input v-model="form.login_user" placeholder="手机号或用户名" />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item label="登录用户类型">
            <a-select v-model="form.login_user_type" :options="LOGIN_USER_TYPE_OPTIONS" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item label="查询接口路径" required extra="绑定 bcm_monitorrecord（监控记录）的查询接口">
            <a-input v-model="form.query_api_path" placeholder="/kapi/v2/..." />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item label="时间过滤参数名" extra="留空 = 平台本地过滤">
            <a-input v-model="form.since_param" placeholder="如 createdate" />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item label="分页大小">
            <a-input-number v-model="form.page_size" :min="1" :max="1000" />
          </a-form-item>
        </a-col>
        <a-col :span="24">
          <a-form-item label="追加查询参数（JSON 对象）">
            <a-textarea v-model="form.query_extra_params" :auto-size="{ minRows: 2, maxRows: 5 }" placeholder="{&quot;status&quot;: &quot;A&quot;}" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-divider orientation="left">
        Monitor 日志
      </a-divider>
      <a-row :gutter="16">
        <a-col :span="12">
          <a-form-item label="Monitor 地址">
            <a-input v-model="form.monitor_base_url" placeholder="如 https://host/ierp/monitor" />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item label="Monitor 用户名">
            <a-input v-model="form.monitor_username" />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item label="Monitor 口令" :extra="isEdit ? '留空则保留' : undefined">
            <a-input-password v-model="form.monitor_password" :placeholder="isEdit ? '留空则保留' : 'Monitor 口令'" />
          </a-form-item>
        </a-col>
        <a-col :span="24">
          <a-form-item label="备注">
            <a-textarea v-model="form.remark" :auto-size="{ minRows: 2, maxRows: 4 }" />
          </a-form-item>
        </a-col>
      </a-row>
    </a-form>
  </a-modal>
</template>
