<script setup lang="ts">
/**
 * API 用例表格（API测试用例页）
 *
 * 列：用例ID / 标题 / 接口 / 测试类型 / 角色 / 断言 / 执行方式 / 启用 / 操作。
 * 纯展示组件：分页与行操作都 emit 给页面，避免把数据加载逻辑散到子组件里。
 */
import {
  ASSERTION_LABELS,
  caseIdText,
  EXEC_MODE_LABELS,
  TEST_ROLE_LABELS,
  TEST_TYPE_LABELS,
} from './apiTestShared'

defineProps<{
  rows: any[]
  loading?: boolean
  pagination: Record<string, any>
  tableHeight?: number
}>()

const emit = defineEmits<{
  /** 事件名用 camelCase（模板里仍可写 @page-change，编译后即 onPageChange） */
  (e: 'pageChange', page: number): void
  (e: 'pageSizeChange', size: number): void
  (e: 'edit', record: any): void
  (e: 'delete', record: any): void
}>()
</script>

<template>
  <a-table
    :data="rows"
    :loading="loading"
    :pagination="pagination"
    :scroll="{ minWidth: 1320, y: tableHeight }"
    row-key="id"
    @page-change="emit('pageChange', $event)"
    @page-size-change="emit('pageSizeChange', $event)"
  >
    <template #columns>
      <a-table-column title="用例ID" :width="160" ellipsis tooltip>
        <template #cell="{ record }">
          {{ caseIdText(record) }}
        </template>
      </a-table-column>
      <a-table-column title="标题" :width="220" ellipsis tooltip>
        <template #cell="{ record }">
          {{ record.title || record.entity_name || '--' }}
        </template>
      </a-table-column>
      <a-table-column title="接口" data-index="api_path" :width="240" ellipsis tooltip />
      <a-table-column title="测试类型" :width="100">
        <template #cell="{ record }">
          {{ record.test_type ? TEST_TYPE_LABELS[record.test_type] || record.test_type : '--' }}
        </template>
      </a-table-column>
      <a-table-column title="角色" :width="110">
        <template #cell="{ record }">
          {{ record.test_role ? TEST_ROLE_LABELS[record.test_role] || record.test_role : '--' }}
        </template>
      </a-table-column>
      <a-table-column title="断言" :width="110">
        <template #cell="{ record }">
          {{ record.assertion ? ASSERTION_LABELS[record.assertion] || record.assertion : '--' }}
        </template>
      </a-table-column>
      <a-table-column title="执行方式" :width="100">
        <template #cell="{ record }">
          {{ record.exec_mode ? EXEC_MODE_LABELS[record.exec_mode] || record.exec_mode : '--' }}
        </template>
      </a-table-column>
      <a-table-column title="启用" :width="80">
        <template #cell="{ record }">
          <a-tag :color="record.enabled === 'Y' ? 'green' : 'gray'" size="small">
            {{ record.enabled === 'Y' ? '启用' : '停用' }}
          </a-tag>
        </template>
      </a-table-column>
      <a-table-column title="操作" :width="110" fixed="right">
        <template #cell="{ record }">
          <a-space>
            <a-link @click="emit('edit', record)">
              编辑
            </a-link>
            <a-link status="danger" @click="emit('delete', record)">
              删除
            </a-link>
          </a-space>
        </template>
      </a-table-column>
    </template>
    <template #empty>
      <a-empty description="暂无 API 用例：点右上角新建（平台编排 / Python脚本）" />
    </template>
  </a-table>
</template>
