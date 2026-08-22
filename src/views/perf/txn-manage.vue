<script lang="ts" setup>
import { ref, computed, watch, h } from 'vue'
import { Message, type TableColumnData, type TreeNodeData } from '@arco-design/web-vue'
import { useGet, usePost, usePut } from '@/hooks'
import { ApiPerfBenchmark, ApiPerfMenu, ApiSysDictData, ApiSecProjectGroup } from '@/api/apis'
import * as XLSX from 'xlsx'

defineOptions({ name: 'txn-manage' })

// ── 产品线选择（数据字典）──────────────────────────
const productLine = ref('')
const { data: dictRaw } = useGet<any>(ApiSysDictData.getByType, { dict_type: 'perf_product_line' }, { immediate: true })
const productLineOptions = computed(() => (Array.isArray(dictRaw.value) ? dictRaw.value : []).map((d: any) => ({ label: d.dict_label, value: d.dict_value })))

watch(dictRaw, (val) => {
  if (!productLine.value && Array.isArray(val) && val.length > 0) {
    const defaultItem = val.find((d: any) => d.is_default === 'Y')
    productLine.value = defaultItem?.dict_value || val[0]?.dict_value || ''
  }
}, { immediate: true })

// ── 领域选项（产品领域字典 sec_pg_product_domain）──────────────────────────
const { data: domainDictRaw } = useGet<any>(ApiSysDictData.getByType, { dict_type: 'sec_pg_product_domain' }, { immediate: true })
const domainOptions = computed(() => (Array.isArray(domainDictRaw.value) ? domainDictRaw.value : []).map((d: any) => ({ label: d.dict_label, value: d.dict_value })))
const domainResolved = ref(false)
const domainCode = ref('')

// ── 业务领域字典（sec_pg_business_area）──────────────────────────
const { data: bizAreaDictRaw } = useGet<any>(ApiSysDictData.getByType, { dict_type: 'sec_pg_business_area' }, { immediate: true })
const bizAreaOptions = computed(() => {
  const list = Array.isArray(bizAreaDictRaw.value) ? bizAreaDictRaw.value : []
  return list.map((d: any) => ({ label: d.dict_label, value: d.dict_value }))
})

// ── 项目组选项（从 sec_project_group 获取，按领域过滤）──────────────────────────
const { data: pgRawData } = useGet<any>(ApiSecProjectGroup.getAll, {}, { immediate: true })
const projectGroupOptions = computed(() => {
  const all = Array.isArray(pgRawData.value) ? pgRawData.value : []
  const dc = domainCode.value
  const filtered = dc ? all.filter((pg: any) => pg.product_group_name === dc) : all
  return filtered.map((pg: any) => ({ label: pg.name, value: pg.name }))
})
const projectGroupName = ref('')

// ── 事务类型字典 ──────────────────────────────────
const { data: txnTypeDictRaw } = useGet<any>(ApiSysDictData.getByType, { dict_type: 'sys_txn_type' }, { immediate: true })
const txnTypeOptions = computed(() => {
  const list = Array.isArray(txnTypeDictRaw.value) ? txnTypeDictRaw.value : []
  return list.map((d: any) => ({ label: d.dict_label, value: d.dict_value }))
})
const txnTypeMap = computed(() => {
  const map: Record<string, string> = {}
  txnTypeOptions.value.forEach((d: any) => { map[d.value] = d.label })
  return map
})

// ── 达标状态选项 ──────────────────────────────────
const passStatusOptions = [
  { label: '全部', value: '' },
  { label: '达标', value: 'pass' },
  { label: '未达标', value: 'fail' },
  { label: '无执行记录', value: 'no_history' },
]

// ── 列表查询参数 ──────────────────────────────────
const queryParams = ref({
  page_num: 1,
  page_size: 20,
  keyword: '',
  txn_type: '',
  menu_name: '',
  pass_status: '',
  product_line: '',
  domain_code: '',
  project_group_name: '',
  business_area: '',
  menu_ids: '',
  filters: '',
})

const { isFetching: isLoading, data: rawListData, execute: getList } = useGet<any>(
  ApiPerfBenchmark.targetList,
  queryParams,
  { immediate: false },
)
const dataList = computed(() => rawListData.value?.list || [])
const total = computed(() => rawListData.value?.total || 0)

