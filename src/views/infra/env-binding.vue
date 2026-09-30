<script lang="ts" setup>
/**
 * 环境资源绑定 — 左：性能环境列表；右：生效绑定表 + 集群发现候选。
 *
 * 候选区放在 ListPage 的**工具行插槽**（而不是表格下方）：工具行是主体区里
 * 表格容器上方的兄弟节点，候选区出现/消失会改变工具行高度，`.lp-table` 作为
 * flex:1 子项高度随之变化并被内部实测捕获，表格高度自动收缩/回弹，不需要在
 * 数据回来后手工重测。挂到表格下方则会与「上方/下方兄弟」的实测相互干扰。
 *
 * 页面只留模板：状态与取数在 ./env-binding/useEnvBinding，取数在 ./env-binding/service。
 */
import { onMounted } from 'vue'
import ListPage from '@/components/common/ListPage.vue'
import { formatTime } from '@/hooks'
import BindFormModal from './env-binding/BindFormModal.vue'
import CandidatePane from './env-binding/CandidatePane.vue'
import DiscoverModal from './env-binding/DiscoverModal.vue'
import { BINDING_MISSING_TEXT, bindingResourceText, bindingRowClass, bindKindLabel, bindSourceLabel } from './env-binding/types'
import { useEnvBinding } from './env-binding/useEnvBinding'

// 组件名必须与路由 name（= sys_menu.path 'env-binding'）逐字一致，keep-alive :include 才能缓存本页
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'env-binding' })

const {
  envList,
  envLoading,
  activeEnvId,
  activeEnvName,
  selectEnv,
  effectiveBindings,
  candidateBindings,
  bindingLoading,
  loadAll,
  clusterOptions,
  promOptions,
  monitorOptions,
  vmOptions,
  serviceOptions,
  nameMaps,
  bindVisible,
  bindLoading,
  bindForm,
  openBind,
  submitBind,
  discoverVisible,
  discoverLoading,
  discoverForm,
  openDiscover,
  submitDiscover,
  removeBinding,
  toggleAllowOps,
  allowOpsSavingId,
  appNameDraft,
  onAppNameInput,
  commitAppName,
  confirming,
  ignoring,
  confirmCandidates,
  ignoreCandidates,
} = useEnvBinding()

onMounted(() => {
  void loadAll()
})
</script>

