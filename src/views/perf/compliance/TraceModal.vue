<template>
  <a-modal v-model:visible="visible" title="TraceID 列表" :width="700" :footer="false">
    <a-table :data="traces" :loading="loading" :pagination="{ pageSize: 10 }" size="small" row-key="trace_id">
      <template #columns>
        <a-table-column title="TraceID" data-index="trace_id" :width="250" ellipsis />
        <a-table-column title="耗时(ms)" data-index="cost" :width="100">
          <template #cell="{ record }">
            <span :style="{ color: record.cost > 3000 ? '#f53f3f' : '' }">{{ record.cost }}</span>
          </template>
        </a-table-column>
        <a-table-column title="租户" data-index="tenant_code" :width="100" />
        <a-table-column title="客户" data-index="customer_name" :width="120" />
        <a-table-column title="操作" :width="120">
          <template #cell="{ record }">
            <a-space>
              <a-link @click="handleAnalyze(record)">分析</a-link>
              <a-link @click="handleDownload(record)">下载日志</a-link>
            </a-space>
          </template>
        </a-table-column>
      </template>
    </a-table>
  </a-modal>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Message } from '@arco-design/web-vue'
import { ApiPerfCompliance, ApiPerfOps } from '@/api/perfApis'
import { useGet, usePost } from '@/hooks'

defineOptions({ name: 'trace-modal' })

const props = defineProps<{
  modelValue: boolean
  batchId: string
  formId: string
  controlName?: string
}>()

const emit = defineEmits(['update:modelValue'])

const visible = ref(false)

watch(() => props.modelValue, (val) => {
  visible.value = val
  if (val) fetchTraces()
})

watch(visible, (val) => {
  emit('update:modelValue', val)
})

// 查询TraceID列表
const queryParams = computed(() => ({
  batch_id: props.batchId,
  form_id: props.formId,
  control_name: props.controlName,
  limit: 100,
}))
const { isFetching: loading, data: tracesData, execute: fetchTraces } = useGet<any>(ApiPerfCompliance.traces, queryParams, { immediate: false })
const traces = computed(() => tracesData.value || [])

// 分析
const analyzePayload = ref<any>({})
const { execute: doAnalyze } = usePost<any>(ApiPerfOps.analyze, analyzePayload, { immediate: false })
const handleAnalyze = async (record: any) => {
  analyzePayload.value = { trace_id: record.trace_id, tenant_code: record.tenant_code, customer_name: record.customer_name, form_id: props.formId, cost: record.cost }
  await doAnalyze()
  Message.success('分析任务已触发')
}

// 下载日志
const downloadPayload = ref<any>({})
const { execute: doDownload } = usePost<any>(ApiPerfOps.download, downloadPayload, { immediate: false })
const handleDownload = async (record: any) => {
  downloadPayload.value = { trace_id: record.trace_id, tenant_code: record.tenant_code, customer_name: record.customer_name, form_id: props.formId, cost: record.cost }
  await doDownload()
  Message.success('日志下载任务已触发')
}
</script>
