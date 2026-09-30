<script lang="ts" setup>
/**
 * Monitor（eye）数据源 — 列表 / 新增编辑 / 测试连接。
 *
 * 登录密码只进不出：表单输入不回显，编辑留空 = 不修改；测试连接走后端完整登录
 * 流程，成功后回写采样上限与火焰图保留天数，页面按回写值提示保留期。
 * 状态与动作在 ./monitor-source/useMonitorSource，取数在 ./monitor-source/service。
 */
import { onMounted } from 'vue'
import ListPage from '@/components/common/ListPage.vue'
import { formatTime } from '@/hooks'
import { monSampleLimitText, monStoreDaysText, monVerifyColor, monVerifyLabel } from './monitor-source/types'
import { useMonitorSource } from './monitor-source/useMonitorSource'

// 组件名必须与路由 name（= sys_menu.path 'monitor-source'）逐字一致，keep-alive :include 才能缓存本页
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'monitor-source' })

const {
  dataList,
  loading,
  query,
  pagination,
  onPageChange,
  onPageSizeChange,
  search,
  loadList,
  retentionHint,
  formVisible,
  formLoading,
  isEdit,
  formData,
  openCreate,
  openEdit,
  submitForm,
  removeMonitorSource,
  testingId,
  testConnection,
} = useMonitorSource()

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
            placeholder="编码 / 名称 / Base URL"
            allow-clear
            style="width: 260px"
            @press-enter="search"
          />
          <a-button type="primary" size="small" @click="search">
            查询
          </a-button>
        </div>
        <a-alert class="retention-hint" type="info" :show-icon="false">
          {{ retentionHint }}
        </a-alert>
      </template>

      <template #toolbar>
        <a-button type="primary" size="small" data-testid="btn-create-monitor" @click="openCreate">
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
            <a-table-column title="编码" data-index="code" :width="110" ellipsis tooltip />
            <a-table-column title="名称" data-index="name" :width="150" ellipsis tooltip />
            <a-table-column title="Base URL" data-index="base_url" :width="200" ellipsis tooltip />
            <a-table-column title="用户名" data-index="username" :width="150" ellipsis tooltip>
              <template #cell="{ record }">
                <span>{{ record.username }}</span>
                <a-tag v-if="record.has_credential" color="arcoblue" size="small" class="cred-tag">
                  已存密码
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column title="集群标签" data-index="cluster_label" :width="110" ellipsis tooltip>
              <template #cell="{ record }">
                {{ record.cluster_label || '—' }}
              </template>
            </a-table-column>
            <a-table-column title="采样上限" data-index="max_sample_seconds" :width="100" ellipsis tooltip>
              <template #cell="{ record }">
                {{ monSampleLimitText(record) }}
              </template>
            </a-table-column>
            <a-table-column title="保留天数" data-index="max_store_days" :width="100" ellipsis tooltip>
              <template #cell="{ record }">
                {{ monStoreDaysText(record) }}
              </template>
            </a-table-column>
            <!-- 连通状态：verify_error 优先（最近一次测试失败），其次 verified_at（后端回写） -->
            <a-table-column title="连通状态" data-index="verify_error" :width="190">
              <template #cell="{ record }">
                <a-tooltip :disabled="!record.verify_error" :content="record.verify_error || ''">
                  <a-tag :color="monVerifyColor(record)">
                    {{ monVerifyLabel(record) }}
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
                    data-testid="btn-test-monitor"
                    @click="testConnection(record)"
                  >
                    测试连接
                  </a-button>
                  <a-button size="mini" type="primary" @click="openEdit(record)">
                    编辑
                  </a-button>
                  <a-button size="mini" status="danger" @click="removeMonitorSource(record)">
                    删除
                  </a-button>
                </a-space>
              </template>
            </a-table-column>
          </template>
        </a-table>
      </template>
    </ListPage>

    <!-- 新增 / 编辑：登录密码留空 = 不修改（后端按字段缺省保留旧值，内容永不回显） -->
    <a-modal
      v-model:visible="formVisible"
      :title="isEdit ? '编辑 Monitor 数据源' : '新增 Monitor 数据源'"
      :ok-loading="formLoading"
      @ok="submitForm"
    >
      <a-form :model="formData" layout="vertical">
        <a-form-item label="数据源编码" required>
          <a-input v-model="formData.code" placeholder="唯一标识，如 monitor-sit" data-testid="form-monitor-code" />
        </a-form-item>
        <a-form-item label="名称" required>
          <a-input v-model="formData.name" placeholder="如 SIT Monitor（eye）" />
        </a-form-item>
        <a-form-item label="Base URL" required>
          <a-input v-model="formData.base_url" placeholder="如 http://172.20.198.18:8023/ierp/monitor" />
        </a-form-item>
        <a-form-item label="登录用户名" required>
          <a-input v-model="formData.username" placeholder="如 monitor" />
        </a-form-item>
        <a-form-item label="登录密码">
          <a-input-password
            v-model="formData.credential"
            :placeholder="isEdit ? '留空 = 不修改已存密码' : 'Monitor 登录密码'"
            data-testid="form-monitor-credential"
          />
          <template v-if="isEdit" #extra>
            凭据不回显，留空表示保留原值
          </template>
        </a-form-item>
        <a-form-item label="集群标签">
          <a-input v-model="formData.cluster_label" placeholder="如 fi_sit" />
          <template #extra>
            对应部署标签 cluster，用于匹配 Monitor 节点清单所属的集群
          </template>
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
.retention-hint { margin-top: 10px; padding: 6px 12px; }
.cred-tag { margin-left: 6px; }
</style>
