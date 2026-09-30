<script lang="ts" setup>
/**
 * Prometheus 数据源 — 列表 / 新增编辑 / 测试连接。
 *
 * 用途（container / host_middleware）决定去哪台 Prometheus 回查：容器指标在 88，
 * 主机与中间件在 PMM，跨台查不到。鉴权方式联动用户名 / 凭据输入，凭据永不回显。
 * 状态与动作在 ./prometheus-source/usePrometheusSource，取数在 ./prometheus-source/service。
 */
import { onMounted } from 'vue'
import ListPage from '@/components/common/ListPage.vue'
import { formatTime } from '@/hooks'
import {
  promAuthTypeLabel,
  promBuildVersion,
  PROMETHEUS_AUTH_TYPE_OPTIONS,
  PROMETHEUS_PURPOSE_OPTIONS,
  promPurposeLabel,
  promVerifyColor,
  promVerifyLabel,
} from './prometheus-source/types'
import { usePrometheusSource } from './prometheus-source/usePrometheusSource'

// 组件名必须与路由 name（= sys_menu.path 'prometheus-source'）逐字一致，keep-alive :include 才能缓存本页
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'prometheus-source' })

const {
  dataList,
  loading,
  query,
  pagination,
  onPageChange,
  onPageSizeChange,
  search,
  loadList,
  clusterOptions,
  clusterNames,
  loadClusterOptions,
  formVisible,
  formLoading,
  isEdit,
  formData,
  showUsername,
  showCredential,
  openCreate,
  openEdit,
  onAuthTypeChange,
  submitForm,
  removePrometheus,
  testingId,
  testConnection,
} = usePrometheusSource()

onMounted(() => {
  void loadList()
  void loadClusterOptions()
})
</script>

<template>
  <div class="p-4">
    <ListPage>
      <template #filter>
        <div class="filter-row">
          <a-input
            v-model="query.keyword"
            placeholder="编码 / 名称 / Base URL"
            allow-clear
            style="width: 240px"
            @press-enter="search"
          />
          <a-select
            v-model="query.purpose"
            placeholder="用途"
            :options="PROMETHEUS_PURPOSE_OPTIONS"
            allow-clear
            style="width: 200px"
            @change="search"
          />
          <a-button type="primary" size="small" @click="search">
            查询
          </a-button>
        </div>
      </template>

      <template #toolbar>
        <a-button type="primary" size="small" data-testid="btn-create-prometheus" @click="openCreate">
          新增数据源
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
            <a-table-column title="编码" data-index="code" :width="120" ellipsis tooltip />
            <a-table-column title="名称" data-index="name" :width="150" ellipsis tooltip />
            <a-table-column title="Base URL" data-index="base_url" :width="210" ellipsis tooltip />
            <a-table-column title="用途" data-index="purpose" :width="180">
              <template #cell="{ record }">
                {{ promPurposeLabel(record.purpose) }}
              </template>
            </a-table-column>
            <a-table-column title="鉴权" data-index="auth_type" :width="130">
              <template #cell="{ record }">
                {{ promAuthTypeLabel(record.auth_type) }}
              </template>
            </a-table-column>
            <a-table-column title="关联集群" data-index="cluster_id" :width="150" ellipsis tooltip>
              <template #cell="{ record }">
                {{ record.cluster_id ? (clusterNames[record.cluster_id] || record.cluster_id) : '—' }}
              </template>
            </a-table-column>
            <a-table-column title="版本" data-index="build_info" :width="110" ellipsis tooltip>
              <template #cell="{ record }">
                {{ promBuildVersion(record) || '—' }}
              </template>
            </a-table-column>
            <a-table-column title="连通状态" data-index="verify_error" :width="190">
              <template #cell="{ record }">
                <a-tooltip :disabled="!record.verify_error" :content="record.verify_error || ''">
                  <a-tag :color="promVerifyColor(record)">
                    {{ promVerifyLabel(record) }}
                    <template v-if="!record.verify_error && record.verified_at">
                      {{ formatTime(record.verified_at) }}
                    </template>
                  </a-tag>
                </a-tooltip>
              </template>
            </a-table-column>
            <a-table-column title="操作" :width="220" fixed="right">
              <template #cell="{ record }">
                <a-space>
                  <a-button
                    size="mini"
                    :loading="testingId === record.id"
                    data-testid="btn-test-prometheus"
                    @click="testConnection(record)"
                  >
                    测试连接
                  </a-button>
                  <a-button size="mini" type="primary" @click="openEdit(record)">
                    编辑
                  </a-button>
                  <a-button size="mini" status="danger" @click="removePrometheus(record)">
                    删除
                  </a-button>
                </a-space>
              </template>
            </a-table-column>
          </template>
        </a-table>
      </template>
    </ListPage>

    <!-- 新增 / 编辑：鉴权方式联动用户名与凭据输入；凭据留空 = 不修改 -->
    <a-modal
      v-model:visible="formVisible"
      :title="isEdit ? '编辑 Prometheus 数据源' : '新增 Prometheus 数据源'"
      :ok-loading="formLoading"
      @ok="submitForm"
    >
      <a-form :model="formData" layout="vertical">
        <a-form-item label="数据源编码" required>
          <a-input v-model="formData.code" placeholder="唯一标识，如 prom-container-88" data-testid="form-prom-code" />
        </a-form-item>
        <a-form-item label="名称" required>
          <a-input v-model="formData.name" placeholder="如 SIT 容器 Prometheus" />
        </a-form-item>
        <a-form-item label="Base URL" required>
          <a-input v-model="formData.base_url" placeholder="如 http://172.20.198.24:88" />
        </a-form-item>
        <a-form-item label="用途">
          <a-select v-model="formData.purpose" :options="PROMETHEUS_PURPOSE_OPTIONS" />
          <template #extra>
            容器指标与主机/中间件指标分属两台 Prometheus，用途决定回查哪一台
          </template>
        </a-form-item>
        <a-form-item label="鉴权方式">
          <a-select v-model="formData.auth_type" :options="PROMETHEUS_AUTH_TYPE_OPTIONS" @change="onAuthTypeChange" />
        </a-form-item>
        <a-form-item v-if="showUsername" label="用户名" required>
          <a-input v-model="formData.username" placeholder="Basic 认证用户名" />
        </a-form-item>
        <a-form-item v-if="showCredential" :label="formData.auth_type === 'bearer' ? '令牌' : '密码'">
          <a-input-password
            v-model="formData.credential"
            :placeholder="isEdit ? '留空 = 不修改已存凭据' : (formData.auth_type === 'bearer' ? 'Bearer 令牌' : 'Basic 认证密码')"
            data-testid="form-prom-credential"
          />
          <template v-if="isEdit" #extra>
            凭据不回显，留空表示保留原值
          </template>
        </a-form-item>
        <a-form-item label="关联集群">
          <a-select
            v-model="formData.cluster_id"
            :options="clusterOptions"
            placeholder="可选；容器用途建议关联"
            allow-clear
            allow-search
          />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model="formData.remark" :auto-size="{ minRows: 2, maxRows: 4 }" placeholder="可选" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.filter-row { display: flex; align-items: center; gap: 12px; }
</style>
