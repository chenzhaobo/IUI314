<script lang="ts" setup>
/**
 * 监控审计 · 领域映射：领域 / 调用类 → 项目组。
 *
 * 左侧「未匹配领域」列出未归类问题的领域分布，一键预填建映射；右侧映射规则 CRUD 与重新归属。
 * 状态与动作在 ./mappings/useMappings，取数经 ./mappings/service。
 */
import { onMounted } from 'vue'
import ListPage from '@/components/common/ListPage.vue'
import { formatTime } from '@/hooks'
import MappingFormModal from './mappings/components/MappingFormModal.vue'
import UnmappedTable from './mappings/components/UnmappedTable.vue'
import { useMappings } from './mappings/useMappings'
import { enabledMeta, MATCH_TYPE, tagMeta, tagOptions } from './shared/types'

// 组件名必须与路由 name（= sys_menu.path）逐字一致，keep-alive :include 才能缓存本页
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'monaudit-mappings' })

const {
  query,
  dataList,
  loading,
  pagination,
  onPageChange,
  onPageSizeChange,
  search,
  projectGroups,
  unmapped,
  unmappedLoading,
  loadUnmapped,
  formVisible,
  formLoading,
  formData,
  handlerOptions,
  handlerLoading,
  onGroupChange,
  openCreate,
  openEdit,
  openFromUnmapped,
  submitForm,
  removeMapping,
  reapplying,
  reapply,
  init,
} = useMappings()

const matchTypeOptions = tagOptions(MATCH_TYPE)

onMounted(init)
</script>

<template>
  <div class="p-4">
    <ListPage :aside-width="480" aside-resizable :aside-max-width="720">
      <template #filter>
        <div class="filter-row">
          <a-input v-model="query.keyword" placeholder="匹配值" allow-clear style="width: 200px" @press-enter="search" />
          <a-select
            v-model="query.match_type"
            :options="matchTypeOptions"
            placeholder="匹配方式"
            allow-clear
            style="width: 140px"
            @change="search"
          />
          <a-select
            v-model="query.project_group_id"
            :options="projectGroups"
            placeholder="项目组"
            allow-clear
            allow-search
            style="width: 200px"
            @change="search"
          />
          <a-button type="primary" size="small" @click="search">
            查询
          </a-button>
        </div>
      </template>

      <template #aside>
        <UnmappedTable :data="unmapped" :loading="unmappedLoading" @create="openFromUnmapped" @refresh="loadUnmapped" />
      </template>

      <template #toolbar>
        <a-button type="primary" size="small" @click="openCreate">
          新增映射
        </a-button>
        <a-button size="small" :loading="reapplying" @click="reapply">
          重新归属
        </a-button>
        <span class="muted">匹配顺序：领域精确 → 领域前缀 → 调用类包前缀；人工归类的问题不受映射影响</span>
      </template>

      <template #default="{ tableHeight }">
        <a-table
          :data="dataList"
          :loading="loading"
          :pagination="pagination"
          row-key="id"
          :scroll="{ minWidth: 960, y: tableHeight }"
          @page-change="onPageChange"
          @page-size-change="onPageSizeChange"
        >
          <template #columns>
            <a-table-column title="匹配方式" data-index="match_type" :width="120">
              <template #cell="{ record }">
                <a-tag :color="tagMeta(MATCH_TYPE, record.match_type).color" size="small">
                  {{ tagMeta(MATCH_TYPE, record.match_type).label }}
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column title="匹配值" data-index="pattern" :width="180" ellipsis tooltip />
            <a-table-column title="项目组" data-index="project_group_name" :width="160" ellipsis tooltip />
            <a-table-column title="默认处理人" data-index="default_handler_name" :width="110" ellipsis tooltip />
            <a-table-column title="优先级" data-index="priority" :width="80" />
            <a-table-column title="状态" data-index="status" :width="80">
              <template #cell="{ record }">
                <a-tag :color="enabledMeta(record.status).color" size="small">
                  {{ enabledMeta(record.status).label }}
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column title="更新时间" data-index="updated_at" :width="170">
              <template #cell="{ record }">
                {{ formatTime(record.updated_at) }}
              </template>
            </a-table-column>
            <a-table-column title="操作" :width="140" fixed="right">
              <template #cell="{ record }">
                <a-space size="mini">
                  <a-button size="mini" type="primary" @click="openEdit(record)">
                    编辑
                  </a-button>
                  <a-button size="mini" status="danger" @click="removeMapping(record)">
                    删除
                  </a-button>
                </a-space>
              </template>
            </a-table-column>
          </template>
        </a-table>
      </template>
    </ListPage>

    <MappingFormModal
      v-model:visible="formVisible"
      v-model:form="formData"
      :loading="formLoading"
      :project-groups="projectGroups"
      :handler-options="handlerOptions"
      :handler-loading="handlerLoading"
      :submit="submitForm"
      @group-change="onGroupChange"
    />
  </div>
</template>

<style scoped>
.filter-row { display: flex; align-items: center; gap: 12px; }
.muted { color: var(--color-text-3); font-size: 12px; }
</style>
