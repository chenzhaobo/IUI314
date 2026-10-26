<script setup lang="ts">
import type { slowSqlLogDetail } from '@/types/system/slow-log'
import { parseTime } from '@/hooks'

defineOptions({ name: 'SlowSqlDetail' })
defineProps<{ detail?: slowSqlLogDetail | null, loading?: boolean }>()
const visible = defineModel<boolean>('visible', { required: true })
</script>

<template>
  <a-drawer v-model:visible="visible" :width="760" :footer="false" unmount-on-close title="慢 SQL 详情">
    <a-spin :loading="loading" style="width: 100%">
      <a-descriptions v-if="detail" :column="1" bordered size="small">
        <a-descriptions-item label="时间">
          {{ parseTime(detail.created_at) }}
        </a-descriptions-item>
        <a-descriptions-item label="耗时">
          {{ detail.elapsed_ms }} ms
        </a-descriptions-item>
        <a-descriptions-item label="来源">
          {{ detail.source === 'http' ? 'HTTP 请求' : '后台任务' }}
        </a-descriptions-item>
        <a-descriptions-item label="请求路径">
          {{ detail.request_path || '-' }}
        </a-descriptions-item>
        <a-descriptions-item label="Trace ID">
          <a-typography-text copyable>
            {{ detail.trace_id || '-' }}
          </a-typography-text>
        </a-descriptions-item>
        <a-descriptions-item label="SQL Hash">
          <a-typography-text copyable>
            {{ detail.sql_hash }}
          </a-typography-text>
        </a-descriptions-item>
        <a-descriptions-item label="影响行数">
          影响 {{ detail.rows_affected }} / 返回 {{ detail.rows_returned }}
        </a-descriptions-item>
        <a-descriptions-item label="SQL">
          <a-typography-paragraph copyable class="sql-text">
            {{ detail.sql_text }}
          </a-typography-paragraph>
        </a-descriptions-item>
      </a-descriptions>
      <a-alert v-if="detail" type="info" class="m-t-12px">
        仅保存 SQLx 输出的语句文本，不包含绑定参数值；文本超过 8192 字符时已截断。
      </a-alert>
    </a-spin>
  </a-drawer>
</template>

<style scoped>
.sql-text {
  max-height: 420px;
  margin: 0;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
}
</style>
