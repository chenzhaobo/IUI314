<script lang="ts" setup>
/**
 * 监控审计 · 自动化轮次：轮次列表、新建、同步、结算、补抓日志，详情抽屉看批次进度。
 *
 * 状态与动作在 ./rounds/useRounds，批次进度在 ./rounds/useRoundDetail，取数经 ./rounds/service。
 */
import type { RoundRow } from './rounds/types'
import { computed, onMounted, ref } from 'vue'
import ListPage from '@/components/common/ListPage.vue'
import { formatTime } from '@/hooks'
import PipelineHelp from './rounds/components/PipelineHelp.vue'
import RoundDetailDrawer from './rounds/components/RoundDetailDrawer.vue'
import RoundModals from './rounds/components/RoundModals.vue'
import { TRIGGER_TYPE } from './rounds/types'
import { useRounds } from './rounds/useRounds'
import { ROUND_STATUS, tagMeta, tagOptions } from './shared/types'

// 组件名必须与路由 name（= sys_menu.path）逐字一致，keep-alive :include 才能缓存本页
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'monaudit-rounds' })

const {
  query,
  dataList,
  loading,
  pagination,
  onPageChange,
  onPageSizeChange,
  search,
  loadList,
  sourceOptions,
  createVisible,
  createForm,
  submitting,
  openCreate,
  submitCreate,
  syncVisible,
  syncRoundRow,
  syncSources,
  openSync,
  submitSync,
  actingId,
  settle,
  fetchLogs,
} = useRounds()

const statusOptions = tagOptions(ROUND_STATUS)
const syncTitle = computed(() => (syncRoundRow.value ? `同步 · ${syncRoundRow.value.round_no}` : '同步'))

const drawerVisible = ref(false)
const drawerRoundId = ref('')

function openDetail(row: RoundRow) {
  drawerRoundId.value = row.id
  drawerVisible.value = true
}

onMounted(() => {
  void loadList()
})
</script>

<template>
  <div class="p-4">
    <ListPage>
      <template #filter>
        <div class="filter-row">
          <a-input v-model="query.keyword" placeholder="轮次编号 / 名称" allow-clear style="width: 220px" @press-enter="search" />
          <a-select v-model="query.status" :options="statusOptions" placeholder="状态" allow-clear style="width: 140px" @change="search" />
          <a-button type="primary" size="small" @click="search">
            查询
          </a-button>
        </div>
        <PipelineHelp />
      </template>

      <template #toolbar>
        <a-button type="primary" size="small" @click="openCreate">
          新建轮次
        </a-button>
      </template>

      <template #default="{ tableHeight }">
        <a-table
          :data="dataList"
          :loading="loading"
          :pagination="pagination"
          row-key="id"
          :scroll="{ minWidth: 1400, y: tableHeight }"
          @page-change="onPageChange"
          @page-size-change="onPageSizeChange"
        >
          <template #columns>
            <a-table-column title="轮次编号" data-index="round_no" :width="140" ellipsis tooltip />
            <a-table-column title="名称" data-index="name" :width="160" ellipsis tooltip />
            <a-table-column title="状态" data-index="status" :width="100">
              <template #cell="{ record }">
                <a-tag :color="tagMeta(ROUND_STATUS, record.status).color" size="small">
                  {{ tagMeta(ROUND_STATUS, record.status).label }}
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column title="触发方式" data-index="trigger_type" :width="90">
              <template #cell="{ record }">
                {{ TRIGGER_TYPE[record.trigger_type] ?? record.trigger_type }}
              </template>
            </a-table-column>
            <a-table-column title="批次（成功/失败/进行中/总）" :width="200">
              <template #cell="{ record }">
                <span class="ok-text">{{ record.batch_success }}</span> /
                <span :class="{ 'fail-text': record.batch_failed > 0 }">{{ record.batch_failed }}</span> /
                {{ record.batch_running }} / {{ record.batch_total }}
              </template>
            </a-table-column>
            <a-table-column title="开始同步" data-index="started_at" :width="170">
              <template #cell="{ record }">
                {{ formatTime(record.started_at) }}
              </template>
            </a-table-column>
            <a-table-column title="同步完成" data-index="synced_at" :width="170">
              <template #cell="{ record }">
                {{ formatTime(record.synced_at) }}
              </template>
            </a-table-column>
            <a-table-column title="结算" data-index="settled_at" :width="170">
              <template #cell="{ record }">
                {{ formatTime(record.settled_at) }}
              </template>
            </a-table-column>
            <a-table-column title="操作" :width="270" fixed="right">
              <template #cell="{ record }">
                <a-space size="mini">
                  <a-button size="mini" :disabled="record.status === 'settled'" @click="openSync(record)">
                    同步
                  </a-button>
                  <a-button
                    size="mini"
                    :disabled="record.status === 'settled'"
                    :loading="actingId === record.id"
                    @click="settle(record)"
                  >
                    结算
                  </a-button>
                  <a-button size="mini" :loading="actingId === record.id" @click="fetchLogs(record)">
                    补抓日志
                  </a-button>
                  <a-button size="mini" type="primary" @click="openDetail(record)">
                    详情
                  </a-button>
                </a-space>
              </template>
            </a-table-column>
          </template>
        </a-table>
      </template>
    </ListPage>

    <RoundModals
      v-model:create-visible="createVisible"
      v-model:create-form="createForm"
      v-model:sync-visible="syncVisible"
      v-model:sync-sources="syncSources"
      :submitting="submitting"
      :source-options="sourceOptions"
      :sync-title="syncTitle"
      :submit-create="submitCreate"
      :submit-sync="submitSync"
    />

    <RoundDetailDrawer v-model:visible="drawerVisible" :round-id="drawerRoundId" @changed="loadList" />
  </div>
</template>

<style scoped>
.filter-row { display: flex; align-items: center; gap: 12px; }
.ok-text { color: rgb(var(--success-6)); }
.fail-text { color: rgb(var(--danger-6)); font-weight: 600; }
</style>