// ── 统计数据 ──────────────────────────────────
const { data: statsData, isFetching: statsLoading, execute: fetchStats } = useGet<any>(ApiPerfBenchmark.txnStats, queryParams, { immediate: false })

// ── 左侧菜单树 ──────────────────────────────────
const treeData = ref<any[]>([])
const selectedKeys = ref<string[]>([])
const selectedMenuName = ref('')

const { data: treeRawData, execute: fetchTree } = useGet<any[]>(
  ApiPerfMenu.tree,
  computed(() => ({
    product_line: productLine.value,
    domain_code: domainCode.value || undefined,
    project_group_name: projectGroupName.value || undefined,
  })),
  { immediate: false },
)

watch(treeRawData, (val) => {
  treeData.value = Array.isArray(val) ? val : []
})

// 领域默认选择
watch(domainDictRaw, (val) => {
  if (domainResolved.value) return
  if (!Array.isArray(val)) return
  domainResolved.value = true
  if (!domainCode.value && val.length > 0) {
    const defaultItem = val.find((d: any) => d.is_default === 'Y')
    if (defaultItem) {
      domainCode.value = defaultItem.dict_value
      return
    }
  }
  if (productLine.value) {
    fetchTree()
    fetchAll()
  }
}, { immediate: true })

watch(productLine, (val) => {
  selectedKeys.value = []
  selectedMenuName.value = ''
  treeData.value = []
  if (val) {
    queryParams.value.product_line = val
    queryParams.value.menu_ids = ''
    queryParams.value.page_num = 1
    if (domainResolved.value) {
      fetchTree()
      fetchAll()
    }
  }
})

// 领域 / 项目组变化联动
let skipPgWatch = false

watch(domainCode, () => {
  if (projectGroupName.value) {
    skipPgWatch = true
    projectGroupName.value = ''
  }
  if (productLine.value && domainResolved.value) {
    selectedKeys.value = []
    selectedMenuName.value = ''
    queryParams.value.menu_ids = ''
    queryParams.value.domain_code = domainCode.value
    queryParams.value.project_group_name = ''
    queryParams.value.page_num = 1
    fetchTree()
    fetchAll()
  }
})

watch(projectGroupName, () => {
  if (skipPgWatch) { skipPgWatch = false; return }
  if (productLine.value && domainResolved.value) {
    selectedKeys.value = []
    selectedMenuName.value = ''
    queryParams.value.menu_ids = ''
    queryParams.value.project_group_name = projectGroupName.value
    queryParams.value.page_num = 1
    fetchTree()
    fetchAll()
  }
})

// ── 树节点选择 ──────────────────────────────────
function findNodeByKey(nodes: any[], key: string): any | null {
  for (const node of nodes) {
    if (node.key === key) return node
    if (node.children) {
      const found = findNodeByKey(node.children, key)
      if (found) return found
    }
  }
  return null
}

function collectMenuIds(node: any): string[] {
  const ids: string[] = []
  const extra = node?.extra
  if (extra?.type === 'menu' && extra?.id) {
    ids.push(extra.id)
  }
  if (node?.children) {
    for (const child of node.children) {
      ids.push(...collectMenuIds(child))
    }
  }
  return ids
}

function handleTreeSelect(keys: (string | number)[], data: { node?: TreeNodeData }) {
  const stringKeys = keys.map(String)
  selectedKeys.value = stringKeys
  queryParams.value.page_num = 1
  if (stringKeys.length === 0) {
    selectedMenuName.value = ''
    queryParams.value.menu_ids = ''
    fetchAll()
    return
  }
  const fullNode = findNodeByKey(treeData.value, stringKeys[0]) || data.node
  selectedMenuName.value = fullNode?.title || ''
  const ids = collectMenuIds(fullNode)
  if (ids.length > 0) {
    queryParams.value.menu_ids = ids.join(',')
  } else {
    queryParams.value.menu_ids = '__none__'
  }
  fetchAll()
}

// ── 查询与分页 ──────────────────────────────────
function fetchAll() {
  getList()
  fetchStats()
}

