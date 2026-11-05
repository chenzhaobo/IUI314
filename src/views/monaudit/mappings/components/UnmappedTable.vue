<script setup lang="ts">
/** 未匹配领域：未归类问题按领域聚合；「建映射」预填新增弹窗（无领域按调用类前 3 段包名） */
import type { UnmappedDomain } from '../types'

defineProps<{
  data: UnmappedDomain[]
  loading: boolean
  tableHeight?: number
}>()

const emit = defineEmits<{
  (e: 'create', row: UnmappedDomain): void
  (e: 'refresh'): void
}>()
</script>

<template>
  <div class="unmapped">
    <div class="unmapped-head">
      <span class="unmapped-title">未匹配领域（{{ data.length }}）</span>
      <a-button size="mini" @click="emit('refresh')">
        刷新
      </a-button>
    </div>
    <a-table
      :data="data"
      :loading="loading"
      :pagination="false"
      row-key="domain"
      size="small"
      :scroll="{ y: tableHeight }"
    >
      <template #columns>
        <a-table-column title="领域" data-index="domain" :width="120" ellipsis tooltip>
          <template #cell="{ record }">
            <span v-if="record.domain">{{ record.domain }}</span>
            <span v-else class="muted">(空)</span>
          </template>
        </a-table-column>
        <a-table-column title="问题" data-index="issue_count" :width="64" />
        <a-table-column title="未关闭" data-index="open_count" :width="70" />
        <a-table-column title="调用类样例" data-index="sample_class" ellipsis tooltip />
        <a-table-column title="" :width="76">
          <template #cell="{ record }">
            <a-button size="mini" type="text" @click="emit('create', record)">
              建映射
            </a-button>
          </template>
        </a-table-column>
      </template>
    </a-table>
  </div>
</template>

<style scoped>
.unmapped-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.unmapped-title { font-weight: 600; }
.muted { color: var(--color-text-3); }
</style>
