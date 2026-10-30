<script setup lang="ts">
/**
 * 表单测试结果详情（按表单表格的「详情」）。
 *
 * GET /sechub/test-results/forms/detail?form_number
 *   → { form, cases[<最近 5 次结果>], open_defects }
 * 结构同接口详情；后端目前不给表单关联缺陷，列表为空时只显示占位。
 */
import type { TableColumnData } from '@arco-design/web-vue'
import type { FormResultDetailResponse } from '@/types/sechub-test-results'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { caseTypeLabel, defectLink, verdictColor } from '../composables/testResultsRules'
import { fetchFormResultDetail } from '../services/testResultsService'
import { TEST_ROLE_LABELS } from './apiTestShared'
import CaseHistoryTable from './CaseHistoryTable.vue'

const props = defineProps<{ formNumber: string }>()
const visible = defineModel<boolean>('visible', { default: false })
const router = useRouter()

const loading = ref(false)
const detail = ref<FormResultDetailResponse | null>(null)

const form = computed(() => detail.value?.form ?? null)
const cases = computed(() => detail.value?.cases ?? [])
const defects = computed(() => detail.value?.open_defects ?? [])
const title = computed(() => form.value?.form_number || props.formNumber || '--')
const formName = computed(() => form.value?.form_name || '')

const columns: TableColumnData[] = [
  { title: '用例编号', slotName: 'caseCode', width: 140 },
  { title: '标题', dataIndex: 'title', ellipsis: true, tooltip: true },
  { title: '用例类型', slotName: 'caseType', width: 130 },
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
  if (!props.formNumber)
    return
  loading.value = true
  try {
    detail.value = await fetchFormResultDetail(props.formNumber)
  }
  finally {
    loading.value = false
  }
}

watch(
  () => [visible.value, props.formNumber] as const,
  () => {
    if (visible.value && props.formNumber)
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
    :width="960"
    :footer="false"
    title="表单测试结果详情"
    unmount-on-close
  >
    <a-spin :loading="loading" style="display: block">
      <a-descriptions :column="2" bordered size="small" class="detail-head">
        <a-descriptions-item label="表单编码">
          {{ title }}
        </a-descriptions-item>
        <a-descriptions-item label="表单名称">
          {{ formName || '--' }}
        </a-descriptions-item>
        <a-descriptions-item label="用例数">
          {{ cases.length }}
        </a-descriptions-item>
        <a-descriptions-item label="未关闭缺陷">
          {{ defects.length }}
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
        <template #caseType="{ record }">
          <a-tag size="small">
            {{ caseTypeLabel(record.case_type) }}
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
          <a-empty description="该表单没有有效用例（可能还在评审中或已禁用）" />
        </template>
      </a-table>

      <template v-if="defects.length">
        <div class="section-title">
          未关闭缺陷（{{ defects.length }}）
        </div>
        <a-table :data="defects" :pagination="false" row-key="id" size="small">
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
          </template>
        </a-table>
      </template>
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

.muted {
  color: var(--color-text-3);
}
</style>