function handleSearch() {
  queryParams.value.page_num = 1
  fetchAll()
}

function handlePageChange(page: number) {
  queryParams.value.page_num = page
  getList()
}

// ── 编辑弹窗 ──────────────────────────────────
const editVisible = ref(false)
const editForm = ref({
  txn_code: '',
  txn_name: '',
  display_name: '',
  txn_type: '',
  target_value_sec: 0,
})

const targetUpdatePayload = ref({ txn_code: '', target_value_ms: 0 })
const infoUpdatePayload = ref<{ txn_code: string; display_name: string | null; txn_type: string | null }>({ txn_code: '', display_name: null, txn_type: null })
const { execute: doUpdateTarget, isFetching: updatingTarget } = usePut(ApiPerfBenchmark.updateTarget, targetUpdatePayload)
const { execute: doUpdateInfo, isFetching: updatingInfo } = usePut(ApiPerfBenchmark.updateTxnInfo, infoUpdatePayload)

const updating = computed(() => updatingTarget.value || updatingInfo.value)

async function handleSaveEdit() {
  if (!editForm.value.txn_code) {
    Message.warning('事务编码不能为空')
    return
  }
  if (editForm.value.target_value_sec > 0) {
    targetUpdatePayload.value = {
      txn_code: editForm.value.txn_code,
      target_value_ms: editForm.value.target_value_sec * 1000,
    }
    await doUpdateTarget()
  }
  infoUpdatePayload.value = {
    txn_code: editForm.value.txn_code,
    display_name: editForm.value.display_name || null,
    txn_type: editForm.value.txn_type || null,
  }
  await doUpdateInfo()
  Message.success('事务信息已更新')
  editVisible.value = false
  fetchAll()
}

function handleEdit(record: any) {
  editForm.value = {
    txn_code: record.txn_code || '',
    txn_name: record.txn_name || '',
    display_name: record.display_name || '',
    txn_type: record.txn_type || '',
    target_value_sec: record.target_value_ms ? Number((record.target_value_ms / 1000).toFixed(1)) : 0,
  }
  editVisible.value = true
}

// ── 工具函数 ──────────────────────────────────
function fmtSec(ms?: number | null): string {
  if (ms === null || ms === undefined) return '-'
  return (ms / 1000).toFixed(1)
}

function fmtTime(time?: string | null): string {
  if (!time) return '-'
  return time.replace('T', ' ').substring(0, 19)
}

function fmtTxnType(val?: string): string {
  if (!val) return '-'
  return txnTypeMap.value[val] || val
}

function fmtStatus(status?: string): string {
  if (!status) return '-'
  if (status === 'active') return '启用'
  if (status === 'deleted') return '已删除'
  if (status === 'disabled') return '停用'
  return status
}

function statusColor(status?: string): string {
  if (!status) return 'gray'
  if (status === 'active') return 'green'
  if (status === 'deleted') return 'gray'
  return 'red'
}

function fmtPassStatus(val?: string): string {
  if (!val) return '-'
  if (val === 'pass') return '达标'
  if (val === 'fail') return '未达标'
  return val
}

function passStatusColor(val?: string): string {
  if (!val) return 'gray'
  if (val === 'pass') return 'green'
  return 'red'
}

// ── 导入功能 ──────────────────────────────────
const importFileRef = ref<HTMLInputElement | null>(null)
const importing = ref(false)

function handleImportClick() {
  importFileRef.value?.click()
}

function downloadTemplate() {
  const header = ['事务编码', '事务类型', '目标值(秒)', '比对值(秒)', '比对值更新迭代']
  const sample = [
    ['AM00001-打开菜单', 'open_page', '2.0', '1.5', '2026Q1'],
    ['AM00002-保存数据', 'save_data', '3.0', '2.8', '2026Q1'],
  ]
  const ws = XLSX.utils.aoa_to_sheet([header, ...sample])
  ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 20 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '事务导入模板')
  XLSX.writeFile(wb, '事务导入模板.xlsx')
}

