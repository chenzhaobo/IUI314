<script setup lang="ts">
/**
 * 接口测试结果详情（按接口表格的「详情」）。
 *
 * GET /sechub/test-results/apis/detail?api_path&http_method&env_id
 *   → { api, cases[<最近 5 次结果>], open_defects }
 * 用例行可展开看最近 5 次执行；未关闭缺陷按编号跳到发版缺陷页。
 */
import type { TableColumnData } from '@arco-design/web-vue'
import type { ApiResultDetailQuery, ApiResultDetailResponse } from '@/types/sechub-test-results'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { defectLink, testStatusMeta, verdictColor } from '../composables/testResultsRules'
import { fetchApiResultDetail } from '../services/testResultsService'
import { TEST_ROLE_LABELS } from './apiTestShared'
import CaseHistoryTable from './CaseHistoryTable.vue'

const props = defineProps<{ target: ApiResultDetailQuery | null }>()
const visible = defineModel<boolean>('visible', { default: false })
const router = useRouter()

const loading = ref(false)
const detail = ref<ApiResultDetailResponse | null>(null)

const api = computed(() => detail.value?.api ?? null)
const cases = computed(() => detail.value?.cases ?? [])
const defects = computed(() => detail.value?.open_defects ?? [])
const title = computed(() => api.value?.api_path || props.target?.api_path || '接口详情')
const method = computed(() => api.value?.http_method || props.target?.http_method || '')
const statusMeta = computed(() => testStatusMeta(api.value?.test_status))

const columns: TableColumnData[] = [
  { title: '用例编号', slotName: 'caseCode', width: 140 },
  { title: '标题', dataIndex: 'title', ellipsis: true, tooltip: true },
  { title: '测试类型', slotName: 'testType', width: 130 },
  { title: '角色', slotName: 'role', width: 110 },
  { title: '最新判定', slotName: 'latest', width: 100 },
]

function caseCodeText(record: { case_code?: string | null, id?: string }): string {
  return record.case_code || (record.id ? String(record.id).slice(-8) : '--')
}

function roleText(role?: string | null): string {
  if (!role)
    return '--'
  return TEST_ROLE_LABELS[role] || role
}

async function load() {
  const target = props.target
  if (!target)
    return
  loading.value = true
  try {
    detail.value = await fetchApiResultDetail({
      api_path: target.api_path,
      http_method: target.http_method || undefined,
      env_id: target.env_id || undefined,
    })
  }
  finally {
    loading.value = false
  }
}

watch(
  () => [visible.value, props.target] as const,
  () => {
    if (visible.value && props.target)
      void load()
  },
  { immediate: true },
)

function openDefect(code: string) {
  router.push(defectLink(code))
}
</script>

<template>
  <a-drawer
    v-model:visible="visible"
    :width="980"
    :footer="false"
    title="接口测试结果详情"
    unmount-on-close
  >
    <a-spin :loading="loading" style="display: block">
      <template v-if="api || detail">
        <a-descriptions :column="3" bordered size="small" class="detail-head">
          <a-descriptions-item label="接口" :span="3">
            <a-tag v-if="method" size="small" color="arcoblue">
              {{ method }}
            </a-tag>
            <span class="mono">{{ title }}</span>
          </a-descriptions-item>
          <a-descriptions-item label="应用">
            {{ api?.app_name || api?.app_number || '--' }}
          </a-descriptions-item>
          <a-descriptions-item label="项目组">
            {{ api?.project_group_code || '--' }}
          </a-descriptions-item>
          <a-descriptions-item label="产品领域">
            {{ api?.product_domain || '--' }}
          </a-descriptions-item>
          <a-descriptions-item label="业务领域">
            {{ api?.business_area || '--' }}
          </a-descriptions-item>
          <a-descriptions-item label="测试状态">
            <a-tag :color="statusMeta.color" size="small">
              {{ statusMeta.label }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="用例统计">
            总 {{ api?.case_total ?? cases.length }} / 通过 {{ api?.case_passed ?? 0 }} / 失败 {{ api?.case_failed ?? 0 }}
          </a-descriptions-item>
        </a-descriptions>

        <div class="section-title">
          用例（{{ cases.length }}）
        </div>
        <a-table
          :data="cases"
          :columns="columns"
          :pagination="false"
          :expandable="{ width: 36 }"
          row-key="id"
          size="small"
        >
          <template #caseCode="{ record }">
            {{ caseCodeText(record) }}
          </template>
          <template #testType="{ record }">
            <a-tag size="small">
              {{ record.test_type_label || record.test_type_code || '--' }}
            </a-tag>
          </template>
          <template #role="{ record }">
            {{ roleText(record.test_role) }}
          </template>
          <template #latest="{ record }">
            <a-tag v-if="record.latest_verdict" :color="verdictColor(record.latest_verdict)" size="small">
              {{ record.latest_verdict }}
            </a-tag>
            <span v-else class="muted">未测</span>
          </template>
          <template #expand-row="{ record }">
            <CaseHistoryTable :results="record.results || []" />
          </template>
          <template #empty>
            <a-empty description="该接口没有有效用例（可能还在评审中或已禁用）" />
          </template>
        </a-table>

        <div class="section-title">
          未关闭缺陷（{{ defects.length }}）
        </div>
        <a-empty v-if="!defects.length" description="没有关联的未关闭缺陷" />
        <a-table
          v-else
          :data="defects"
          :pagination="false"
          row-key="id"
          size="small"
        >
          <template #columns>
            <a-table-column title="编号" :width="160">
              <template #cell="{ record }">
                <a-link @click="openDefect(record.defect_code)">
                  {{ record.defect_code }}
                </a-link>
              </template>
            </a-table-column>
            <a-table-column title="标题" data-index="defect_title" ellipsis tooltip />
            <a-table-column title="状态" :width="110">
              <template #cell="{ record }">
                {{ record.defect_status || '--' }}
              </template>
            </a-table-column>
            <a-table-column title="级别" :width="90">
              <template #cell="{ record }">
                {{ record.priority || '--' }}
              </template>
            </a-table-column>
          </template>
        </a-table>
      </template>
      <a-empty v-else description="没有取到该接口的结果明细" />
    </a-spin>
  </a-drawer>
</template>

<style scoped>
.detail-head {
  margin-bottom: 12px;
}

.section-title {
  margin: 12px 0 8px;
  color: var(--color-text-1);
  font-weight: 600;
}

.mono {
  word-break: break-all;
}

.muted {
  color: var(--color-text-3);
}
</style>