<template>
  <div class="p-4">
    <ListPage aside-title="性能环境" :aside-width="240" aside-resizable>
      <template #aside>
        <a-spin :loading="envLoading" class="eb-env-spin">
          <div
            v-for="env in envList"
            :key="env.id"
            class="eb-env-item"
            :class="{ 'is-active': env.id === activeEnvId }"
            data-testid="env-item"
            @click="selectEnv(env)"
          >
            <span class="eb-env-name">{{ env.env_name }}</span>
            <span class="eb-env-code">{{ env.env_code }}</span>
            <a-tag v-if="env.status !== '1'" size="small">
              停用
            </a-tag>
          </div>
          <a-empty v-if="!envLoading && !envList.length" description="暂无性能环境" />
        </a-spin>
      </template>

      <template #toolbar>
        <a-button
          type="primary"
          size="small"
          :disabled="!activeEnvId"
          data-testid="btn-create-binding"
          @click="openBind"
        >
          新增绑定
        </a-button>
        <a-button
          size="small"
          :disabled="!activeEnvId"
          data-testid="btn-discover"
          @click="openDiscover"
        >
          从集群发现
        </a-button>
        <span v-if="activeEnvName" class="eb-env-hint">当前环境：{{ activeEnvName }}</span>
        <CandidatePane
          v-if="candidateBindings.length"
          :candidates="candidateBindings"
          :maps="nameMaps"
          :confirming="confirming"
          :ignoring="ignoring"
          @confirm="confirmCandidates"
          @ignore="ignoreCandidates"
        />
      </template>

      <template #default="{ tableHeight }">
        <a-table
          :data="effectiveBindings"
          :loading="bindingLoading"
          :pagination="false"
          row-key="id"
          :row-class="bindingRowClass"
          :scroll="{ minWidth: 1380, y: tableHeight }"
        >
          <template #columns>
            <a-table-column title="绑定类型" :width="120">
              <template #cell="{ record }">
                {{ bindKindLabel(record.bind_kind) }}
              </template>
            </a-table-column>
            <a-table-column title="资源描述" :width="320">
              <template #cell="{ record }">
                <span>{{ bindingResourceText(record, nameMaps) }}</span>
                <a-tag v-if="record.still_exists === false" size="small" color="red" class="eb-missing-tag">
                  {{ BINDING_MISSING_TEXT }}
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column title="角色" :width="110">
              <template #cell="{ record }">
                {{ record.infra_role || '—' }}
              </template>
            </a-table-column>
            <a-table-column title="允许操作" :width="110">
              <template #cell="{ record }">
                <a-switch
                  :model-value="!!record.allow_ops"
                  size="small"
                  :loading="allowOpsSavingId === record.id"
                  @change="(v: boolean | string | number) => toggleAllowOps(record, !!v)"
                />
              </template>
            </a-table-column>
            <!-- 工作负载行可在此直接改 Monitor 应用名（失焦/回车提交，见 useEnvBinding） -->
            <a-table-column title="Monitor 应用名" :width="190">
              <template #cell="{ record }">
                <a-input
                  v-if="record.bind_kind === 'workload'"
                  :model-value="appNameDraft[record.id] ?? record.monitor_app_name ?? ''"
                  size="mini"
                  placeholder="如 fi-ebg-sit"
                  data-testid="input-monitor-app-name"
                  @update:model-value="(v: string) => onAppNameInput(record, v)"
                  @change="(v: string) => commitAppName(record, v)"
                />
                <span v-else>{{ record.monitor_app_name || '—' }}</span>
              </template>
            </a-table-column>
            <a-table-column title="来源" :width="100">
              <template #cell="{ record }">
                {{ bindSourceLabel(record.discovered_by) }}
              </template>
            </a-table-column>
            <a-table-column title="确认人 / 时间" :width="200">
              <template #cell="{ record }">
                <template v-if="record.confirmed_at">
                  {{ record.confirmed_by || '—' }} · {{ formatTime(record.confirmed_at) }}
                </template>
                <span v-else>—</span>
              </template>
            </a-table-column>
            <a-table-column title="操作" :width="90" fixed="right">
              <template #cell="{ record }">
                <a-button size="mini" status="danger" @click="removeBinding(record)">
                  解绑
                </a-button>
              </template>
            </a-table-column>
          </template>
        </a-table>
      </template>
    </ListPage>

    <BindFormModal
      v-model:visible="bindVisible"
      v-model:form="bindForm"
      :loading="bindLoading"
      :env-name="activeEnvName"
      :cluster-options="clusterOptions"
      :prom-options="promOptions"
      :monitor-options="monitorOptions"
      :vm-options="vmOptions"
      :service-options="serviceOptions"
      @submit="submitBind"
    />
    <DiscoverModal
      v-model:visible="discoverVisible"
      v-model:form="discoverForm"
      :loading="discoverLoading"
      :env-name="activeEnvName"
      :cluster-options="clusterOptions"
      @submit="submitDiscover"
    />
  </div>
</template>

<style scoped>
.eb-env-spin {
  display: block;
  width: 100%;
}

.eb-env-item {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.eb-env-item:hover {
  background: var(--color-fill-1);
}

.eb-env-item.is-active {
  background: var(--color-primary-light-1);
}

.eb-env-item.is-active .eb-env-name {
  color: rgb(var(--primary-6));
  font-weight: 600;
}

.eb-env-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.eb-env-code {
  color: var(--color-text-3);
  font-size: 12px;
}

.eb-env-hint {
  margin-left: 4px;
  color: var(--color-text-3);
}

.eb-missing-tag {
  margin-left: 6px;
}

/* K8s 最近一次发现没再返回的工作负载：整行红底（类名由 types 的 bindingRowClass 给出） */
:deep(.row-missing) td {
  background-color: var(--color-danger-light-1);
}
</style>
