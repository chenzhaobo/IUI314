<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import { useGet, usePost, usePut, useDelete } from '@/hooks'
import { ApiPerfScript, ApiSecProjectGroup, ApiSysDictData, ApiPerfAttachment } from '@/api/apis'

defineOptions({ name: 'script' })

// ── 测试类型字典 ──────────────────────────────
const { data: testTypeDictRaw } = useGet<any>(ApiSysDictData.getByType, { dict_type: 'sec_pg_script_type' }, { immediate: true })
const testTypeOptions = computed(() => (Array.isArray(testTypeDictRaw.value) ? testTypeDictRaw.value : []))

// ── 列表查询 ──────────────────────────────────
const queryParams = ref({
  page_num: 1,
  page_size: 10,
  keyword: '',
  project_group_id: '',
  bind_status: '',
  owner: '',
})

// 动态构建请求参数，空值不传后端
const listParams = computed(() => {
  const p: Record<string, any> = { page_num: queryParams.value.page_num, page_size: queryParams.value.page_size }
  if (queryParams.value.keyword) p.keyword = queryParams.value.keyword
  if (queryParams.value.project_group_id) p.project_group_id = queryParams.value.project_group_id
  if (queryParams.value.bind_status) p.bind_status = queryParams.value.bind_status
  if (queryParams.value.owner) p.owner = queryParams.value.owner
  return p
})

const { isFetching: isLoading, data: rawListData, execute: getList } = useGet<any>(ApiPerfScript.getList, listParams, { immediate: true })
const dataList = computed(() => rawListData.value?.list || [])
const total = computed(() => rawListData.value?.total || 0)

// ── 项目组选项 ──────────────────────────────────
const { data: pgRawData } = useGet<any>(ApiSecProjectGroup.getAll, {}, { immediate: true })
const projectGroupOptions = computed(() => {
  const all = Array.isArray(pgRawData.value) ? pgRawData.value : []
  return all.map((pg: any) => ({ label: pg.name, value: pg.id }))
})

function handleSearch() {
  queryParams.value.page_num = 1
  selectedIds.value = []
  getList()
}

function handleRefresh() {
  selectedIds.value = []
  getList()
}

function handlePageChange(page: number) {
  queryParams.value.page_num = page
  selectedIds.value = []
  getList()
}

// ── 时间格式化 ──────────────────────────────────
function formatTime(time?: string | null) {
  if (!time) return '-'
  return time.replace('T', ' ').substring(0, 19)
}

