<script setup lang="ts">
/** 自动化源配置：任务与 OpenAPI 凭据 CRUD、连接测试。 */
import { onMounted } from 'vue'
import ListPage from '@/components/common/ListPage.vue'
import AutomationSourceFormModal from './automation-sources/components/AutomationSourceFormModal.vue'
import { useAutomationSources } from './automation-sources/useAutomationSources'
import { enabledMeta } from './shared/types'

// 与 sys_menu.path 一致
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'monaudit-automation-sources' })

const {
  query,
  dataList,
  loading,
  pagination,
  onPageChange,
  onPageSizeChange,
  search,
  resetFilter,
  loadList,
  formVisible,
  formLoading,
  isEdit,
  formData,
  openCreate,
  openEdit,
  submitForm,
  testingId,
  testSource,
  removeSource,
} = useAutomationSources()

const statusOptions = [
  { value: '1', label: '启用' },
  { value: '0', label: '停用' },
]

onMounted(() => void loadList())
</script>

<template>
  <div class="p-4">
    <ListPage>
      <template #filter>
        <div class="filter-row">
          <a-input v-model="query.keyword" placeholder="编码 / 名称 / 任务名称" allow-clear class="keyword-input" @press-enter="search" />
          <a-select v-model="query.status" :options="statusOptions" placeholder="状态" allow-clear class="status-select" @change="search" />
          <a-button type="primary" size="small" @click="search">
            查询
          </a-button>
          <a-button size="small" @click="resetFilter">
            重置
          </a-button>
        </div>
      </template>

      <template #toolbar>
        <a-button type="primary" size="small" @click="openCreate">
          新增自动化源
        </a-button>
        <span class="toolbar-hint">先测试连接，再启用；停用配置也可测试</span>
      </template>

      <template #default="{ tableHeight }">
        <a-table
          :data="dataList"
          :loading="loading"
          :pagination="pagination"
          row-key="id"
          :scroll="{ minWidth: 1500, y: tableHeight }"
          @page-change="onPageChange"
          @page-size-change="onPageSizeChange"
        >
          <template #columns>
            <a-table-column title="编码" data-index="code" :width="190" ellipsis tooltip />
            <a-table-column title="名称" data-index="name" :width="190" ellipsis tooltip />
            <a-table-column title="平台地址" data-index="base_url" :width="250" ellipsis tooltip />
            <a-table-column title="任务" :width="250" ellipsis tooltip>
              <template #cell="{ record }">
                <div>{{ record.task_name }}</div>
                <div class="sub-text">
                  {{ record.task_id }}
                </div>
              </template>
            </a-table-column>
            <a-table-column title="token 路径" :width="190" ellipsis tooltip>
              <template #cell="{ record }">
                {{ record.auth_mode === 'token' ? '—' : record.token_path }}
              </template>
            </a-table-column>
            <a-table-column title="认证" :width="150">
              <template #cell="{ record }">
                <a-tag :color="record.has_app_secret ? 'arcoblue' : 'gray'" size="small">
                  {{ record.auth_mode === 'token' ? 'Token' : '应用凭据' }} · {{ record.has_app_secret ? '已配置' : '未配置' }}
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column title="状态" :width="80">
              <template #cell="{ record }">
                <a-tag :color="enabledMeta(record.status).color" size="small">
                  {{ enabledMeta(record.status).label }}
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column title="备注" data-index="remark" :width="220" ellipsis tooltip />
            <a-table-column title="操作" :width="270" fixed="right">
              <template #cell="{ record }">
                <a-space size="mini">
                  <a-button size="mini" :loading="testingId === record.id" @click="testSource(record)">
                    测试连接
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

    <AutomationSourceFormModal
      v-model:visible="formVisible"
      v-model:form="formData"
      :is-edit="isEdit"
      :loading="formLoading"
      :submit="submitForm"
    />
  </div>
</template>

<style scoped>
.filter-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.keyword-input { width: 260px; }
.status-select { width: 120px; }
.toolbar-hint { color: var(--color-text-3); font-size: 12px; }
.sub-text { color: var(--color-text-3); font-size: 12px; }
</style>
