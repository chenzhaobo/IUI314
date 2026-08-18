<script lang="ts" setup>
import { ref, computed } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useRouter } from 'vue-router'
import { useGet, usePost } from '@/hooks'
import { ApiPerfComparison, ApiPerfIteration, ApiPerfApp, ApiPerfModule, ApiSecProjectGroup, ApiSysDictData } from '@/api/apis'

defineOptions({ name: 'comparison-create' })

const router = useRouter()

// ── 迭代列表 ──────────────────────────────────
const { data: iterData } = useGet<any>(ApiPerfIteration.getList, { page_num: 1, page_size: 200 }, { immediate: true })
const iterOptions = computed(() => iterData.value?.list?.map((i: any) => ({ label: `${i.name} (${i.code || i.build_no || ''})`, value: i.id })) || [])

// ── 产品领域字典 ──────────────────────────────────
const { data: domainDictRaw } = useGet<any>(ApiSysDictData.getByType, { dict_type: 'sec_pg_product_domain' }, { immediate: true })
const domainOptions = computed(() => (Array.isArray(domainDictRaw.value) ? domainDictRaw.value : []).map((d: any) => ({ label: d.dict_label, value: d.dict_value })))

// ── 业务领域字典 ──────────────────────────────────
const { data: bizDomainDictRaw } = useGet<any>(ApiSysDictData.getByType, { dict_type: 'sec_pg_business_area' }, { immediate: true })
const bizDomainOptions = computed(() => (Array.isArray(bizDomainDictRaw.value) ? bizDomainDictRaw.value : []).map((d: any) => ({ label: d.dict_label, value: d.dict_value })))

// ── 云选项 ──────────────────────────────────
const { data: cloudRaw } = useGet<string[]>(ApiPerfModule.cloudOptions, {}, { immediate: true })
const cloudOptions = computed(() => (Array.isArray(cloudRaw.value) ? cloudRaw.value : []).map((c: string) => ({ label: c, value: c })))

// ── 应用列表 ──────────────────────────────────
const { data: appRaw } = useGet<any>(ApiPerfApp.getList, {}, { immediate: true })
const appOptions = computed(() => {
  const list = Array.isArray(appRaw.value) ? appRaw.value : []
  return list.map((a: any) => ({ label: a.app_name, value: a.app_number }))
})

// ── 项目组列表 ──────────────────────────────────
const { data: pgRawData } = useGet<any>(ApiSecProjectGroup.getAll, {}, { immediate: true })
const projectGroupOptions = computed(() => {
  const list = Array.isArray(pgRawData.value) ? pgRawData.value : []
  return list.map((pg: any) => ({ label: pg.name, value: pg.id }))
})

// ── 比对表单 ──────────────────────────────────
const compareForm = ref({
  baseline_iteration_id: '',
  current_iteration_id: '',
  domain_code: '',
  business_domain: '',
  cloud: '',
  app_code: '',
  project_group_id: '',
})

const comparing = ref(false)
const { execute: doCompare, data: compareData } = usePost<any>(ApiPerfComparison.compare, compareForm)

async function handleSubmit() {
  if (!compareForm.value.baseline_iteration_id) {
    Message.warning('请选择基线迭代')
    return
  }
  if (!compareForm.value.current_iteration_id) {
    Message.warning('请选择当前迭代')
    return
  }
  if (compareForm.value.baseline_iteration_id === compareForm.value.current_iteration_id) {
    Message.warning('基线迭代和当前迭代不能相同')
    return
  }
  comparing.value = true
  try {
    await doCompare()
    const data = compareData.value
    if (data) {
      Message.success(`比对完成：共 ${data.txn_rows?.length || 0} 个事务，劣化 ${data.txn_regression_count}，改善 ${data.txn_improvement_count}`)
      // 跳转到详情页
      router.push({ path: '/perf/report-group/comparison-report/detail', query: { id: data.comparison_id } })
    } else {
      Message.warning('比对结果为空')
    }
  } catch (e: any) {
    Message.error('比对失败: ' + (e?.message || e))
  } finally {
    comparing.value = false
  }
}

function handleCancel() {
  router.back()
}
</script>

<template>
  <div class="page-container">
    <a-card :bordered="false" title="新增比对任务">
      <a-form :model="compareForm" layout="vertical">
        <a-divider orientation="left">维度筛选（可选，不选则比对全部）</a-divider>
        <a-row :gutter="16">
          <a-col :span="6">
            <a-form-item label="产品领域">
              <a-select v-model="compareForm.domain_code" :options="domainOptions" placeholder="选择产品领域" allow-search allow-clear />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="业务领域">
              <a-select v-model="compareForm.business_domain" :options="bizDomainOptions" placeholder="选择业务领域" allow-search allow-clear />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="云">
              <a-select v-model="compareForm.cloud" :options="cloudOptions" placeholder="选择云" allow-search allow-clear />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="应用">
              <a-select v-model="compareForm.app_code" :options="appOptions" placeholder="选择应用" allow-search allow-clear />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="6">
            <a-form-item label="项目组">
              <a-select v-model="compareForm.project_group_id" :options="projectGroupOptions" placeholder="选择项目组" allow-search allow-clear />
            </a-form-item>
          </a-col>
        </a-row>

        <a-divider orientation="left">迭代选择</a-divider>
        <a-row :gutter="16">
          <a-col :span="10">
            <a-form-item label="基线迭代（历史版本）" required>
              <a-select v-model="compareForm.baseline_iteration_id" :options="iterOptions" placeholder="选择基线迭代" allow-search allow-clear />
            </a-form-item>
          </a-col>
          <a-col :span="10">
            <a-form-item label="当前迭代（最新版本）" required>
              <a-select v-model="compareForm.current_iteration_id" :options="iterOptions" placeholder="选择当前迭代" allow-search allow-clear />
            </a-form-item>
          </a-col>
          <a-col :span="4">
            <a-form-item label="&nbsp;">
              <a-button type="primary" :loading="comparing" @click="handleSubmit" long>生成比对报告</a-button>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>

      <a-divider />
      <a-space>
        <a-button @click="handleCancel">返回</a-button>
      </a-space>
    </a-card>
  </div>
</template>
