<script lang="ts" setup>
/**
 * 摸底压测页：计划列表（状态 / 当前档位与步骤）+ 新建弹窗 + 详情抽屉。
 *
 * 菜单由后端迁移登记（component `perf/probe-plan`），组件名必须与路由 name 逐字一致。
 */
import { onMounted } from 'vue'
import ListPage from '@/components/common/ListPage.vue'
import { formatTime } from '@/hooks'
import ProbeCreateModal from './probe-plan/ProbeCreateModal.vue'
import ProbeDetailDrawer from './probe-plan/ProbeDetailDrawer.vue'
import { hwPositionText, planStatusColor, planStatusText, stepText } from './probe-plan/types'
import { useProbePlan } from './probe-plan/useProbePlan'

// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'probe-plan' })

const {
  loading,
  plans,
  envFilter,
  statusFilter,
  envOptions,
  scriptOptions,
  loadNodeOptions,
  load,
  loadAll,
  createVisible,
  creating,
  submitCreate,
  detailVisible,
  detailLoading,
  detail,
  openDetail,
  refreshDetail,
  canOperate,
  overrideThreads,
  overriding,
  submitOverride,
  confirmCancel,
  cancelling,
} = useProbePlan()

onMounted(() => {
  void loadAll()
})
</script>

<template>
  <div class="p-4">
    <ListPage>
      <template #filter>
        <a-space wrap>
          <a-select
            v-model="envFilter"
            :options="envOptions"
            placeholder="按环境筛选"
            allow-clear
            class="pp-sel"
            @change="() => load()"
          />
          <a-select
            v-model="statusFilter"
            placeholder="按状态筛选"
            allow-clear
            class="pp-sel"
            @change="() => load()"
          >
            <a-option value="pending">
              排队中
            </a-option>
            <a-option value="running">
              执行中
            </a-option>
            <a-option value="done">
              已完成
            </a-option>
            <a-option value="failed">
              失败
            </a-option>
            <a-option value="cancelled">
              已取消
            </a-option>
          </a-select>
          <a-button @click="() => load()">
            刷新
          </a-button>
        </a-space>
      </template>

      <template #toolbar>
        <a-button type="primary" size="small" @click="createVisible = true">
          新建摸底计划
        </a-button>
        <span class="pp-hint">最多显示最近 200 条</span>
      </template>

      <template #default="{ tableHeight }">
        <a-table
          :data="plans"
          :loading="loading"
          :pagination="false"
          row-key="id"
          :scroll="{ minWidth: 1320, y: tableHeight }"
        >
          <template #columns>
            <a-table-column title="计划名称" :width="180" fixed="left">
              <template #cell="{ record }">
                {{ record.name }}
              </template>
            </a-table-column>
            <a-table-column title="环境" :width="150">
              <template #cell="{ record }">
                {{ record.env_name || record.env_id }}
              </template>
            </a-table-column>
            <a-table-column title="脚本" :width="170">
              <template #cell="{ record }">
                {{ record.script_name || record.script_id }}
              </template>
            </a-table-column>
            <a-table-column title="状态" :width="90">
              <template #cell="{ record }">
                <a-tag :color="planStatusColor(record.status)" size="small">
                  {{ planStatusText(record.status) }}
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column title="当前档位" :width="90">
              <template #cell="{ record }">
                {{ hwPositionText(record) }}
              </template>
            </a-table-column>
            <a-table-column title="当前步骤" :width="110">
              <template #cell="{ record }">
                {{ stepText(record.current_step) }}
              </template>
            </a-table-column>
            <a-table-column title="目标 TPS" :width="100">
              <template #cell="{ record }">
                {{ record.target_tps ?? '倍增模式' }}
              </template>
            </a-table-column>
            <a-table-column title="创建人" :width="100" data-index="created_by" />
            <a-table-column title="创建时间" :width="160">
              <template #cell="{ record }">
                {{ formatTime(record.created_at) }}
              </template>
            </a-table-column>
            <a-table-column title="操作" :width="90" fixed="right">
              <template #cell="{ record }">
                <a-button type="text" size="small" @click="openDetail(record)">
                  详情
                </a-button>
              </template>
            </a-table-column>
          </template>
        </a-table>
      </template>
    </ListPage>

    <ProbeCreateModal
      v-model:visible="createVisible"
      :submitting="creating"
      :env-options="envOptions"
      :script-options="scriptOptions"
      :load-node-options="loadNodeOptions"
      @submit="submitCreate"
    />

    <ProbeDetailDrawer
      v-model:visible="detailVisible"
      v-model:override-threads="overrideThreads"
      :detail="detail"
      :loading="detailLoading"
      :can-operate="canOperate"
      :overriding="overriding"
      :cancelling="cancelling"
      @refresh="() => refreshDetail()"
      @override="submitOverride"
      @cancel="confirmCancel"
    />
  </div>
</template>

<style scoped>
.pp-sel {
  width: 180px;
}

.pp-hint {
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