async function handleImportFile(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  importing.value = true
  try {
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    const fieldMap: Record<string, string> = {
      '事务编码': 'txn_code',
      '事务类型': 'txn_type',
      '目标值(秒)': 'target_value_sec',
      '比对值(秒)': 'baseline_value_sec',
      '比对值更新迭代': 'baseline_iteration_name',
    }

    const items: any[] = []
    let skipped = 0
    for (const row of rows) {
      const obj: any = {}
      for (const [cn, en] of Object.entries(fieldMap)) {
        const v = row[cn]
        if (v !== undefined && v !== '') {
          obj[en] = String(v).trim()
        }
      }
      if (!obj.txn_code) {
        skipped++
        continue
      }
      // 转换数值字段
      if (obj.target_value_sec) obj.target_value_sec = parseFloat(obj.target_value_sec) || undefined
      if (obj.baseline_value_sec) obj.baseline_value_sec = parseFloat(obj.baseline_value_sec) || undefined
      items.push(obj)
    }

    if (items.length === 0) {
      Message.warning(`没有可导入的数据（跳过 ${skipped} 条事务编码为空的行）`)
      return
    }

    const { execute, error, data: resp } = usePost<any>(ApiPerfBenchmark.importTxn, items)
    await execute()
    if (error.value) {
      Message.error('导入失败')
      return
    }

    const r = resp.value
    const notFound = r?.not_found?.length || 0
    let msg = `导入完成！成功 ${r?.success || 0} 条`
    if (notFound > 0) {
      msg += `，未找到 ${notFound} 条事务编码`
    }
    if (skipped > 0) {
      msg += `，跳过 ${skipped} 条空行`
    }
    Message.success(msg)
    fetchAll()
  } catch (err) {
    Message.error('文件解析失败，请检查格式')
    console.error(err)
  } finally {
    importing.value = false
    if (importFileRef.value) importFileRef.value.value = ''
  }
}

// ── 列过滤 ──────────────────────────────────
const stringOperators = [
  { label: '包含', value: 'contains' },
  { label: '不包含', value: 'not_contains' },
  { label: '等于', value: 'equals' },
  { label: '不等于', value: 'not_equals' },
]
const numericOperators = [
  { label: '大于', value: 'gt' },
  { label: '大于等于', value: 'gte' },
  { label: '小于', value: 'lt' },
  { label: '小于等于', value: 'lte' },
  { label: '等于', value: 'equals' },
  { label: '不等于', value: 'not_equals' },
]
function makeFilterRender(isNumeric: boolean) {
  const operators = isNumeric ? numericOperators : stringOperators
  const defaultAction = isNumeric ? 'gt' : 'contains'
  return ({ filterValue, setFilterValue, handleFilterConfirm, handleFilterReset }: any) => {
    // filterValue 是数组（Arco 内部以数组存储）
    let action = defaultAction
    let value = ''
    if (filterValue && Array.isArray(filterValue) && filterValue.length > 0) {
      try {
        const parsed = JSON.parse(filterValue[0])
        action = parsed.action || action
        value = parsed.value || ''
      } catch {}
    }
    return h('div', { style: 'padding: 8px; display: flex; flex-direction: column; gap: 8px; min-width: 200px;' }, [
      h('select', {
        value: action,
        onChange: (e: Event) => {
          action = (e.target as HTMLSelectElement).value
          setFilterValue([JSON.stringify({ action, value })])
        },
        style: 'width: 100%; height: 28px; border: 1px solid var(--color-border-2); border-radius: 4px; padding: 0 8px; font-size: 13px; outline: none;',
      }, operators.map((op: any) =>
        h('option', { value: op.value, selected: op.value === action }, op.label)
      )),
      h('input', {
        value: value,
        onInput: (e: Event) => {
          value = (e.target as HTMLInputElement).value
          setFilterValue([JSON.stringify({ action, value })])
        },
        placeholder: isNumeric ? '输入数值' : '输入关键字',
        style: 'width: 100%; height: 28px; border: 1px solid var(--color-border-2); border-radius: 4px; padding: 0 8px; font-size: 13px; outline: none; box-sizing: border-box;',
      }),
      h('div', { style: 'display: flex; justify-content: space-between; gap: 8px;' }, [
        h('button', {
          onClick: () => { setFilterValue([]); handleFilterReset() },
          style: 'height: 28px; padding: 0 12px; border: 1px solid var(--color-border-2); border-radius: 4px; background: var(--color-bg-2); cursor: pointer; font-size: 13px;',
        }, '重置'),
        h('button', {
          onClick: handleFilterConfirm,
          style: 'height: 28px; padding: 0 12px; border: none; border-radius: 4px; background: rgb(var(--primary-6)); color: #fff; cursor: pointer; font-size: 13px;',
        }, '确定'),
      ]),
    ])
  }
}
const stringFilterRender = makeFilterRender(false)
const numericFilterRender = makeFilterRender(true)