// ── 耗时格式化 ──────────────────────────────────
function formatDuration(ms?: number | null) {
  if (!ms || ms <= 0) return '-'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h${m}m${s}s`
  if (m > 0) return `${m}m${s}s`
  return `${s}s`
}

const columns = [
  { title: '脚本名称', dataIndex: 'name', width: 160, ellipsis: true, tooltip: true },
  { title: '编码', dataIndex: 'code', width: 120 },
  { title: '应用编码', dataIndex: 'app_code', width: 90 },
  { title: '项目组', dataIndex: 'project_group_name', width: 120, ellipsis: true, tooltip: true },
  { title: '测试类型', dataIndex: 'test_type', width: 80, ellipsis: true, tooltip: true },
  { title: '责任人', dataIndex: 'owner', width: 80, ellipsis: true, tooltip: true },
  { title: '绑定数', dataIndex: 'bind_count', width: 70 },
  { title: '关联状态', dataIndex: 'bind_status', width: 90, slotName: 'bindStatus' },
  { title: '事务', dataIndex: 'txn_summary', width: 100, slotName: 'txnSummary' },
  { title: '版本', dataIndex: 'version', width: 60, slotName: 'version' },
  { title: '文件名', dataIndex: 'jmx_file_name', width: 180, ellipsis: true, tooltip: true },
  { title: '运行次数', dataIndex: 'run_count', width: 80 },
  { title: '最近耗时', dataIndex: 'last_duration_ms', width: 110, slotName: 'lastDuration' },
  { title: '创建时间', dataIndex: 'created_at', width: 170, slotName: 'created_at', ellipsis: true, tooltip: true },
  { title: '更新时间', dataIndex: 'updated_at', width: 170, slotName: 'updated_at', ellipsis: true, tooltip: true },
  { title: '更新人', dataIndex: 'update_by', width: 100, ellipsis: true, tooltip: true },
  { title: '状态', dataIndex: 'status', width: 60, slotName: 'status' },
  { title: '操作', dataIndex: 'operations', slotName: 'operations', width: 140, fixed: 'right' as const },
]

// ── 上传弹窗 ──────────────────────────────────
const uploadVisible = ref(false)
const uploadForm = ref({
  name: '',
  code: '',
  project_group_id: '',
  description: '',
  tags: '',
  remark: '',
  test_type: '',
})
const uploadFile = ref<File | null>(null)
const uploading = ref(false)
const uploadTab = ref<'single' | 'batch'>('single')
const dupScript = ref<{ exists: boolean; id: string; name: string } | null>(null)
let codeCheckTimer: ReturnType<typeof setTimeout> | null = null

function handleUploadClick() {
  uploadForm.value = { name: '', code: '', project_group_id: '', description: '', tags: '', remark: '', test_type: '' }
  uploadFile.value = null
  uploadTab.value = 'single'
  dupScript.value = null
  uploadVisible.value = true
}

// 编码查重
watch(() => uploadForm.value.code, (newCode) => {
  if (codeCheckTimer) clearTimeout(codeCheckTimer)
  dupScript.value = null
  if (!newCode) return
  codeCheckTimer = setTimeout(async () => {
    try {
      const { token } = useToken()
      const base = import.meta.env.VITE_API_BASE_URL || ''
      const resp = await fetch(`${base}${ApiPerfScript.checkCode}?code=${encodeURIComponent(newCode)}`, {
        headers: { Authorization: token },
      })
      const data = await resp.json()
      if (data.code === 200 && data.data?.exists) {
        dupScript.value = data.data
      }
    } catch { /* ignore */ }
  }, 500)
})

function handleSwitchToUpdateJmx() {
  if (!dupScript.value) return
  uploadVisible.value = false
  handleUpdateJmx({ id: dupScript.value.id, name: dupScript.value.name })
}

function handleFileChange(fileList: any[]) {
  if (fileList.length > 0) {
    const item = fileList[0]
    // Arco Design Upload @change passes FileItem[], item.file is the native File
    uploadFile.value = item.file || item
    if (!uploadForm.value.name) {
      const fileName = item.name || item.file?.name || ''
      uploadForm.value.name = fileName.replace(/\.jmx$/i, '')
    }
  }
}

async function handleUploadSubmit() {
  if (!uploadForm.value.name) { Message.warning('请输入脚本名称'); return }
  if (!uploadForm.value.code) { Message.warning('请输入脚本编码'); return }
  if (!uploadFile.value) { Message.warning('请选择 .jmx 文件'); return }

  if (dupScript.value) {
    Modal.confirm({
      title: '编码重复',
      content: `编码「${uploadForm.value.code}」已存在脚本「${dupScript.value.name}」。建议使用「更新JMX」功能更新已有脚本。是否仍要继续上传？`,
      okText: '继续上传',
      cancelText: '取消',
      onOk: () => doUpload(),
    })
    return
  }
  await doUpload()
}

async function doUpload() {
  const formData = new FormData()
  formData.append('file', uploadFile.value)
  formData.append('name', uploadForm.value.name)
  formData.append('code', uploadForm.value.code)
  formData.append('project_group_id', uploadForm.value.project_group_id)
  formData.append('description', uploadForm.value.description)
  formData.append('tags', uploadForm.value.tags)
  formData.append('remark', uploadForm.value.remark)
  formData.append('test_type', uploadForm.value.test_type)

  uploading.value = true
  try {
    const { token } = useToken()
    const resp = await fetch(import.meta.env.VITE_API_BASE_URL + ApiPerfScript.upload, {
      method: 'POST',
      body: formData,
      headers: { Authorization: token },
    })
    const data = await resp.json()
    if (data.code === 200) {
      Message.success('上传成功')
      uploadVisible.value = false
      getList()
    } else {
      Message.error(data.msg || '上传失败')
    }
  } catch (e) {
    Message.error('上传失败')
  } finally {
    uploading.value = false
  }
}

function handleUploadOk() {
  if (uploadTab.value === 'single') {
    handleUploadSubmit()
  } else {
    handleBatchUploadSubmit()
  }
}

// ── 编辑弹窗 ──────────────────────────────────
const editVisible = ref(false)
const editForm = ref<any>({})
const isEdit = ref(false)

function handleEdit(record: any) {
  isEdit.value = true
  editForm.value = { ...record }
  editVisible.value = true
}

async function handleEditSubmit() {
  const { execute, error } = usePut(ApiPerfScript.edit, editForm.value)
  await execute()
  if (error.value) { Message.error('编辑失败'); return }
  Message.success('编辑成功')
  editVisible.value = false
  getList()
}

// ── 删除 ──────────────────────────────────
async function handleDelete(record: any) {
  const { execute, error } = useDelete(ApiPerfScript.delete, { ids: [record.id] })
  await execute()
  if (error.value) { Message.error('删除失败'); return }
  Message.success('删除成功')
  getList()
}

const editFields = [
  { label: '脚本名称', field: 'name', required: true },
  { label: '脚本编码', field: 'code', required: true },
  { label: '应用编码', field: 'app_code' },
  { label: '测试类型', field: 'test_type' },
  { label: '责任人', field: 'owner' },
  { label: '状态', field: 'status' },
  { label: '版本', field: 'version' },
  { label: '云', field: 'cloud' },
  { label: '领域', field: 'domain' },
  { label: '模块', field: 'module_name' },
  { label: '功能', field: 'function_name' },
  { label: '标签', field: 'tags' },
  { label: '描述', field: 'description' },
  { label: '备注', field: 'remark' },
]

// ── 执行参数配置 ──────────────────────────────────
const paramsVisible = ref(false)
const paramsLoading = ref(false)
const paramsForm = ref({
  script_id: '',
  threads: undefined as number | undefined,
  rampup: undefined as number | undefined,
  loops: undefined as number | undefined,
  duration: undefined as number | undefined,
  timeout_sec: undefined as number | undefined,
  extra_props: '',
})
const paramsScriptName = ref('')

function handleParams(record: any) {
  paramsScriptName.value = record.name
  paramsForm.value.script_id = record.id
  const dp = record.default_params_json
  paramsForm.value = {
    script_id: record.id,
    threads: dp?.threads ?? undefined,
    rampup: dp?.rampup ?? undefined,
    loops: dp?.loops ?? undefined,
    duration: dp?.duration ?? undefined,
    timeout_sec: dp?.timeout_sec ?? undefined,
    extra_props: dp?.extra_props ?? '',
  }
  paramsVisible.value = true
}

async function handleParamsSubmit() {
  paramsLoading.value = true
  const { execute, error } = usePut(ApiPerfScript.updateParams, {
    script_id: paramsForm.value.script_id,
    params: {
      threads: paramsForm.value.threads ?? null,
      rampup: paramsForm.value.rampup ?? null,
      loops: paramsForm.value.loops ?? null,
      duration: paramsForm.value.duration ?? null,
      timeout_sec: paramsForm.value.timeout_sec ?? null,
      extra_props: paramsForm.value.extra_props || null,
    },
  })
  await execute()
  paramsLoading.value = false
  if (error.value) { Message.error('保存失败'); return }
  Message.success('参数已保存')
  paramsVisible.value = false
  getList()
}

// ── 项目组筛选 ──────────────────────────────────
watch(() => queryParams.value.project_group_id, () => {
  queryParams.value.page_num = 1
  getList()
})
watch(() => queryParams.value.bind_status, () => {
  queryParams.value.page_num = 1
  getList()
})
watch(() => queryParams.value.owner, () => {
  queryParams.value.page_num = 1
  getList()
})

// ── 事务详情抽屉 ──────────────────────────────────
const txnDrawerVisible = ref(false)
const txnDrawerData = ref<any>(null)
const txnDrawerTitle = ref('')
const txnDrawerScriptId = ref('')

// ── 附件管理抽屉 ──────────────────────────────────
const attachmentVisible = ref(false)
const attachmentScriptId = ref('')
const attachmentScriptName = ref('')
const attachmentList = ref<any[]>([])
const attachmentLoading = ref(false)
const attUploadFile = ref<File | null>(null)
const attFileType = ref('')
const attTargetDir = ref('lib/ext')
const attUploading = ref(false)

function handleAttachments(record: any) {
  attachmentScriptId.value = record.id
  attachmentScriptName.value = record.name
  attachmentVisible.value = true
  loadAttachments()
}

async function loadAttachments() {
  attachmentLoading.value = true
  const { data, execute } = useGet<any>(ApiPerfAttachment.list, { id: attachmentScriptId.value }, { immediate: false })
  await execute()
  attachmentList.value = data.value || []
  attachmentLoading.value = false
}

function handleAttBeforeUpload(file: File) {
  attUploadFile.value = file
  const name = file.name
  if (name.endsWith('.jar')) attFileType.value = 'jar'
  else if (name.endsWith('.csv')) attFileType.value = 'csv'
  else if (name.endsWith('.xlsx') || name.endsWith('.xls')) attFileType.value = 'xlsx'
  else if (name.endsWith('.properties')) attFileType.value = 'props'
  else attFileType.value = 'data'
  return true
}

async function handleAttUpload() {
  if (!attUploadFile.value) { Message.warning('请选择文件'); return }
  attUploading.value = true
  try {
    const { token } = useToken()
    const formData = new FormData()
    formData.append('file', attUploadFile.value)
    formData.append('script_id', attachmentScriptId.value)
    formData.append('file_type', attFileType.value)
    formData.append('target_dir', attTargetDir.value)
    const resp = await fetch(import.meta.env.VITE_API_BASE_URL + ApiPerfAttachment.upload, {
      method: 'POST',
      body: formData,
      headers: { Authorization: token },
    })
    const data = await resp.json()
    if (data.code === 200) {
      Message.success('上传成功')
      attUploadFile.value = null
      loadAttachments()
    } else {
      Message.error(data.msg || '上传失败')
    }
  } catch (e) {
    Message.error('上传失败')
  } finally {
    attUploading.value = false
  }
}

async function handleAttDelete(record: any) {
  const { execute, error } = useDelete(ApiPerfAttachment.delete, { attachment_id: record.id })
  await execute()
  if (error.value) { Message.error('删除失败'); return }
  Message.success('删除成功')
  loadAttachments()
}

async function handleAttDownload(record: any) {
  const { token } = useToken()
  const base = import.meta.env.VITE_API_BASE_URL || ''
  try {
    const resp = await fetch(`${base}${ApiPerfAttachment.download}?attachment_id=${encodeURIComponent(record.id)}`, {
      headers: { Authorization: token },
    })
    if (!resp.ok) { Message.error('下载失败'); return }
    const blob = await resp.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = record.file_name || 'attachment'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch {
    Message.error('下载失败')
  }
}

function formatFileSize(bytes: number) {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

// ── 版本历史抽屉 ──────────────────────────────────
const versionVisible = ref(false)
const versionScriptId = ref('')
const versionScriptName = ref('')
const versionList = ref<any[]>([])
const versionLoading = ref(false)

function handleVersions(record: any) {
  versionScriptId.value = record.id
  versionScriptName.value = record.name
  versionVisible.value = true
  loadVersions()
}

async function loadVersions() {
  versionLoading.value = true
  const { data, execute } = useGet<any>(ApiPerfScript.versionHistory, { id: versionScriptId.value }, { immediate: false })
  await execute()
  versionList.value = data.value || []
  versionLoading.value = false
}

async function handleDownloadVersionJmx(record: any) {
  const { token } = useToken()
  const base = import.meta.env.VITE_API_BASE_URL || ''
  try {
    const apiUrl = record.is_current
      ? `${base}${ApiPerfScript.downloadJmx}?id=${encodeURIComponent(record.id)}&source=script`
      : `${base}${ApiPerfScript.downloadJmx}?id=${encodeURIComponent(record.id)}&source=version`
    const resp = await fetch(apiUrl, {
      headers: { Authorization: token },
    })
    const contentType = resp.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const data = await resp.json()
      Message.error(data.msg || '下载失败')
      return
    }
    if (!resp.ok) { Message.error('下载失败'); return }
    const blob = await resp.blob()
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = `${record.version || 'script'}_${record.jmx_file_name || 'script.jmx'}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(blobUrl)
  } catch {
    Message.error('下载失败')
  }
}

