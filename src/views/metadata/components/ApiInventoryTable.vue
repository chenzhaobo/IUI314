<script setup lang="ts">
/**
 * API 清单表格（API清单 / API概览共用）
 *
 * 概览模式（mode=overview）在清单列之后追加 4 列：用例数 / 成功数 / 执行时间 / 状态，
 * 回答「这个接口测过没有、最近一轮结果如何」；清单模式只多一个「背景需求」入口。
 */
import { formatTime } from '@/hooks'

withDefaults(defineProps<{
  rows: any[]
  loading?: boolean
  pagination: Record<string, any>
  mode?: 'inventory' | 'overview'
  tableHeight?: number
}>(), { loading: false, mode: 'inventory', tableHeight: undefined })

const emit = defineEmits<{
  /** 事件名用 camelCase（模板里仍可写 @page-change，编译后即 onPageChange） */
  (e: 'pageChange', page: number): void
  (e: 'pageSizeChange', size: number): void
  (e: 'context', record: any): void
}>()

/** 概览模式的状态列：pass=全部用例执行成功 / fail / none=无用例 */
const STATUS_META: Record<string, { label: string, color: string }> = {
  pass: { label: '通过', color: 'green' },
  fail: { label: '不通过', color: 'red' },
  none: { label: '未测试', color: 'gray' },
}
function statusMeta(s?: string | null) {
  return STATUS_META[s || ''] ?? { label: s || '--', color: 'gray' }
}
</script>

<template>
  <a-table
    :data="rows"
    :loading="loading"
    :pagination="pagination"
    :scroll="{ x: mode === 'overview' ? 2124 : 1808, y: tableHeight }"
    row-key="id"
    @page-change="emit('pageChange', $event)"
    @page-size-change="emit('pageSizeChange', $event)"
  >
    <template #columns>
      <a-table-column title="编号" :width="180" ellipsis tooltip>
        <template #cell="{ record }">
          <span>{{ record.number }}</span>
          <!-- 已录入背景需求：给人和 AI 复核用的业务上下文 -->
          <a-tag v-if="record.has_context" color="arcoblue" size="small" style="margin-left: 6px">
            已录入
          </a-tag>
        </template>
      </a-table-column>
      <a-table-column title="名称" data-index="name" :width="190" ellipsis tooltip />
      <a-table-column title="版本" data-index="api_version" :width="70" />
      <a-table-column title="方法" data-index="http_method" :width="80" />
      <a-table-column title="调用路径" data-index="call_path" :width="260" ellipsis tooltip />
      <a-table-column title="开发模式" :width="100" ellipsis tooltip>
        <template #cell="{ record }">
          <a-tooltip v-if="record.dev_mode" :content="`原始值：${record.dev_mode}`" mini>
            <span>{{ record.dev_mode_label || record.dev_mode }}</span>
          </a-tooltip>
          <span v-else>--</span>
        </template>
      </a-table-column>
      <a-table-column title="状态" :width="76">
        <template #cell="{ record }">
          <a-tooltip v-if="record.status" :content="`原始值：${record.status}`" mini>
            <a-tag :color="record.status === 'C' || record.status === 'enabled' ? 'green' : record.status === 'D' || record.status === 'disabled' ? 'gray' : 'blue'">
              {{ record.status_label || record.status }}
            </a-tag>
          </a-tooltip>
          <span v-else>--</span>
        </template>
      </a-table-column>
      <a-table-column title="第三方应用授权" :width="120">
        <template #cell="{ record }">
          <a-tag :color="record.thirdapp_auth ? 'orange' : 'gray'">
            {{ record.thirdapp_auth ? '是' : '否' }}
          </a-tag>
        </template>
      </a-table-column>
      <a-table-column title="业务对象" :width="140" ellipsis tooltip>
        <template #cell="{ record }">
          {{ record.biz_object || '--' }}
        </template>
      </a-table-column>
      <a-table-column title="数据源" :width="150" ellipsis tooltip>
        <template #cell="{ record }">
          {{ record.env_name || '--' }}
        </template>
      </a-table-column>
      <a-table-column title="应用" :width="160" ellipsis tooltip>
        <template #cell="{ record }">
          {{ record.app_number ? `${record.app_number} ${record.app_name || ''}` : '未归属' }}
        </template>
      </a-table-column>
      <a-table-column title="云" :width="100" ellipsis tooltip>
        <template #cell="{ record }">
          {{ record.cloud_name || '--' }}
        </template>
      </a-table-column>
      <a-table-column title="创建时间" :width="156">
        <template #cell="{ record }">
          {{ formatTime(record.source_created_at) }}
        </template>
      </a-table-column>
      <a-table-column title="更新时间" :width="156">
        <template #cell="{ record }">
          {{ formatTime(record.source_updated_at) }}
        </template>
      </a-table-column>
      <!-- 概览模式（API测试 → API概览）追加的 4 列 -->
      <template v-if="mode === 'overview'">
        <a-table-column title="用例数" :width="90">
          <template #cell="{ record }">
            {{ record.case_count ?? 0 }}
          </template>
        </a-table-column>
        <a-table-column title="成功数" :width="90">
          <template #cell="{ record }">
            {{ record.pass_count ?? 0 }}
          </template>
        </a-table-column>
        <a-table-column title="执行时间" :width="156">
          <template #cell="{ record }">
            {{ formatTime(record.last_tested_at) }}
          </template>
        </a-table-column>
        <a-table-column title="测试状态" :width="90">
          <template #cell="{ record }">
            <a-tag :color="statusMeta(record.status).color">
              {{ statusMeta(record.status).label }}
            </a-tag>
          </template>
        </a-table-column>
      </template>
      <a-table-column title="操作" :width="100" fixed="right">
        <template #cell="{ record }">
          <a-link @click="emit('context', record)">
            背景需求
          </a-link>
        </template>
      </a-table-column>
    </template>
    <template #empty>
      <a-empty description="暂无数据：点右上角「同步」从测试环境拉取接口定义" />
    </template>
  </a-table>
</template>