function handleTableFilterChange(dataIndex: string, filteredValues: string[]) {
  const result: Record<string, { action: string; value: string }> = {}
  // 当前列的过滤值
  if (filteredValues && filteredValues.length > 0) {
    for (const valStr of filteredValues) {
      if (!valStr || valStr === '') continue
      try {
        const parsed = JSON.parse(valStr)
        if (parsed.value && parsed.value !== '') {
          result[dataIndex] = parsed
        }
      } catch {}
    }
  }
  // 保留其他列的过滤值（Arco filterChange 每次只传一列）
  if (Object.keys(result).length === 0) {
    // 当前列被清除了，从现有 filters 中移除该列
    try {
      const existing = JSON.parse(queryParams.value.filters || '{}')
      delete existing[dataIndex]
      if (Object.keys(existing).length > 0) {
        queryParams.value.filters = JSON.stringify(existing)
      } else {
        queryParams.value.filters = ''
      }
    } catch {
      queryParams.value.filters = ''
    }
  } else {
    // 合并到现有 filters
    try {
      const existing = JSON.parse(queryParams.value.filters || '{}')
      existing[dataIndex] = result[dataIndex]
      queryParams.value.filters = JSON.stringify(existing)
    } catch {
      queryParams.value.filters = JSON.stringify(result)
    }
  }
  queryParams.value.page_num = 1
  fetchAll()
}

// 注意：filterable 的 filter 是 arco 的必填字段，但本页筛选走服务端
// （见 handleTableFilterChange），所以这里恒返回 true，不在前端二次过滤。
const columns: TableColumnData[] = [
  { title: '事务编码', dataIndex: 'txn_code', width: 160, ellipsis: true, tooltip: true, fixed: 'left' as const, filterable: { filter: () => true, renderContent: stringFilterRender } },
  { title: '事务全称', dataIndex: 'txn_name', width: 250, ellipsis: true, tooltip: true, filterable: { filter: () => true, renderContent: stringFilterRender } },
  { title: '简明名称', dataIndex: 'display_name', width: 150, ellipsis: true, tooltip: true, filterable: { filter: () => true, renderContent: stringFilterRender } },
  { title: '事务类型', dataIndex: 'txn_type', width: 100, align: 'center' as const, slotName: 'txn_type', filterable: { filter: () => true, renderContent: stringFilterRender } },
  { title: '按钮Key', dataIndex: 'button_key', width: 90, ellipsis: true, tooltip: true, filterable: { filter: () => true, renderContent: stringFilterRender } },
  { title: '菜单', dataIndex: 'menu_name', width: 120, ellipsis: true, tooltip: true, filterable: { filter: () => true, renderContent: stringFilterRender } },
  { title: '项目组', dataIndex: 'project_group_name', width: 110, ellipsis: true, tooltip: true, filterable: { filter: () => true, renderContent: stringFilterRender } },
  { title: '业务领域', dataIndex: 'business_area', width: 90, align: 'center' as const, filterable: { filter: () => true, renderContent: stringFilterRender } },
  { title: '关联脚本', dataIndex: 'script_count', width: 80, align: 'center' as const, slotName: 'script_count', filterable: { filter: () => true, renderContent: numericFilterRender } },
  { title: '目标值(秒)', dataIndex: 'target_value_ms', width: 100, align: 'center' as const, slotName: 'target_value', filterable: { filter: () => true, renderContent: numericFilterRender } },
  { title: '比对值(秒)', dataIndex: 'baseline_value_ms', width: 100, align: 'center' as const, slotName: 'baseline_value', filterable: { filter: () => true, renderContent: numericFilterRender } },
  { title: '最近均值(秒)', dataIndex: 'average_ms', width: 110, align: 'center' as const, slotName: 'average', filterable: { filter: () => true, renderContent: numericFilterRender } },
  { title: '达标', dataIndex: 'pass_status', width: 80, align: 'center' as const, slotName: 'pass_status', filterable: { filter: () => true, renderContent: stringFilterRender } },
  { title: '比对值更新迭代', dataIndex: 'baseline_iteration_name', width: 140, ellipsis: true, tooltip: true, filterable: { filter: () => true, renderContent: stringFilterRender } },
  { title: '比对值更新时间', dataIndex: 'baseline_updated_at', width: 160, slotName: 'baseline_updated_at', filterable: { filter: () => true, renderContent: stringFilterRender } },
  { title: '状态', dataIndex: 'status', width: 60, align: 'center' as const, slotName: 'status', filterable: { filter: () => true, renderContent: stringFilterRender } },
  { title: '操作', width: 80, align: 'center' as const, slotName: 'action', fixed: 'right' as const },
]