async function handleDownloadScriptJmx(record: any) {
  const { token } = useToken()
  const base = import.meta.env.VITE_API_BASE_URL || ''
  try {
    const resp = await fetch(`${base}${ApiPerfScript.downloadJmx}?id=${encodeURIComponent(record.id)}&source=script`, {
      headers: { Authorization: token },
    })
    const contentType = resp.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const data = await resp.json()
      Message.error(data.msg || '下载失败')
      return
    }
    if (!resp.ok) { Message.error('下载失败'); return }
    const blob = await resp.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = record.jmx_file_name || 'script.jmx'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch {
    Message.error('下载失败')
  }
}

function handleAction(val: string, record: any) {
  switch (val) {
    case 'txn': handleViewTxn(record); break
    case 'reparse': handleReparse(record); break
    case 'autoBind': handleAutoBind(record); break
    case 'updateJmx': handleUpdateJmx(record); break
    case 'versions': handleVersions(record); break
    case 'attachments': handleAttachments(record); break
    case 'params': handleParams(record); break
    case 'downloadJmx': handleDownloadScriptJmx(record); break
    case 'delete':
      Modal.confirm({
        title: '确认删除',
        content: `确定要删除脚本「${record.name}」吗？`,
        okText: '删除',
        cancelText: '取消',
        onOk: () => handleDelete(record),
      })
      break
  }
}

