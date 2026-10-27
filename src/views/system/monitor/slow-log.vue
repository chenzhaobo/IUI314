<script setup lang="ts">
import { ref } from 'vue'
import Pagination from '@/components/common/pagination.vue'
import { systemMenus } from '@/router'
import {
  SlowRequestDetail,
  SlowRequestOverviewPanel,
  SlowRequestQuery,
  SlowRequestTable,
  SlowSqlDetail,
  SlowSqlOverviewPanel,
  SlowSqlQuery,
  SlowSqlTable,
} from './pages/slow-log'
import {
  useSlowRequestDetail,
  useSlowRequestLog,
  useSlowRequestOverview,
  useSlowSqlDetail,
  useSlowSqlLog,
  useSlowSqlOverview,
} from './pages/slow-log/use-slow-log'

defineOptions({ name: systemMenus.slowLog.path })

const activeTab = ref('request')
const {
  queryParams: requestQuery,
  data: requestData,
  loading: requestLoading,
  getList: requestGetList,
  query: requestSearch,
} = useSlowRequestLog()
const {
  queryParams: sqlQuery,
  data: sqlData,
  loading: sqlLoading,
  getList: sqlGetList,
  query: sqlSearch,
} = useSlowSqlLog()
const { detail, loading: detailLoading, visible: detailVisible, openDetail } = useSlowSqlDetail()
const {
  overview: requestOverview,
  loading: requestOverviewLoading,
} = useSlowRequestOverview()
const { overview: sqlOverview, loading: sqlOverviewLoading } = useSlowSqlOverview()
const {
  detail: requestDetail,
  relatedSql,
  detailLoading: requestDetailLoading,
  sqlLoading: relatedSqlLoading,
  visible: requestDetailVisible,
  openDetail: openRequestDetail,
} = useSlowRequestDetail()
</script>

<template>
  <a-tabs v-model:active-key="activeTab" type="rounded">
    <a-tab-pane key="request" title="慢请求">
      <SlowRequestOverviewPanel :overview="requestOverview" :loading="requestOverviewLoading" />
      <SlowRequestQuery v-model:query-params="requestQuery" @query="requestSearch" />
      <SlowRequestTable :table-data="requestData?.list || []" :loading="requestLoading" @view="openRequestDetail" />
      <SlowRequestDetail
        v-model:visible="requestDetailVisible"
        :detail="requestDetail"
        :related-sql="relatedSql?.list || []"
        :detail-loading="requestDetailLoading"
        :sql-loading="relatedSqlLoading"
      />
      <Pagination
        v-if="requestData?.total"
        v-model:limit="requestQuery.page_size"
        v-model:page="requestQuery.page_num"
        :total="requestData.total"
        @pagination="requestGetList"
      />
    </a-tab-pane>
    <a-tab-pane key="sql" title="慢 SQL">
      <SlowSqlOverviewPanel :overview="sqlOverview" :loading="sqlOverviewLoading" />
      <SlowSqlQuery v-model:query-params="sqlQuery" @query="sqlSearch" />
      <SlowSqlTable :table-data="sqlData?.list || []" :loading="sqlLoading" @view="openDetail" />
      <Pagination
        v-if="sqlData?.total"
        v-model:limit="sqlQuery.page_size"
        v-model:page="sqlQuery.page_num"
        :total="sqlData.total"
        @pagination="sqlGetList"
      />
      <SlowSqlDetail v-model:visible="detailVisible" :detail="detail" :loading="detailLoading" />
    </a-tab-pane>
  </a-tabs>
</template>
