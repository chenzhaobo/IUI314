<script lang="ts" setup>
import { computed, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import SecCrudPage from './components/SecCrudPage.vue'
import { useGet, usePost } from '@/hooks'
import { ApiSecProjectGroup, ApiSysDictData } from '@/api/apis'

defineOptions({ name: 'SecProjectGroup' })

// ── 数据字典：产品领域 / 业务领域 ──────────────────────
const { data: domainDict } = useGet<any>(ApiSysDictData.getByType, { dict_type: 'sec_pg_product_domain' }, { immediate: true })
const { data: areaDict } = useGet<any>(ApiSysDictData.getByType, { dict_type: 'sec_pg_business_area' }, { immediate: true })

const domainOptions = computed(() => (Array.isArray(domainDict.value) ? domainDict.value : []).map((d: any) => ({ label: d.dict_label, value: d.dict_value })))
const areaOptions = computed(() => (Array.isArray(areaDict.value) ? areaDict.value : []).map((d: any) => ({ label: d.dict_label, value: d.dict_value })))

const columns = [
  { title: '名称', dataIndex: 'name', width: 160, ellipsis: true, tooltip: true },
  { title: '代码', dataIndex: 'code', width: 120 },
  { title: '产品领域', dataIndex: 'product_group_name', width: 120 },
  { title: 'Scrum团队', dataIndex: 'scrum_team_name', width: 120 },
  { title: '云名称', dataIndex: 'cloud_name', width: 100 },
  { title: '业务领域', dataIndex: 'business_area', width: 100 },
  { title: '安全SE', dataIndex: 'security_se', width: 100 },
  { title: '产品总监', dataIndex: 'product_director', width: 100 },
  { title: '开发总监', dataIndex: 'dev_director', width: 100 },
  { title: '领域架构师', dataIndex: 'domain_architect', width: 100 },
  { title: '排序', dataIndex: 'order_num', width: 60 },
  { title: '状态', dataIndex: 'status', width: 60 },
  { title: '操作', dataIndex: 'operations', slotName: 'operations', width: 120, fixed: 'right' as const },
]

const filters = computed(() => [
  { label: '产品领域', field: 'product_group_name', type: 'select' as const, options: domainOptions.value, placeholder: '选择产品领域' },
  { label: '业务领域', field: 'business_area', type: 'select' as const, options: areaOptions.value, placeholder: '选择业务领域' },
])

const fields = computed(() => [
  { label: '名称', field: 'name', required: true },
  { label: '代码', field: 'code', required: true },
  { label: '产品领域', field: 'product_group_name', type: 'select' as const, options: domainOptions.value },
  { label: 'Scrum团队', field: 'scrum_team_name' },
  { label: '云名称', field: 'cloud_name' },
  { label: '业务领域', field: 'business_area', type: 'select' as const, options: areaOptions.value },
  { label: '安全SE', field: 'security_se' },
  { label: '产品总监', field: 'product_director' },
  { label: '开发总监', field: 'dev_director' },
  { label: '领域架构师', field: 'domain_architect' },
  { label: '云之家群ID', field: 'yzj_group_id' },
  { label: '联系邮箱', field: 'contact_emails', span: 24 },
  { label: '排序', field: 'order_num', type: 'number' as const },
  { label: '状态', field: 'status', type: 'select' as const, options: [{ label: '启用', value: '1' }, { label: '禁用', value: '0' }] },
  { label: '备注', field: 'remark', type: 'textarea' as const, span: 24 },
])

// ── 批量导入 ──────────────────────────────────────
const importVisible = ref(false)
const importLoading = ref(false)
const importResult = ref<any>(null)
const importResultVisible = ref(false)
const crudKey = ref(0)
const importFile = ref<File | null>(null)

const TEMPLATE_HEADERS = ['编码', '名称', '产品领域', 'Scrum团队', '云名称', '业务领域', '安全SE', '产品总监', '开发总监', '领域架构师', '云之家群ID', '联系邮箱', '排序', '状态', '备注']
const TEMPLATE_KEYS = ['code', 'name', 'product_group_name', 'scrum_team_name', 'cloud_name', 'business_area', 'security_se', 'product_director', 'dev_director', 'domain_architect', 'yzj_group_id', 'contact_emails', 'order_num', 'status', 'remark']

function handleDownloadTemplate() {
  const header = TEMPLATE_HEADERS.join(',')
  const content = '\uFEFF' + header + '\n'
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = '项目组导入模板.csv'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function parseCsv(text: string): any[] {
  // 去除 BOM 头，统一换行符
  const cleanText = text.replace(/^\uFEFF/, '')
  const lines = cleanText.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  // 解析表头
  const headers = lines[0].split(',').map(h => h.trim())
  // 建立 header → key 映射
  const colMap: number[] = []
  headers.forEach((h, i) => {
    const idx = TEMPLATE_HEADERS.indexOf(h)
    colMap.push(idx >= 0 ? idx : -1)
  })
  const results: any[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim())
    const obj: any = {}
    colMap.forEach((keyIdx, colIdx) => {
      if (keyIdx >= 0 && colIdx < cols.length) {
        const val = cols[colIdx]
        const key = TEMPLATE_KEYS[keyIdx]
        if (key === 'order_num') {
          obj[key] = val ? parseInt(val, 10) || 0 : 0
        } else {
          obj[key] = val || undefined
        }
      }
    })
    if (obj.code && obj.name) {
      results.push(obj)
    }
  }
  return results
}

function handleImportFileChange(fileList: any[]) {
  importFile.value = (fileList[0]?.file || fileList[0]) as File | null
}

function openImportModal() {
  importFile.value = null
  importVisible.value = true
}

async function handleImportSubmit() {
  if (!importFile.value) { Message.warning('请先选择CSV文件'); return }
  if (!importFile.value.name.endsWith('.csv')) {
    Message.warning('请选择 .csv 文件')
    return
  }
  importLoading.value = true
  try {
    const text = await importFile.value.text()
    const items = parseCsv(text)
    if (items.length === 0) { Message.warning('未解析到有效数据，请检查文件格式'); return }
    const { execute, data, error } = usePost<any>(ApiSecProjectGroup.batchImport, items)
    await execute()
    if (error.value) { Message.error('导入失败'); return }
    importResult.value = data.value
    importVisible.value = false
    importResultVisible.value = true
    crudKey.value++ // 刷新列表
  } catch (e) {
    Message.error('导入失败')
  } finally {
    importLoading.value = false
  }
}
</script>
<template>
  <SecCrudPage :key="crudKey" title="项目组" :api-list="ApiSecProjectGroup.getList" :api-add="ApiSecProjectGroup.add" :api-edit="ApiSecProjectGroup.edit" :api-delete="ApiSecProjectGroup.delete" :columns="columns" :fields="fields" :filters="filters" id-field="id" name-field="name">
    <template #extra-actions>
      <a-button type="primary" status="normal" @click="openImportModal">
        <template #icon><icon-upload /></template>
        导入
      </a-button>
      <a-button type="text" @click="handleDownloadTemplate">
        <template #icon><icon-download /></template>
        下载模板
      </a-button>
    </template>
  </SecCrudPage>

  <a-modal v-model:visible="importVisible" title="导入项目组" @ok="handleImportSubmit" :ok-loading="importLoading" :width="460">
    <a-alert type="info" :show-icon="true" style="margin-bottom: 12px">
      请先下载模板，按模板格式填写后上传。编码重复的将更新，不会覆盖已有的产品领域和业务领域。
    </a-alert>
    <a-upload :auto-upload="false" :limit="1" accept=".csv" :show-file-list="true" @change="handleImportFileChange" />
  </a-modal>

  <a-modal v-model:visible="importResultVisible" title="导入结果" :footer="false" :width="480">
    <a-result v-if="importResult" status="success" title="导入完成">
      <template #extra>
        <a-button type="primary" @click="importResultVisible = false">关闭</a-button>
      </template>
      <a-descriptions :column="2" layout="inline" bordered size="small">
        <a-descriptions-item label="总计">{{ importResult.total ?? 0 }}</a-descriptions-item>
        <a-descriptions-item label="新增">{{ importResult.added ?? 0 }}</a-descriptions-item>
        <a-descriptions-item label="更新">{{ importResult.updated ?? 0 }}</a-descriptions-item>
        <a-descriptions-item label="跳过">{{ importResult.skipped ?? 0 }}</a-descriptions-item>
      </a-descriptions>
      <div v-if="importResult.errors?.length" style="margin-top: 8px">
        <div style="font-weight: 600; margin-bottom: 4px; color: rgb(var(--red-6))">错误（{{ importResult.errors.length }}条）：</div>
        <a-list :data="importResult.errors" size="small" :bordered="true" max-height="200">
          <template #item="{ item }">{{ item }}</template>
        </a-list>
      </div>
    </a-result>
  </a-modal>
</template>