// ── 脚本关联抽屉 ──────────────────────────────────
const scriptDrawerVisible = ref(false)
const scriptDrawerTxnCode = ref('')
const scriptDrawerTxnName = ref('')
const { data: scriptListData, execute: fetchTxnScripts, isFetching: loadingScripts } = useGet<any>(
  ApiPerfBenchmark.txnScripts,
  computed(() => ({ txn_code: scriptDrawerTxnCode.value })),
  { immediate: false },
)

function handleViewScripts(record: any) {
  scriptDrawerTxnCode.value = record.txn_code
  scriptDrawerTxnName.value = record.display_name || record.txn_name || record.txn_code
  scriptDrawerVisible.value = true
  fetchTxnScripts()
}

const scriptColumns = [
  { title: '脚本编码', dataIndex: 'script_code', width: 140, ellipsis: true, tooltip: true },
  { title: '脚本名称', dataIndex: 'script_name', ellipsis: true, tooltip: true },
  { title: '版本', dataIndex: 'version', width: 80, align: 'center' as const },
  { title: '状态', dataIndex: 'status', width: 80, align: 'center' as const },
  { title: '绑定菜单', dataIndex: 'menu_name', width: 120, ellipsis: true, tooltip: true },
  { title: '项目组', dataIndex: 'project_group_name', width: 120, ellipsis: true, tooltip: true },
  { title: '最近执行', dataIndex: 'last_run_at', width: 150, slotName: 'last_run_at' },
]
</script>

