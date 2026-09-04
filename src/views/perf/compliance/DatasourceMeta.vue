<template>
  <div class="page-container">
    <a-card title="数据源元数据" :bordered="false">
      <template #extra>
        <a-space>
          <a-select v-model="productLine" placeholder="产品线" style="width: 130px" allow-search @change="loadList">
            <a-option value="">全部</a-option>
            <a-option value="星瀚">星瀚</a-option>
            <a-option value="星空">星空</a-option>
          </a-select>
          <a-button @click="loadList">刷新</a-button>
        </a-space>
      </template>

      <a-alert type="info" style="margin-bottom: 12px">
        记录达标率各产品线所用 Superset 数据源（物理表）的字段口径、预置指标与 SQL 定义，避免口径散落在需求文档中时间久了遗失。
      </a-alert>

      <!-- 原生 div 挂 ref：组件 ref 拿到的是实例、没有 getBoundingClientRect -->
      <div ref="tableWrap">
      <a-table :data="list" :loading="loading" :pagination="false" row-key="id" :scroll="{ y: tableHeight }">
        <template #columns>
          <a-table-column title="产品线" :width="90">
            <template #cell="{ record }">
              <a-tag :color="record.product_line === '星空' ? 'purple' : 'blue'" size="small">{{ record.product_line }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="数据源ID" data-index="datasource_id" :width="90" />
          <a-table-column title="物理表名" data-index="table_name" ellipsis />
          <a-table-column title="全名" data-index="full_name" ellipsis />
          <a-table-column title="后端" data-index="database_backend" :width="80" />
          <a-table-column title="字段数" data-index="column_count" :width="80" />
          <a-table-column title="状态" :width="80">
            <template #cell="{ record }">
              <a-tag :color="record.status === '1' ? 'green' : 'red'" size="small">{{ record.status === '1' ? '启用' : '停用' }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="更新时间" data-index="updated_at" :width="160" />
          <a-table-column title="操作" :width="100" fixed="right">
            <template #cell="{ record }">
              <a-link @click="openDetail(record)">查看详情</a-link>
            </template>
          </a-table-column>
        </template>
      </a-table>
      </div>
    </a-card>

    <!-- 详情抽屉 -->
    <a-drawer v-model:visible="drawerVisible" :width="920" :title="detail ? `${detail.product_line} · ${detail.full_name || detail.table_name}` : '数据源详情'" :footer="false">
      <a-spin :loading="detailLoading" style="width: 100%">
        <template v-if="detail">
          <!-- 基本信息 -->
          <a-descriptions title="基本信息" :column="2" bordered size="small" style="margin-bottom: 16px">
            <a-descriptions-item label="产品线">{{ detail.product_line }}</a-descriptions-item>
            <a-descriptions-item label="数据源ID">{{ detail.datasource_id }}</a-descriptions-item>
            <a-descriptions-item label="物理表名">{{ detail.table_name }}</a-descriptions-item>
            <a-descriptions-item label="全名">{{ detail.full_name || '-' }}</a-descriptions-item>
            <a-descriptions-item label="Schema">{{ detail.schema_name || '-' }}</a-descriptions-item>
            <a-descriptions-item label="数据库后端">{{ detail.database_backend || '-' }}</a-descriptions-item>
            <a-descriptions-item label="字段数">{{ detail.column_count }}</a-descriptions-item>
            <a-descriptions-item label="状态">{{ detail.status === '1' ? '启用' : '停用' }}</a-descriptions-item>
            <a-descriptions-item label="来源URL" :span="2">
              <a-link :href="detail.source_url" target="_blank">{{ detail.source_url }}</a-link>
            </a-descriptions-item>
            <a-descriptions-item label="说明" :span="2">{{ detail.description || '-' }}</a-descriptions-item>
          </a-descriptions>

          <!-- SQL 定义 -->
          <a-typography-title :heading="6">SQL 定义</a-typography-title>
          <pre class="sql-block">{{ detail.sql_definition || '（物理表，无虚拟表 SQL）' }}</pre>

          <!-- 预置指标 -->
          <a-typography-title :heading="6" style="margin-top: 16px">预置指标（{{ detail.metrics.length }}）</a-typography-title>
          <a-table :data="detail.metrics" :pagination="false" size="small" row-key="metric_name">
            <template #columns>
              <a-table-column title="指标名" data-index="metric_name" :width="140" />
              <a-table-column title="显示名" data-index="verbose_name" :width="160" />
              <a-table-column title="表达式" data-index="expression" ellipsis />
            </template>
          </a-table>

          <!-- 字段明细 -->
          <a-typography-title :heading="6" style="margin-top: 16px">字段明细（{{ detail.columns.length }}）</a-typography-title>
          <a-table :data="detail.columns" :pagination="false" size="small" row-key="id" :scroll="{ y: 420 }">
            <template #columns>
              <a-table-column title="#" data-index="sort_order" :width="50" />
              <a-table-column title="字段名" data-index="column_name" :width="180" />
              <a-table-column title="显示名" data-index="verbose_name" :width="140">
                <template #cell="{ record }">{{ record.verbose_name || '-' }}</template>
              </a-table-column>
              <a-table-column title="类型" data-index="data_type" :width="110" />
              <a-table-column title="表达式" data-index="expression" ellipsis>
                <template #cell="{ record }">{{ record.expression || '-' }}</template>
              </a-table-column>
              <a-table-column title="时间列" :width="70">
                <template #cell="{ record }">
                  <a-tag v-if="record.is_dttm === '1'" color="orange" size="small">是</a-tag>
                  <span v-else style="color: #999">否</span>
                </template>
              </a-table-column>
              <a-table-column title="可过滤" :width="70">
                <template #cell="{ record }">{{ record.filterable === '1' ? '是' : '否' }}</template>
              </a-table-column>
              <a-table-column title="可分组" :width="70">
                <template #cell="{ record }">{{ record.groupby === '1' ? '是' : '否' }}</template>
              </a-table-column>
            </template>
          </a-table>
        </template>
      </a-spin>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ApiPerfDatasource } from '@/api/perfApis'
import { useGet, useTableAutoHeight } from '@/hooks'

defineOptions({ name: 'datasource-meta' })

// ── 列表 ──────────────────────────────────────
// 表格高度自适应：滚动条落在表格内、表头固定
const tableWrap = ref<HTMLElement>()
const { tableHeight } = useTableAutoHeight(tableWrap)

const productLine = ref('')
const listParams = ref<any>({ product_line: '' })
const { isFetching: loading, data: listData, execute: fetchList } = useGet<any>(ApiPerfDatasource.list, listParams, { immediate: true })
const list = ref<any[]>([])
watch(listData, (v) => {
  list.value = Array.isArray(v) ? v : []
}, { immediate: true })

const loadList = () => {
  listParams.value = { product_line: productLine.value }
  fetchList()
}

// ── 详情 ──────────────────────────────────────
const drawerVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<any>(null)
const detailParams = ref<any>({ id: '' })
const { execute: fetchDetail } = useGet<any>(ApiPerfDatasource.getById, detailParams, {
  immediate: false,
  onSuccess(data: any) {
    detail.value = data
    detailLoading.value = false
  },
})

const openDetail = (record: any) => {
  drawerVisible.value = true
  detail.value = null
  detailLoading.value = true
  detailParams.value = { id: record.id }
  fetchDetail()
}
</script>

<style scoped>
.sql-block {
  background: var(--color-fill-2);
  border: 1px solid var(--color-border-2);
  border-radius: 4px;
  padding: 12px;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 280px;
  overflow: auto;
  margin: 0;
}
</style>
