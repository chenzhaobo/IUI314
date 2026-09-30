<script lang="ts" setup>
/**
 * K8s 集群注册 — 列表 / 新增编辑 / 测试连接。
 *
 * 页面只留模板：列表、分页、弹窗与测试连接的状态都在 ./k8s-cluster/useK8sCluster，
 * 常量与展示口径在 ./k8s-cluster/types，取数在 ./k8s-cluster/service（组件不碰 `@/api`）。
 * 凭据（令牌 / CA）只进不出：表单里的输入不回显，列表只显示 has_credential 标记。
 */
import { onMounted } from 'vue'
import ListPage from '@/components/common/ListPage.vue'
import { formatTime } from '@/hooks'
import { K8S_AUTH_TYPE_OPTIONS, k8sAuthTypeLabel, k8sVerifyColor, k8sVerifyLabel } from './k8s-cluster/types'
import { useK8sCluster } from './k8s-cluster/useK8sCluster'

// 组件名必须与路由 name（= sys_menu.path 'k8s-cluster'）逐字一致，keep-alive :include 才能缓存本页
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'k8s-cluster' })

const {
  dataList,
  loading,
  query,
  pagination,
  onPageChange,
  onPageSizeChange,
  search,
  loadList,
  formVisible,
  formLoading,
  isEdit,
  formData,
  openCreate,
  openEdit,
  submitForm,
  removeCluster,
  testingId,
  testConnection,
} = useK8sCluster()

onMounted(() => {
  void loadList()
})
</script>

<template>
  <div class="p-4">
    <ListPage>
      <template #filter>
        <div class="filter-row">
          <a-input
            v-model="query.keyword"
            placeholder="编码 / 名称 / API Server"
            allow-clear
            style="width: 260px"
            @press-enter="search"
          />
          <a-button type="primary" size="small" @click="search">
            查询
          </a-button>
        </div>
      </template>

      <template #toolbar>
        <a-button type="primary" size="small" data-testid="btn-create-cluster" @click="openCreate">
          新增集群
        </a-button>
      </template>

      <template #default="{ tableHeight }">
        <a-table
          :data="dataList"
          :loading="loading"
          :pagination="pagination"
          row-key="id"
          :scroll="{ minWidth: 1280, y: tableHeight }"
          @page-change="onPageChange"
          @page-size-change="onPageSizeChange"
        >
          <template #columns>
            <a-table-column title="编码" data-index="code" :width="120" ellipsis tooltip />
            <a-table-column title="名称" data-index="name" :width="160" ellipsis tooltip />
            <a-table-column title="API Server" data-index="api_server" :width="220" ellipsis tooltip />
            <a-table-column title="默认命名空间" data-index="default_namespace" :width="150" ellipsis tooltip>
              <template #cell="{ record }">
                {{ record.default_namespace || '—' }}
              </template>
            </a-table-column>
            <a-table-column title="认证方式" data-index="auth_type" :width="120">
              <template #cell="{ record }">
                {{ k8sAuthTypeLabel(record.auth_type) }}
              </template>
            </a-table-column>
            <!-- 连通状态：verify_error 优先（最近一次测试失败），其次 verified_at（后端回写） -->
            <a-table-column title="连通状态" data-index="verify_error" :width="190">
              <template #cell="{ record }">
                <a-tooltip :disabled="!record.verify_error" :content="record.verify_error || ''">
                  <a-tag :color="k8sVerifyColor(record)">
                    {{ k8sVerifyLabel(record) }}
                    <template v-if="!record.verify_error && record.verified_at">
                      {{ formatTime(record.verified_at) }}
                    </template>
                  </a-tag>
                </a-tooltip>
              </template>
            </a-table-column>
            <a-table-column title="凭据" data-index="has_credential" :width="140">
              <template #cell="{ record }">
                <a-space>
                  <a-tag v-if="record.has_credential" color="arcoblue" size="small">
                    已存令牌
                  </a-tag>
                  <a-tag v-if="record.has_ca_cert" color="purple" size="small">
                    CA 证书
                  </a-tag>
                  <span v-if="!record.has_credential && !record.has_ca_cert">—</span>
                </a-space>
              </template>
            </a-table-column>
            <a-table-column title="操作" :width="220" fixed="right">
              <template #cell="{ record }">
                <a-space>
                  <a-button
                    size="mini"
                    :loading="testingId === record.id"
                    data-testid="btn-test-cluster"
                    @click="testConnection(record)"
                  >
                    测试连接
                  </a-button>
                  <a-button size="mini" type="primary" @click="openEdit(record)">
                    编辑
                  </a-button>
                  <a-button size="mini" status="danger" @click="removeCluster(record)">
                    删除
                  </a-button>
                </a-space>
              </template>
            </a-table-column>
          </template>
        </a-table>
      </template>
    </ListPage>

    <!-- 新增 / 编辑：凭据留空 = 不修改（后端按字段缺省保留旧值，内容永不回显） -->
    <a-modal
      v-model:visible="formVisible"
      :title="isEdit ? '编辑 K8s 集群' : '新增 K8s 集群'"
      :ok-loading="formLoading"
      @ok="submitForm"
    >
      <a-form :model="formData" layout="vertical">
        <a-form-item label="集群编码" required>
          <a-input v-model="formData.code" placeholder="唯一标识，如 fi-sit" data-testid="form-cluster-code" />
        </a-form-item>
        <a-form-item label="集群名称" required>
          <a-input v-model="formData.name" placeholder="如 财务 SIT 集群" />
        </a-form-item>
        <a-form-item label="API Server" required>
          <a-input v-model="formData.api_server" placeholder="如 http://172.20.198.18:8000" />
        </a-form-item>
        <a-form-item label="认证方式">
          <a-select v-model="formData.auth_type" :options="K8S_AUTH_TYPE_OPTIONS" />
        </a-form-item>
        <a-form-item label="访问令牌">
          <a-input-password
            v-model="formData.credential"
            :placeholder="isEdit ? '留空 = 不修改已存令牌' : 'ServiceAccount 令牌'"
            data-testid="form-cluster-credential"
          />
          <template v-if="isEdit" #extra>
            凭据不回显，留空表示保留原值
          </template>
        </a-form-item>
        <a-form-item label="CA 证书（PEM）">
          <a-textarea
            v-model="formData.ca_cert"
            :auto-size="{ minRows: 2, maxRows: 4 }"
            :placeholder="isEdit ? '留空 = 不修改' : 'http 集群可留空'"
          />
        </a-form-item>
        <a-form-item label="默认命名空间">
          <a-input v-model="formData.default_namespace" placeholder="可选，如 fi-all-sit" />
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