const versionColumns = [
  { title: '版本', dataIndex: 'version', width: 60, slotName: 'v_version' },
  { title: '变更说明', dataIndex: 'change_log', width: 200, ellipsis: true, tooltip: true },
  { title: 'MD5', dataIndex: 'jmx_md5', width: 120, ellipsis: true, tooltip: true },
  { title: '文件大小', dataIndex: 'jmx_file_size', width: 100, slotName: 'v_size' },
  { title: '创建时间', dataIndex: 'created_at', width: 160, slotName: 'v_created' },
  { title: '创建人', dataIndex: 'created_by', width: 100 },
  { title: '操作', dataIndex: 'operations', slotName: 'v_ops', width: 100 },
]

// ── 更新JMX弹窗 ──────────────────────────────────
const updateJmxVisible = ref(false)
const updateJmxScriptId = ref('')
const updateJmxScriptName = ref('')
const updateJmxFile = ref<File | null>(null)
const updateJmxChangeLog = ref('')
const updateJmxLoading = ref(false)

function handleUpdateJmx(record: any) {
  updateJmxScriptId.value = record.id
  updateJmxScriptName.value = record.name
  updateJmxFile.value = null
  updateJmxChangeLog.value = ''
  updateJmxVisible.value = true
}

function handleUpdateJmxBeforeUpload(file: File) {
  updateJmxFile.value = file
  return true
}

async function handleUpdateJmxSubmit() {
  if (!updateJmxFile.value) { Message.warning('请选择 .jmx 文件'); return }
  updateJmxLoading.value = true
  try {
    const { token } = useToken()
    const formData = new FormData()
    formData.append('script_id', updateJmxScriptId.value)
    formData.append('file', updateJmxFile.value)
    if (updateJmxChangeLog.value) {
      formData.append('change_log', updateJmxChangeLog.value)
    }
    const resp = await fetch(import.meta.env.VITE_API_BASE_URL + ApiPerfScript.upload, {
      method: 'POST',
      body: formData,
      headers: { Authorization: token },
    })
    const data = await resp.json()
    if (data.code === 200) {
      Message.success(`更新成功，新版本: ${data.data}`)
      updateJmxVisible.value = false
      getList()
    } else {
      Message.error(data.msg || '更新失败')
    }
  } catch (e) {
    Message.error('更新失败')
  } finally {
    updateJmxLoading.value = false
  }
}

const attachmentColumns = [
  { title: '文件名', dataIndex: 'file_name', width: 200, ellipsis: true, tooltip: true },
  { title: '类型', dataIndex: 'file_type', width: 80, slotName: 'att_type' },
  { title: '大小', dataIndex: 'file_size', width: 100, slotName: 'att_size' },
  { title: 'MD5', dataIndex: 'md5', width: 120, ellipsis: true, tooltip: true },
  { title: '目标目录', dataIndex: 'target_dir', width: 120 },
  { title: '操作', dataIndex: 'operations', slotName: 'att_ops', width: 120 },
]

const txnDetailColumns = [
  { title: '#', width: 50, render: ({ rowIndex }: any) => rowIndex + 1 },
  { title: '事务名称', dataIndex: 'name', width: 220, ellipsis: true, tooltip: true },
  { title: '事务编码', dataIndex: 'txn_code', width: 150, ellipsis: true, tooltip: true },
  { title: '按钮Key', dataIndex: 'button_key', width: 100, ellipsis: true, tooltip: true },
  { title: '匹配状态', dataIndex: 'match_status', width: 90, slotName: 'matchStatus' },
  { title: '类型', dataIndex: 'txn_type', width: 110, slotName: 'txnType' },
  { title: '启用', dataIndex: 'enabled', width: 60, slotName: 'enabled' },
  { title: '关键事务', dataIndex: 'is_key_txn', width: 80, slotName: 'keyTxn' },
  { title: '父样本', dataIndex: 'is_parent', width: 70, slotName: 'isParent' },
]

