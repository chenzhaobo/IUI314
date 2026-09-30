<script lang="ts" setup>
/**
 * 指标模板页：按服务类型分组的模板列表 + 行内启用开关 + 编辑 / 新增弹窗。
 *
 * 菜单由后端迁移登记（component `perf/metric-template`），组件名必须与路由 name 逐字一致。
 */
import { onMounted } from 'vue'
import ListPage from '@/components/common/ListPage.vue'
import TemplateEditModal from './metric-template/TemplateEditModal.vue'
import { aggText, isBuiltin, promPurposeText, SERVICE_TYPE_OPTIONS, serviceTypeText } from './metric-template/types'
import { useMetricTemplate } from './metric-template/useMetricTemplate'

// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'metric-template' })

const {
  loading,
  typeFilter,
  keyword,
  tableRows,
  load,
  modalVisible,
  modalMode,
  submitting,
  form,
  openEdit,
  openAdd,
  submit,
  togglingId,
  toggleEnabled,
  removeTemplate,
} = useMetricTemplate()

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="p-4">
    <ListPage>
      <template #filter>
        <a-space wrap>
          <a-select
            v-model="typeFilter"
            :options="SERVICE_TYPE_OPTIONS"
            placeholder="按服务类型筛选"
            allow-clear
            class="mt-sel"
          />
          <a-input-search
            v-model="keyword"
            placeholder="搜索显示名 / metric_key"
            allow-clear
            class="mt-search"
          />
          <a-button type="primary" @click="openAdd">
            新增自定义模板
          </a-button>
        </a-space>
      </template>

      <template #toolbar>
        <span class="mt-hint">
          内置模板只可停用、不可删除；PromQL 里的占位符在回查时按绑定目标替换。
        </span>
      </template>

      <template #default="{ tableHeight }">
        <a-table
          column-resizable
          :data="tableRows"
          :loading="loading"
          :pagination="false"
          row-key="id"
          :scroll="{ minWidth: 1560, y: tableHeight }"
        >
          <template #columns>
            <a-table-column title="服务类型" :width="110" fixed="left">
              <template #cell="{ record }">
                <a-tag v-if="record.groupStart" color="arcoblue" size="small">
                  {{ serviceTypeText(record.service_type) }}
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column title="指标 key" data-index="metric_key" :width="170" />
            <a-table-column title="显示名" data-index="display_name" :width="170" />
            <a-table-column title="单位" data-index="unit" :width="70" />
            <a-table-column title="口径" :width="80">
              <template #cell="{ record }">
                {{ aggText(record.agg) }}
              </template>
            </a-table-column>
            <a-table-column title="数据源" :width="150">
              <template #cell="{ record }">
                {{ promPurposeText(record.prom_purpose) }}
              </template>
            </a-table-column>
            <a-table-column title="PromQL 模板" :width="320">
              <template #cell="{ record }">
                <a-tooltip :content="record.promql_tpl" position="top">
                  <span class="mt-ellipsis">{{ record.promql_tpl }}</span>
                </a-tooltip>
              </template>
            </a-table-column>
            <a-table-column title="来源" :width="90">
              <template #cell="{ record }">
                <a-tag :color="isBuiltin(record) ? 'blue' : 'orange'" size="small">
                  {{ isBuiltin(record) ? '内置' : '自定义' }}
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column title="启用" :width="80">
              <template #cell="{ record }">
                <a-switch
                  :model-value="record.enabled"
                  size="small"
                  :loading="togglingId === record.id"
                  @change="(v: boolean | string | number) => toggleEnabled(record, !!v)"
                />
              </template>
            </a-table-column>
            <a-table-column title="排序" data-index="sort" :width="70" />
            <a-table-column title="备注" :width="220">
              <template #cell="{ record }">
                <a-tooltip :content="record.remark || '—'" position="top">
                  <span class="mt-ellipsis">{{ record.remark || '—' }}</span>
                </a-tooltip>
              </template>
            </a-table-column>
            <a-table-column title="操作" :width="130" fixed="right">
              <template #cell="{ record }">
                <a-space>
                  <a-button type="text" size="small" @click="openEdit(record)">
                    编辑
                  </a-button>
                  <a-button
                    type="text"
                    size="small"
                    status="danger"
                    :disabled="isBuiltin(record)"
                    @click="removeTemplate(record)"
                  >
                    删除
                  </a-button>
                </a-space>
              </template>
            </a-table-column>
          </template>
        </a-table>
      </template>
    </ListPage>

    <TemplateEditModal
      v-model:visible="modalVisible"
      v-model:form="form"
      :mode="modalMode"
      :submitting="submitting"
      @submit="submit"
    />
  </div>
</template>

<style scoped>
.mt-sel {
  width: 200px;
}

.mt-search {
  width: 240px;
}

.mt-hint {
  color: var(--color-text-3);
  font-size: 12px;
}

.mt-ellipsis {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