<template>
  <div class="perf-txn-manage">
    <!-- 顶部筛选栏 -->
    <a-card :bordered="false" class="m-b-8px top-bar">
      <div class="filter-row">
        <div class="filter-item">
          <span class="filter-label">产品线</span>
          <a-select v-model="productLine" :options="productLineOptions" placeholder="选择产品线" allow-search style="width: 130px" />
        </div>
        <div class="filter-item">
          <span class="filter-label">产品领域</span>
          <a-select v-model="domainCode" :options="domainOptions" placeholder="全部领域" allow-clear style="width: 130px" />
        </div>
        <div class="filter-item">
          <span class="filter-label">业务领域</span>
          <a-select v-model="queryParams.business_area" :options="bizAreaOptions" placeholder="全部" allow-clear allow-search style="width: 130px" @change="handleSearch" />
        </div>
        <div class="filter-item">
          <span class="filter-label">项目组</span>
          <a-select v-model="projectGroupName" :options="projectGroupOptions" placeholder="全部项目组" allow-search allow-clear style="width: 140px" />
        </div>
        <div class="filter-item">
          <span class="filter-label">菜单名称</span>
          <a-input v-model="queryParams.menu_name" placeholder="搜索菜单" allow-clear style="width: 130px" @press-enter="handleSearch" />
        </div>
        <div class="filter-item">
          <span class="filter-label">事务名称</span>
          <a-input v-model="queryParams.keyword" placeholder="编码/名称" allow-clear style="width: 130px" @press-enter="handleSearch" />
        </div>
        <div class="filter-item">
          <span class="filter-label">事务类型</span>
          <a-select v-model="queryParams.txn_type" :options="txnTypeOptions" placeholder="全部" allow-clear style="width: 110px" />
        </div>
        <div class="filter-item">
          <span class="filter-label">达标</span>
          <a-select v-model="queryParams.pass_status" :options="passStatusOptions" placeholder="全部" allow-clear style="width: 110px" />
        </div>
        <a-button type="primary" @click="handleSearch">
          <template #icon><icon-search /></template>
          搜索
        </a-button>
        <a-button status="warning" :loading="importing" @click="handleImportClick">
          <template #icon><icon-upload /></template>
          导入
        </a-button>
        <a-button @click="downloadTemplate">
          <template #icon><icon-download /></template>
          模板
        </a-button>
        <input ref="importFileRef" type="file" accept=".xlsx,.xls" style="display: none" @change="handleImportFile" />
      </div>

      <!-- 统计数字 -->
      <div class="stats-row" :class="{ 'stats-loading': statsLoading }">
        <a-spin v-if="statsLoading" class="stats-spin" />
        <template v-if="statsData && !statsLoading">
        <a-statistic title="事务总数" :value="statsData.total_txns || 0" />
        <a-divider direction="vertical" />
        <a-statistic title="启用事务" :value="statsData.active_txns || 0" :value-style="{ color: '#00b42a' }" />
        <a-divider direction="vertical" />
        <a-statistic title="有目标值" :value="statsData.with_target || 0" />
        <a-divider direction="vertical" />
        <a-statistic title="有比对值" :value="statsData.with_baseline || 0" />
        <a-divider direction="vertical" />
        <a-statistic title="关联脚本" :value="statsData.script_count || 0" :value-style="{ color: '#165dff' }" />
        <a-divider direction="vertical" />
        <a-statistic title="有执行记录" :value="statsData.with_history || 0" />
        <a-divider direction="vertical" />
        <a-statistic title="达标数" :value="statsData.pass_count || 0" :value-style="{ color: '#00b42a' }" />
        <a-divider direction="vertical" />
        <a-statistic title="未达标" :value="statsData.fail_count || 0" :value-style="{ color: '#f53f3f' }" />
        <a-divider direction="vertical" />
        <a-statistic title="无执行记录" :value="statsData.no_history || 0" :value-style="{ color: '#86909c' }" />
        <a-divider direction="vertical" />
        <a-statistic title="达标率" :value="statsData.pass_rate || 0" suffix="%" :value-style="{ color: (statsData.pass_rate || 0) >= 80 ? '#00b42a' : '#ff7d00' }" />
        </template>
      </div>
    </a-card>

    <a-card :bordered="false" v-if="!productLine">
      <a-empty description="请先选择产品线" />
    </a-card>

    <div v-else class="txn-layout">
      <!-- 左侧菜单树 -->
      <a-card :bordered="false" class="tree-panel">
        <template #title>菜单目录</template>
        <a-tree
          :data="treeData"
          v-model:selected-keys="selectedKeys"
          :field-names="{ key: 'key', title: 'title', children: 'children' }"
          block-node
          @select="handleTreeSelect"
        />
      </a-card>

      <!-- 右侧事务列表 -->
      <a-card :bordered="false" class="table-panel">
        <template #title>
          {{ selectedMenuName ? `事务列表 - ${selectedMenuName}` : '全部事务' }}
        </template>

