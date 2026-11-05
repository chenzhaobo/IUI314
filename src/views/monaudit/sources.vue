<script lang="ts" setup>
/**
 * 监控审计 · 同步源配置：自动化环境 × 数据中心的苍穹 OpenAPI 与 Monitor 凭据。
 *
 * 凭据只进不出（出参只有 has_* 标记，编辑留空 = 保留）；测试 OpenAPI 与 Monitor 登录结果回写到行上。
 * 状态与动作在 ./sources/useSources、./sources/useMonitorLogin，取数经 ./sources/service。
 */
import { onMounted } from 'vue'
import ListPage from '@/components/common/ListPage.vue'
import { formatTime } from '@/hooks'
import { enabledMeta } from './shared/types'
import MonitorCaptchaModal from './sources/components/MonitorCaptchaModal.vue'
import SourceFormModal from './sources/components/SourceFormModal.vue'
import { verifyMeta } from './sources/types'
import { useMonitorLogin } from './sources/useMonitorLogin'
import { useSources } from './sources/useSources'

// 组件名必须与路由 name（= sys_menu.path）逐字一致，keep-alive :include 才能缓存本页
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'monaudit-sources' })

const {
  query,
  dataList,
  loading,
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
  removeSource,
  testingId,
  testSource,
} = useSources()

const {
  loggingId,
  captchaVisible,
  captchaImage,
  captchaReason,
  captchaCode,
  captchaLoading,
  login,
  refreshCaptcha,
  submitCode,
} = useMonitorLogin(() => void loadList())

const statusOptions = [
  { value: '1', label: '启用' },
  { value: '0', label: '停用' },
]

onMounted(() => {
  void loadList()
})
</script>

<template>
  <div class="p-4">
    <ListPage>
      <template #filter>
        <div class="filter-row">
          <a-input v-model="query.keyword" placeholder="编码 / 名称 / 环境 / 数据中心" allow-clear style="width: 260px" @press-enter="search" />
          <a-select v-model="query.status" :options="statusOptions" placeholder="状态" allow-clear style="width: 120px" @change="search" />
          <a-button type="primary" size="small" @click="search">
            查询
          </a-button>
        </div>
      </template>

      <template #toolbar>
        <a-button type="primary" size="small" @click="openCreate">
          新增同步源
        </a-button>
      </template>

      <template #default="{ tableHeight }">
        <a-table
          :data="dataList"
          :loading="loading"
          :pagination="pagination"
          row-key="id"
          :scroll="{ minWidth: 1600, y: tableHeight }"
          @page-change="onPageChange"
          @page-size-change="onPageSizeChange"
        >
          <template #columns>
            <a-table-column title="编码" data-index="code" :width="140" ellipsis tooltip />
            <a-table-column title="名称" data-index="name" :width="160" ellipsis tooltip />
            <a-table-column title="环境 / 数据中心" :width="200" ellipsis tooltip>
              <template #cell="{ record }">
                {{ record.env_name || '-' }} / {{ record.datacenter_name || '-' }}
              </template>
            </a-table-column>
            <a-table-column title="苍穹地址" data-index="base_url" :width="220" ellipsis tooltip />
            <a-table-column title="查询接口" data-index="query_api_path" :width="200" ellipsis tooltip />
            <a-table-column title="凭据" :width="150">
              <template #cell="{ record }">
                <a-space size="mini">
                  <a-tag :color="record.has_app_secret ? 'arcoblue' : 'gray'" size="small">
                    {{ record.has_app_secret ? '已存密钥' : '无密钥' }}
                  </a-tag>
                  <a-tag :color="record.has_monitor_credential ? 'arcoblue' : 'gray'" size="small">
                    {{ record.has_monitor_credential ? 'Monitor' : '无 Monitor' }}
                  </a-tag>
                </a-space>
              </template>
            </a-table-column>
            <a-table-column title="OpenAPI" :width="190">
              <template #cell="{ record }">
                <a-tooltip :disabled="!record.verify_error" :content="record.verify_error || ''">
                  <a-tag :color="verifyMeta(record.verify_error, record.verified_at).color" size="small">
                    {{ verifyMeta(record.verify_error, record.verified_at).label }}
                    <template v-if="!record.verify_error && record.verified_at">
                      {{ formatTime(record.verified_at, { precision: 'minute' }) }}
                    </template>
                  </a-tag>
                </a-tooltip>
              </template>
            </a-table-column>
            <a-table-column title="Monitor" :width="220">
              <template #cell="{ record }">
                <a-space size="mini">
                  <a-tooltip :disabled="!record.monitor_verify_error" :content="record.monitor_verify_error || ''">
                    <a-tag :color="verifyMeta(record.monitor_verify_error, record.monitor_verified_at).color" size="small">
                      {{ verifyMeta(record.monitor_verify_error, record.monitor_verified_at).label }}
                      <template v-if="!record.monitor_verify_error && record.monitor_verified_at">
                        {{ formatTime(record.monitor_verified_at, { precision: 'minute' }) }}
                      </template>
                    </a-tag>
                  </a-tooltip>
                  <a-tag v-if="record.monitor_logged_in" color="green" size="small">
                    会话有效
                  </a-tag>
                </a-space>
              </template>
            </a-table-column>
            <a-table-column title="状态" data-index="status" :width="80">
              <template #cell="{ record }">
                <a-tag :color="enabledMeta(record.status).color" size="small">
                  {{ enabledMeta(record.status).label }}
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column title="操作" :width="300" fixed="right">
              <template #cell="{ record }">
                <a-space size="mini">
                  <a-button size="mini" :loading="testingId === record.id" @click="testSource(record)">
                    测试OpenAPI
                  </a-button>
                  <a-button
                    size="mini"
                    :disabled="!record.monitor_base_url"
                    :loading="loggingId === record.id"
                    @click="login(record)"
                  >
                    Monitor登录
                  </a-button>
                  <a-button size="mini" type="primary" @click="openEdit(record)">
                    编辑
                  </a-button>
                  <a-button size="mini" status="danger" @click="removeSource(record)">
                    删除
                  </a-button>
                </a-space>
              </template>
            </a-table-column>
          </template>
        </a-table>
      </template>
    </ListPage>

    <SourceFormModal
      v-model:visible="formVisible"
      v-model:form="formData"
      :is-edit="isEdit"
      :loading="formLoading"
      :submit="submitForm"
    />

    <MonitorCaptchaModal
      v-model:visible="captchaVisible"
      v-model:code="captchaCode"
      :image="captchaImage"
      :reason="captchaReason"
      :loading="captchaLoading"
      :submit="submitCode"
      @refresh="refreshCaptcha"
    />
  </div>
</template>

<style scoped>
.filter-row { display: flex; align-items: center; gap: 12px; }
</style>