function handleViewTxn(record: any) {
  txnDrawerTitle.value = `事务详情 - ${record.name}`
  txnDrawerScriptId.value = record.id
  const txnDetail = record.txn_detail_json
  if (!txnDetail) {
    txnDrawerData.value = { transactions: [], key_txn_count: 0, total_txn_count: 0, empty: true }
  } else {
    txnDrawerData.value = JSON.parse(JSON.stringify(txnDetail))
  }
  txnMatchMap.value = {}
  txnDrawerVisible.value = true
  // 加载匹配状态
  loadTxnButtons(record.id)
}

const txnMatchMap = ref<Record<string, { match_status: string; button_name: string | null }>>({})

async function loadTxnButtons(scriptId: string) {
  const { execute, data } = useGet<any[]>(ApiPerfScript.txnButtons, { script_id: scriptId })
  await execute()
  const list = Array.isArray(data.value) ? data.value : []
  const map: Record<string, { match_status: string; button_name: string | null }> = {}
  list.forEach((item: any) => {
    if (item.txn_code) {
      map[item.txn_code] = { match_status: item.match_status, button_name: item.button_name }
    }
  })
  txnMatchMap.value = map
}

function getTxnSummary(record: any): string {
  const txn = record.txn_detail_json
  if (!txn) return '-'
  return `${txn.key_txn_count ?? 0} / ${txn.total_txn_count ?? 0}`
}

// ── 重新解析 ──────────────────────────────────
const reparsingAll = ref(false)
const reparsingIds = ref<Set<string>>(new Set())

async function handleReparse(record: any) {
  reparsingIds.value.add(record.id)
  const { execute, error } = usePut(ApiPerfScript.reparse + '?id=' + record.id)
  await execute()
  reparsingIds.value.delete(record.id)
  if (error.value) { Message.error('重新解析失败'); return }
  Message.success('事务详情解析成功')
  getList()
}

async function handleReparseAll() {
  Modal.confirm({
    title: '批量重新解析',
    content: '全量解析会重新解析所有脚本的事务详情并同步到事务管理，耗时较长。确认执行？',
    okText: '全量解析',
    cancelText: '差量更新',
    hideCancel: false,
    onOk: () => doReparseAll('all'),
    onCancel: () => doReparseAll('incremental'),
  })
}

async function doReparseAll(mode: string) {
  reparsingAll.value = true
  const { execute, error, data } = usePut(ApiPerfScript.reparse + '?mode=' + mode, {})
  await execute()
  reparsingAll.value = false
  if (error.value) { Message.error('批量解析失败'); return }
  Message.success(data.value?.msg || '批量解析完成')
  getList()
}

// ── 自动关联 ──────────────────────────────────
const autoBindingAll = ref(false)
const autoBindingIds = ref<Set<string>>(new Set())

async function handleAutoBind(record: any) {
  autoBindingIds.value.add(record.id)
  const { execute, error, data } = usePost(ApiPerfScript.autoBind + '?id=' + record.id)
  await execute()
  autoBindingIds.value.delete(record.id)
  if (error.value) { Message.error('自动关联失败'); return }
  const r = data.value
  if (r) {
    Message.success(`匹配${r.menu_count}个菜单，新建${r.bind_count}条绑定，事务匹配${r.txn_matched}/${r.txn_total}`)
  } else {
    Message.success('自动关联完成')
  }
  getList()
}

async function handleAutoBindAll() {
  autoBindingAll.value = true
  const { execute, error, data } = usePost(ApiPerfScript.autoBind, {})
  await execute()
  autoBindingAll.value = false
  if (error.value) { Message.error('批量自动关联失败'); return }
  const r = data.value
  if (r) {
    Message.success(r.message || `批量关联完成: 共${r.total}个脚本, ${r.matched}个匹配到菜单`)
  } else {
    Message.success('批量自动关联完成')
  }
  getList()
}

// ── 批量上传 ──────────────────────────────────
const batchUploadVisible = ref(false)
const batchFiles = ref<File[]>([])
const batchUploading = ref(false)
const batchProjectGroupId = ref('')

function handleBatchUploadClick() {
  handleUploadClick()
  uploadTab.value = 'batch'
}

function handleBatchFileChange(fileList: any[]) {
  batchFiles.value = fileList.map((item: any) => item.file || item).filter((f: File) => f && f.name.endsWith('.jmx'))
}

async function handleBatchUploadSubmit() {
  if (batchFiles.value.length === 0) { Message.warning('请选择 .jmx 文件'); return }
  batchUploading.value = true

  const formData = new FormData()
  for (const f of batchFiles.value) {
    formData.append('files', f)
  }
  if (batchProjectGroupId.value) {
    formData.append('project_group_id', batchProjectGroupId.value)
  }

  try {
    const { token } = useToken()
    const resp = await fetch(import.meta.env.VITE_API_BASE_URL + ApiPerfScript.batchUpload, {
      method: 'POST',
      body: formData,
      headers: { Authorization: token },
    })
    const data = await resp.json()
    if (data.code === 200) {
      Message.success(data.msg || '批量上传完成')
      uploadVisible.value = false
      getList()
    } else {
      Message.error(data.msg || '批量上传失败')
    }
  } catch (e) {
    Message.error('批量上传失败')
  } finally {
    batchUploading.value = false
  }
}

// ── 批量设置责任人 ──────────────────────────────────
const selectedIds = ref<string[]>([])
const setOwnerVisible = ref(false)
const setOwnerLoading = ref(false)
const setOwnerValue = ref('')

function handleSetOwnerClick() {
  if (selectedIds.value.length === 0) {
    Message.warning('请先勾选脚本')
    return
  }
  setOwnerValue.value = ''
  setOwnerVisible.value = true
}