<a-table
  column-resizable
          :columns="columns"
          :data="dataList"
          :loading="isLoading"
          :scroll="{ x: 2000, y: 'calc(100vh - 380px)' }"
          :pagination="{
            total,
            current: queryParams.page_num,
            pageSize: queryParams.page_size,
            showTotal: true,
            showPageSize: true,
          }"
          row-key="txn_code"
          size="small"
          @page-change="handlePageChange"
          @filter-change="handleTableFilterChange"
        >
          <template #txn_type="{ record }">{{ fmtTxnType(record.txn_type) }}</template>
          <template #script_count="{ record }">
            <a-button v-if="record.script_count > 0" type="text" size="small" @click="handleViewScripts(record)">{{ record.script_count }}</a-button>
            <span v-else style="color: #999">0</span>
          </template>
          <template #target_value="{ record }">{{ fmtSec(record.target_value_ms) }}</template>
          <template #baseline_value="{ record }">{{ fmtSec(record.baseline_value_ms) }}</template>
          <template #average="{ record }">{{ fmtSec(record.average_ms) }}</template>
          <template #pass_status="{ record }">
            <a-tag v-if="record.pass_status" :color="passStatusColor(record.pass_status)" size="small">{{ fmtPassStatus(record.pass_status) }}</a-tag>
            <span v-else style="color: #999">-</span>
          </template>
          <template #baseline_updated_at="{ record }">{{ fmtTime(record.baseline_updated_at) }}</template>
          <template #status="{ record }">
            <a-tag :color="statusColor(record.status)" size="small">{{ fmtStatus(record.status) }}</a-tag>
          </template>
          <template #action="{ record }">
            <a-button type="text" size="small" @click="handleEdit(record)">编辑</a-button>
          </template>
        </a-table>
      </a-card>
    </div>

    <!-- 编辑弹窗 -->
    <a-modal v-model:visible="editVisible" title="编辑事务信息" :width="560" @ok="handleSaveEdit" :ok-loading="updating">
      <a-form :model="editForm" layout="vertical">
        <a-form-item label="事务编码">
          <a-input :model-value="editForm.txn_code" disabled />
        </a-form-item>
        <a-form-item label="事务全称">
          <a-input :model-value="editForm.txn_name" disabled />
        </a-form-item>
        <a-form-item label="简明名称（用于报告展示）">
          <a-input v-model="editForm.display_name" placeholder="输入简明事务名称" allow-clear />
        </a-form-item>
        <a-form-item label="事务类型">
          <a-select v-model="editForm.txn_type" :options="txnTypeOptions" placeholder="选择事务类型" allow-clear />
        </a-form-item>
        <a-form-item label="目标值（秒）">
          <a-input-number
            v-model="editForm.target_value_sec"
            :min="0"
            :step="0.1"
            :precision="1"
            placeholder="请输入目标值（秒）"
            style="width: 100%"
          />
        </a-form-item>
        <a-alert type="info">
          目标值表示事务的达标阈值，单位为秒。如 2.0 秒表示该事务平均耗时应在 2 秒以内。
          简明名称和事务类型将直接更新到事务主数据表，不受脚本变更影响。
        </a-alert>
      </a-form>
    </a-modal>

    <!-- 脚本关联抽屉 -->
    <a-drawer v-model:visible="scriptDrawerVisible" :width="720" :title="`关联脚本 - ${scriptDrawerTxnName}`">
<a-table
  column-resizable
        :columns="scriptColumns"
        :data="scriptListData || []"
        :loading="loadingScripts"
        :pagination="false"
        row-key="script_id"
        size="small"
      >
        <template #last_run_at="{ record }">{{ fmtTime(record.last_run_at) }}</template>
      </a-table>
    </a-drawer>
  </div>
</template>

<style scoped>
.perf-txn-manage { padding: 0; }
.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-bottom: 10px;
}
.filter-item {
  display: flex;
  align-items: center;
  gap: 4px;
}
.filter-label {
  font-size: 13px;
  color: var(--color-text-2);
  white-space: nowrap;
}
.stats-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-top: 10px;
  border-top: 1px solid var(--color-border-2);
  position: relative;
  min-height: 48px;
}
.stats-loading {
  justify-content: center;
}
.stats-spin {
  /* Arco spin centered in stats row */
}
.txn-layout {
  display: flex;
  gap: 8px;
}
.tree-panel {
  width: 300px;
  min-width: 300px;
  max-height: calc(100vh - 280px);
  overflow-y: auto;
}
:deep(.arco-tree-node-switcher) {
  width: 22px !important;
  height: 22px !important;
  min-width: 22px !important;
}
:deep(.arco-tree-node-switcher-icon) {
  font-size: 16px !important;
}
:deep(.arco-tree-node-title) {
  font-size: 14px;
  padding: 2px 4px;
}
.table-panel {
  flex: 1;
  min-width: 0;
}
</style>
