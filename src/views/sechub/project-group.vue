<script lang="ts" setup>
import { computed, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import SecCrudPage from './components/SecCrudPage.vue'
import { useGet, postAction, putAction, withTableDefaults } from '@/hooks'
import { ApiSecProjectGroup, ApiSysDictData } from '@/api/apis'

defineOptions({ name: 'project-group' })

// ── 数据字典：产品领域 / 业务领域 ──────────────────────
const { data: domainDict } = useGet<any>(ApiSysDictData.getByType, { dict_type: 'sec_pg_product_domain' }, { immediate: true })
const { data: areaDict } = useGet<any>(ApiSysDictData.getByType, { dict_type: 'sec_pg_business_area' }, { immediate: true })

const domainOptions = computed(() => (Array.isArray(domainDict.value) ? domainDict.value : []).map((d: any) => ({ label: d.dict_label, value: d.dict_value })))
const areaOptions = computed(() => (Array.isArray(areaDict.value) ? areaDict.value : []).map((d: any) => ({ label: d.dict_label, value: d.dict_value })))

// ── 项目组人员分录 ──────────────────────────────────
interface MemberRow {
  _key: number
  user_id: string
  business_role_codes: string[]
  remark?: string
}

const { data: memberRoleDict } = useGet<any>(ApiSysDictData.getByType, { dict_type: 'static_scan_business_role' }, { immediate: true })
const { data: memberCandidateData } = useGet<any[]>(ApiSecProjectGroup.memberCandidates, {}, { immediate: true })
const memberRoleOptions = computed(() => (Array.isArray(memberRoleDict.value) ? memberRoleDict.value : []).map((d: any) => ({ label: d.dict_label, value: d.dict_value })))
const memberCandidateOptions = computed(() => (Array.isArray(memberCandidateData.value) ? memberCandidateData.value : []).map((user: any) => ({
  label: `${user.user_nickname}（${user.user_name}）`,
  value: user.user_id,
})))

const memberLoading = ref(false)
const memberRows = ref<MemberRow[]>([])
const memberQuery = ref({ id: '' })
const { data: memberData, execute: fetchMembers } = useGet<any[]>(ApiSecProjectGroup.members, memberQuery, { immediate: false })
let memberRowKey = 0

async function loadMembersForEdit(record: any) {
  memberQuery.value.id = record.id
  memberLoading.value = true
  try {
    await fetchMembers()
    memberRows.value = (Array.isArray(memberData.value) ? memberData.value : []).map((member: any) => ({
      _key: ++memberRowKey,
      user_id: member.user_id,
      business_role_codes: Array.isArray(member.business_role_codes) ? [...member.business_role_codes] : [],
      remark: member.remark || '',
    }))
  }
  finally {
    memberLoading.value = false
  }
}

function addMemberRow() {
  memberRows.value.push({ _key: ++memberRowKey, user_id: '', business_role_codes: [], remark: '' })
}

function removeMemberRow(index: number) {
  memberRows.value.splice(index, 1)
}

function candidateDisabled(userId: string, rowKey: number) {
  return memberRows.value.some(row => row._key !== rowKey && row.user_id === userId)
}

async function saveMembersAfterProjectSubmit(formData: Record<string, any>, isEdit: boolean) {
  if (!isEdit)
    return true
  if (memberRows.value.some(row => !row.user_id)) {
    Message.warning('请选择人员')
    return false
  }
  if (memberRows.value.some(row => !row.business_role_codes.length)) {
    Message.warning('每位人员至少选择一个角色')
    return false
  }
  if (new Set(memberRows.value.map(row => row.user_id)).size !== memberRows.value.length) {
    Message.warning('同一人员不能重复添加')
    return false
  }

  const res = await putAction(ApiSecProjectGroup.members, {
    project_group_id: formData.id,
    members: memberRows.value.map(row => ({
      user_id: row.user_id,
      business_role_codes: row.business_role_codes,
      remark: row.remark || null,
    })),
  })
  return Boolean(res)
}

const columns = withTableDefaults([
  { title: '名称', dataIndex: 'name', width: 160 },
  { title: '代码', dataIndex: 'code', width: 120 },
  { title: '产品领域', dataIndex: 'product_group_name', width: 120 },
  { title: 'Scrum团队', dataIndex: 'scrum_team_name', width: 120 },
  { title: '云名称', dataIndex: 'cloud_name', width: 100 },
  { title: '业务领域', dataIndex: 'business_area', width: 100 },
  { title: '排序', dataIndex: 'order_num', width: 60 },
  { title: '状态', dataIndex: 'status', width: 60 },
  { title: '操作', dataIndex: 'operations', slotName: 'operations', width: 120, fixed: 'right' as const },
])

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

const TEMPLATE_HEADERS = ['编码', '名称', '产品领域', 'Scrum团队', '云名称', '业务领域', '云之家群ID', '联系邮箱', '排序', '状态', '备注']
const TEMPLATE_KEYS = ['code', 'name', 'product_group_name', 'scrum_team_name', 'cloud_name', 'business_area', 'yzj_group_id', 'contact_emails', 'order_num', 'status', 'remark']

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
    const res = await postAction<any>(ApiSecProjectGroup.batchImport, items)
    if (!res) return
    importResult.value = res
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
<div>
    <SecCrudPage
      :key="crudKey"
      title="项目组"
      :api-list="ApiSecProjectGroup.getList"
      :api-add="ApiSecProjectGroup.add"
      :api-edit="ApiSecProjectGroup.edit"
      :api-delete="ApiSecProjectGroup.delete"
      :columns="columns"
      :fields="fields"
      :filters="filters"
      :modal-width="960"
      :on-edit-open="loadMembersForEdit"
      :after-submit="saveMembersAfterProjectSubmit"
      id-field="id"
      name-field="name"
    >
      <template #form-extra="{ isEdit }">
        <a-col v-if="isEdit" :span="24">
          <a-divider orientation="left">项目组人员</a-divider>
          <a-spin :loading="memberLoading" style="width: 100%">
            <div style="margin-bottom: 12px">
              <a-button type="primary" size="small" @click="addMemberRow">
                <template #icon><icon-plus /></template>
                增加人员
              </a-button>
            </div>
            <a-table :data="memberRows" :pagination="false" row-key="_key" :scroll="{ y: 320 }">
              <a-table-column title="人员" :width="240">
                <template #cell="{ record }">
                  <a-select v-model="record.user_id" placeholder="选择扫描登录用户" allow-search>
                    <a-option
                      v-for="option in memberCandidateOptions"
                      :key="option.value"
                      :value="option.value"
                      :disabled="candidateDisabled(option.value, record._key)"
                    >
                      {{ option.label }}
                    </a-option>
                  </a-select>
                </template>
              </a-table-column>
              <a-table-column title="角色" :width="300">
                <template #cell="{ record }">
                  <a-select v-model="record.business_role_codes" multiple placeholder="可选择多个角色">
                    <a-option v-for="option in memberRoleOptions" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </a-option>
                  </a-select>
                </template>
              </a-table-column>
              <a-table-column title="备注">
                <template #cell="{ record }">
                  <a-input v-model="record.remark" placeholder="可选" />
                </template>
              </a-table-column>
              <a-table-column title="操作" :width="80">
                <template #cell="{ rowIndex }">
                  <a-button type="text" status="danger" size="small" @click="removeMemberRow(rowIndex)">
                    删除
                  </a-button>
                </template>
              </a-table-column>
            </a-table>
          </a-spin>
        </a-col>
      </template>
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
        <a-descriptions :column="2" layout="inline-horizontal" bordered size="small">
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
  </div>
</template>