async function handleSetOwnerSubmit() {
  if (!setOwnerValue.value.trim()) { Message.warning('请输入责任人'); return }
  setOwnerLoading.value = true
  const { execute, error, data } = usePut<any>(ApiPerfScript.batchSetOwner, {
    ids: selectedIds.value,
    owner: setOwnerValue.value.trim(),
  })
  await execute()
  setOwnerLoading.value = false
  if (error.value) { Message.error('设置失败'); return }
  Message.success(data.value?.data || '设置成功')
  setOwnerVisible.value = false
  selectedIds.value = []
  getList()
}

function handleSelectionChange(keys: string[]) {
  selectedIds.value = keys
}
</script>

<template>
  <div class="perf-script">
    <a-card :bordered="false" class="m-b-8px">
      <a-row :gutter="16">
        <a-col :span="8">
          <a-input-search v-model="queryParams.keyword" placeholder="搜索脚本名称/编码" allow-clear @search="handleSearch" @press-enter="handleSearch" />
        </a-col>
        <a-col :span="5">
          <a-select v-model="queryParams.project_group_id" :options="projectGroupOptions" placeholder="全部项目组" allow-search allow-clear />
        </a-col>
        <a-col :span="4">
          <a-select v-model="queryParams.bind_status" placeholder="关联状态" allow-clear>
            <a-option value="bound">已关联</a-option>
            <a-option value="unbound">未关联</a-option>
          </a-select>
        </a-col>
        <a-col :span="3">
          <a-input v-model="queryParams.owner" placeholder="责任人" allow-clear @press-enter="handleSearch" />
        </a-col>
        <a-col :span="6">
          <a-space>
            <a-button type="primary" @click="handleSearch">搜索</a-button>
            <a-button @click="handleRefresh">
              <template #icon><icon-sync /></template>
              刷新
            </a-button>
            <a-button type="primary" status="success" @click="handleUploadClick">
              <template #icon><icon-upload /></template>
              上传脚本
            </a-button>
            <a-button :loading="reparsingAll" @click="handleReparseAll">
              <template #icon><icon-refresh /></template>
              重新解析
            </a-button>
            <a-button type="primary" status="success" :loading="autoBindingAll" @click="handleAutoBindAll">
              <template #icon><icon-link /></template>
              批量自动关联
            </a-button>
            <a-button status="warning" :disabled="selectedIds.length === 0" @click="handleSetOwnerClick">
              <template #icon><icon-user-group /></template>
              设置责任人{{ selectedIds.length > 0 ? `(${selectedIds.length})` : '' }}
            </a-button>
          </a-space>
        </a-col>
      </a-row>
    </a-card>

    <a-card :bordered="false">
