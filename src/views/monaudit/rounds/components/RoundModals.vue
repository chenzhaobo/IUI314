<script setup lang="ts">
/** 轮次页弹窗：新建轮次 / 选择同步源开始同步。提交函数返回 false 时保持打开。 */
import type { LabelValue } from '../../shared/types'
import type { RoundCreateForm } from '../types'

defineProps<{
  submitting: boolean
  sourceOptions: LabelValue[]
  syncTitle: string
  submitCreate: () => Promise<boolean>
  submitSync: () => Promise<boolean>
}>()

const createVisible = defineModel<boolean>('createVisible', { required: true })
const createForm = defineModel<RoundCreateForm>('createForm', { required: true })
const syncVisible = defineModel<boolean>('syncVisible', { required: true })
const syncSources = defineModel<string[]>('syncSources', { required: true })
</script>

<template>
  <div class="round-modals">
    <a-modal v-model:visible="createVisible" title="新建轮次" :ok-loading="submitting" :on-before-ok="submitCreate">
      <a-form :model="createForm" layout="vertical">
        <a-form-item label="轮次编号" extra="留空自动生成（时间戳）；流水线按编号幂等">
          <a-input v-model="createForm.round_no" placeholder="如 2026-11" allow-clear />
        </a-form-item>
        <a-form-item label="名称">
          <a-input v-model="createForm.name" placeholder="留空同编号" allow-clear />
        </a-form-item>
        <a-form-item label="数据起始时间" extra="只同步此时刻之后创建的监控记录；留空 = 全量">
          <a-date-picker
            v-model="createForm.data_since"
            show-time
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model="createForm.remark" :auto-size="{ minRows: 2, maxRows: 4 }" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:visible="syncVisible" :title="syncTitle" :ok-loading="submitting" :on-before-ok="submitSync">
      <a-form layout="vertical" :model="{}">
        <a-form-item label="同步源" extra="留空 = 全部启用的同步源；已在同步中的同步源会跳过">
          <a-select
            v-model="syncSources"
            :options="sourceOptions"
            placeholder="全部启用的同步源"
            multiple
            allow-clear
            allow-search
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
