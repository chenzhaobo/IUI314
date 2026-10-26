<script setup lang="ts">
import { ref } from 'vue'
import Pagination from '@/components/common/pagination.vue'
import { systemMenus } from '@/router'
import {
  SlowRequestQuery,
  SlowRequestTable,
  SlowSqlDetail,
  SlowSqlQuery,
  SlowSqlTable,
} from './pages/slow-log'
import { useSlowRequestLog, useSlowSqlDetail, useSlowSqlLog } from './pages/slow-log/use-slow-log'

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
</script>

<template>
  <a-tabs v-model:active-key="activeTab" type="rounded">
    <a-tab-pane key="request" title="慢请求">
      <SlowRequestQuery v-model:query-params="requestQuery" @query="requestSearch" />
      <SlowRequestTable :table-data="requestData?.list || []" :loading="requestLoading" />
      <Pagination
        v-if="requestData?.total"
        v-model:limit="requestQuery.page_size"
        v-model:page="requestQuery.page_num"
        :total="requestData.total"
        @pagination="requestGetList"
      />
    </a-tab-pane>
    <a-tab-pane key="sql" title="慢 SQL">
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