<a-table
  column-resizable
        :loading="isLoading"
        :data="dataList"
        :columns="columns"
        :pagination="{ total, current: queryParams.page_num, pageSize: queryParams.page_size, showTotal: true, showPageSize: true }"
        row-key="id"
        :row-selection="{ type: 'checkbox', showCheckedAll: true }"
        v-model:selectedKeys="selectedIds"
        @page-change="handlePageChange"
      >
        <template #created_at="{ record }">{{ formatTime(record.created_at) }}</template>
        <template #updated_at="{ record }">{{ formatTime(record.updated_at) }}</template>
        <template #lastDuration="{ record }">{{ formatDuration(record.last_duration_ms) }}</template>
        <template #status="{ record }">
          <a-tag :color="record.status === '1' ? 'green' : 'red'">{{ record.status === '1' ? '启用' : '禁用' }}</a-tag>
        </template>
        <template #bindStatus="{ record }">
          <a-tag :color="record.bind_count > 0 ? 'green' : 'gray'">{{ record.bind_count > 0 ? '已关联' : '未关联' }}</a-tag>
        </template>
        <template #txnSummary="{ record }">
          <a-button type="text" size="small" @click="handleViewTxn(record)">
            {{ getTxnSummary(record) }}
          </a-button>
        </template>
        <template #version="{ record }">
          <a-button type="text" size="small" @click="handleVersions(record)">{{ record.version }}</a-button>
        </template>
        <template #operations="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="handleEdit(record)">编辑</a-button>
            <a-dropdown @select="(val: string) => handleAction(val, record)">
              <a-button type="text" size="small">更多<icon-down /></a-button>
              <template #content>
                <a-doption value="txn">事务详情 ({{ getTxnSummary(record) }})</a-doption>
                <a-doption value="reparse">重新解析</a-doption>
                <a-doption value="autoBind">自动关联</a-doption>
                <a-doption value="updateJmx">更新JMX</a-doption>
                <a-doption value="versions">版本历史</a-doption>
                <a-doption value="attachments">附件管理</a-doption>
                <a-doption value="params">执行参数</a-doption>
                <a-doption value="downloadJmx">下载JMX</a-doption>
                <a-doption value="delete" style="color: #f53f3f">删除</a-doption>
              </template>
            </a-dropdown>
          </a-space>
        </template>
      </a-table>
    </a-card>

    <!-- 上传弹窗（单文件/批量） -->
    <a-modal v-model:visible="uploadVisible" title="上传JMX脚本" :width="580" :ok-loading="uploadTab === 'single' ? uploading : batchUploading" @ok="handleUploadOk">
      <a-tabs v-model:active-key="uploadTab">
        <a-tab-pane key="single" title="单文件上传">
          <a-form :model="uploadForm" layout="vertical">
            <a-form-item label="脚本名称" required>
              <a-input v-model="uploadForm.name" placeholder="请输入脚本名称" />
            </a-form-item>
            <a-form-item label="脚本编码" required>
              <a-input v-model="uploadForm.code" placeholder="如：login_test" />
              <a-alert v-if="dupScript" type="warning" :style="{ marginTop: '8px' }" show-icon>
                编码「{{ uploadForm.code }}」已存在脚本「{{ dupScript.name }}」，建议使用「更新JMX」功能。
                <a-button type="text" size="small" status="warning" @click="handleSwitchToUpdateJmx">去更新</a-button>
              </a-alert>
            </a-form-item>
            <a-form-item label="测试类型">
              <a-select v-model="uploadForm.test_type" placeholder="请选择测试类型" allow-clear>
                <a-option v-for="d in testTypeOptions" :key="d.dict_value" :value="d.dict_value" :label="d.dict_label" />
              </a-select>
            </a-form-item>
            <a-form-item label="项目组ID">
              <a-input v-model="uploadForm.project_group_id" placeholder="可选" />
            </a-form-item>
            <a-form-item label="JMX文件" required>
              <a-upload :auto-upload="false" :limit="1" accept=".jmx" @change="handleFileChange" />
            </a-form-item>
            <a-form-item label="标签">
              <a-input v-model="uploadForm.tags" placeholder="逗号分隔" />
            </a-form-item>
            <a-form-item label="描述">
              <a-textarea v-model="uploadForm.description" :auto-size="{ minRows: 2, maxRows: 4 }" />
            </a-form-item>
          </a-form>
        </a-tab-pane>
        <a-tab-pane key="batch" title="批量上传">
          <a-alert type="info" :style="{ marginBottom: '12px' }">
            文件名需符合规范: code-基准-云-领域-模块-功能-测试类型.jmx
            系统将从文件名自动解析编码和测试类型，并按MD5查重跳过已存在脚本。
          </a-alert>
          <a-form layout="vertical">
            <a-form-item label="项目组ID（可选）">
              <a-input v-model="batchProjectGroupId" placeholder="所有脚本共享此项目组" />
            </a-form-item>
            <a-form-item label="选择JMX文件（可多选）" required>
              <a-upload :auto-upload="false" multiple accept=".jmx" @change="handleBatchFileChange" />
            </a-form-item>
          </a-form>
        </a-tab-pane>
      </a-tabs>
    </a-modal>

    <!-- 编辑弹窗 -->
    <a-modal v-model:visible="editVisible" title="编辑脚本" :width="680" @ok="handleEditSubmit">
      <a-form :model="editForm" layout="vertical">
        <a-row :gutter="16">
          <a-col v-for="f in editFields" :key="f.field" :span="12">
            <a-form-item :label="f.label" :required="f.required">
              <a-input v-model="editForm[f.field]" :placeholder="`请输入${f.label}`" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <!-- 执行参数配置弹窗 -->
    <a-modal v-model:visible="paramsVisible" :title="`执行参数配置 - ${paramsScriptName}`" :width="520" :ok-loading="paramsLoading" @ok="handleParamsSubmit">
      <a-alert type="info" :style="{ marginBottom: '12px' }">
        配置此脚本的默认执行参数。触发执行时，如未显式传参，将使用此配置作为默认值。
      </a-alert>
      <a-form :model="paramsForm" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="线程数">
              <a-input-number v-model="paramsForm.threads" :min="1" placeholder="如 10" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="Ramp-up(秒)">
              <a-input-number v-model="paramsForm.rampup" :min="0" placeholder="如 5" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="循环次数">
              <a-input-number v-model="paramsForm.loops" :min="1" placeholder="如 1" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="持续时间(秒)">
              <a-input-number v-model="paramsForm.duration" :min="0" placeholder="0=不限" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="超时时间(秒)">
              <a-input-number v-model="paramsForm.timeout_sec" :min="60" placeholder="如 1800" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="额外JMeter属性">
          <a-input v-model="paramsForm.extra_props" placeholder="key1=val1,key2=val2" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 事务详情抽屉 -->
    <a-drawer :visible="txnDrawerVisible" :width="1060" :title="txnDrawerTitle" @cancel="txnDrawerVisible = false" @ok="txnDrawerVisible = false">
      <template v-if="txnDrawerData?.empty">
        <a-empty description="该脚本尚未解析事务详情，请点击「解析」按钮重新解析" />
      </template>
      <template v-else>
        <a-descriptions :data="[
          { label: '事务总数', value: txnDrawerData?.total_txn_count ?? 0 },
          { label: '[A]关键事务', value: txnDrawerData?.key_txn_count ?? 0 },
          { label: '启用', value: txnDrawerData?.enabled_count ?? 0 },
        ]" :column="3" layout="inline-horizontal" style="margin-bottom: 16px" />
<a-table
          :data="txnDrawerData?.transactions || []"
          :columns="txnDetailColumns"
          :pagination="false"
          row-key="name"
          size="small"
          column-resizable
          :scroll="{ x: 1130, y: 'calc(100vh - 300px)' }"
        >
          <template #matchStatus="{ record }">
            <a-tag v-if="record.txn_code && txnMatchMap[record.txn_code]" :color="txnMatchMap[record.txn_code].match_status === 'matched' ? 'green' : txnMatchMap[record.txn_code].match_status === 'unmatched' ? 'orange' : 'gray'" size="small">
              {{ txnMatchMap[record.txn_code].match_status === 'matched' ? '已匹配' : txnMatchMap[record.txn_code].match_status === 'unmatched' ? '未匹配' : '无Key' }}
            </a-tag>
            <span v-else style="color: #999">-</span>
          </template>
          <template #txnType="{ record }">
            <a-tag :color="record.txn_type === 'transaction_controller' ? 'blue' : 'gray'" size="small">
              {{ record.txn_type === 'transaction_controller' ? '事务控制器' : 'HTTP请求' }}
            </a-tag>
          </template>
          <template #enabled="{ record }">
            <a-tag :color="record.enabled ? 'green' : 'red'" size="small">{{ record.enabled ? '是' : '否' }}</a-tag>
          </template>
          <template #keyTxn="{ record }">
            <a-tag v-if="record.is_key_txn" color="red" size="small">[A]</a-tag>
            <span v-else>-</span>
          </template>
          <template #isParent="{ record }">
            <a-tag v-if="record.is_parent" color="orange" size="small">是</a-tag>
            <span v-else>-</span>
          </template>
        </a-table>
      </template>
    </a-drawer>

    <!-- 批量设置责任人弹窗 -->
    <a-modal v-model:visible="setOwnerVisible" title="批量设置责任人" :width="420" :ok-loading="setOwnerLoading" @ok="handleSetOwnerSubmit">
      <a-alert type="info" :style="{ marginBottom: '12px' }">
        已选择 {{ selectedIds.length }} 个脚本，将统一设置责任人。
      </a-alert>
      <a-form layout="vertical">
        <a-form-item label="责任人" required>
          <a-input v-model="setOwnerValue" placeholder="请输入责任人姓名" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 附件管理抽屉 -->
    <a-drawer :visible="attachmentVisible" :width="680" :title="`附件管理 - ${attachmentScriptName}`" @cancel="attachmentVisible = false" @ok="attachmentVisible = false">
      <a-card :bordered="false" style="margin-bottom: 16px">
        <a-form layout="vertical">
          <a-row :gutter="12">
            <a-col :span="10">
              <a-form-item label="选择文件">
                <a-upload :auto-upload="false" :limit="1" accept=".jar,.csv,.properties,.props,.xlsx,.xls" @before-upload="handleAttBeforeUpload" />
              </a-form-item>
            </a-col>
            <a-col :span="6">
              <a-form-item label="文件类型">
                <a-select v-model="attFileType" placeholder="自动识别">
                  <a-option value="jar">jar (插件)</a-option>
                  <a-option value="csv">csv (数据)</a-option>
                  <a-option value="props">props (配置)</a-option>
                  <a-option value="xlsx">xlsx (Excel数据)</a-option>
                  <a-option value="data">data (其他)</a-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :span="5">
              <a-form-item label="部署目录">
                <a-input v-model="attTargetDir" placeholder="lib/ext" />
              </a-form-item>
            </a-col>
            <a-col :span="3">
              <a-form-item label=" ">
                <a-button type="primary" :loading="attUploading" @click="handleAttUpload">上传</a-button>
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
      </a-card>
<a-table
  column-resizable
        :loading="attachmentLoading"
        :data="attachmentList"
        :columns="attachmentColumns"
        :pagination="false"
        row-key="id"
        size="small"
        :scroll="{ x: 700 }"
      >
        <template #att_type="{ record }">
          <a-tag :color="record.file_type === 'jar' ? 'blue' : record.file_type === 'csv' ? 'green' : record.file_type === 'props' ? 'orange' : 'gray'" size="small">
            {{ record.file_type }}
          </a-tag>
        </template>
        <template #att_size="{ record }">{{ formatFileSize(record.file_size) }}</template>
        <template #att_ops="{ record }">
          <a-space>
            <a-button type="text" size="small" @click="handleAttDownload(record)">下载</a-button>
            <a-popconfirm content="确认删除此附件？" @ok="handleAttDelete(record)">
              <a-button type="text" size="small" status="danger">删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </a-table>
    </a-drawer>

    <!-- 版本历史抽屉 -->
    <a-drawer :visible="versionVisible" :width="760" :title="`版本历史 - ${versionScriptName}`" @cancel="versionVisible = false" @ok="versionVisible = false">
      <a-table
        column-resizable
        :loading="versionLoading"
        :data="versionList"
        :columns="versionColumns"
        :pagination="false"
        row-key="id"
        size="small"
        :scroll="{ x: 800 }"
      >
        <template #v_version="{ record }">
          <a-tag :color="record.is_current ? 'green' : 'blue'" size="small">{{ record.version }}{{ record.is_current ? ' (当前)' : '' }}</a-tag>
        </template>
        <template #v_size="{ record }">{{ formatFileSize(record.jmx_file_size) }}</template>
        <template #v_created="{ record }">{{ formatTime(record.created_at) }}</template>
        <template #v_ops="{ record }">
          <a-button type="text" size="small" @click="handleDownloadVersionJmx(record)">下载JMX</a-button>
        </template>
      </a-table>
    </a-drawer>

    <!-- 更新JMX弹窗 -->
    <a-modal v-model:visible="updateJmxVisible" :title="`更新JMX - ${updateJmxScriptName}`" :width="520" :ok-loading="updateJmxLoading" @ok="handleUpdateJmxSubmit">
      <a-alert type="info" :style="{ marginBottom: '12px' }">
        上传新JMX文件将自动保存当前版本到历史记录，并更新脚本文件和版本号。
      </a-alert>
      <a-form layout="vertical">
        <a-form-item label="选择JMX文件" required>
          <a-upload :auto-upload="false" :limit="1" accept=".jmx" @before-upload="handleUpdateJmxBeforeUpload" />
        </a-form-item>
        <a-form-item label="变更说明">
          <a-textarea v-model="updateJmxChangeLog" placeholder="如：适配3月迭代功能变更" :auto-size="{ minRows: 2, maxRows: 4 }" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.perf-script { padding: 0; }
</style>
