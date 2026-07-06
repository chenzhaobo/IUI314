<script lang="ts" setup>
import { ref, computed } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useGet, usePost, usePut, useDelete } from '@/hooks'
import { ApiInfraHost, ApiInfraVm, ApiInfraService, ApiSysDictData, ErrorFlag } from '@/api/apis'

defineOptions({ name: 'infra-manage' })

// ── 字典数据 ──────────────────────────────────
const { data: vmRoleDict } = useGet<any>(ApiSysDictData.getByType, { dict_type: 'infra_vm_role' }, { immediate: true })
const vmRoleOptions = computed(() => (Array.isArray(vmRoleDict.value) ? vmRoleDict.value : []).map((d: any) => ({ label: d.dict_label, value: d.dict_value })))

const { data: serviceTypeDict } = useGet<any>(ApiSysDictData.getByType, { dict_type: 'infra_service_type' }, { immediate: true })
const serviceTypeOptions = computed(() => (Array.isArray(serviceTypeDict.value) ? serviceTypeDict.value : []).map((d: any) => ({ label: d.dict_label, value: d.dict_value })))

// ── 资源汇总 ──────────────────────────────────
const { data: summaryRaw, execute: fetchSummary } = useGet<any>(ApiInfraHost.summary, {}, { immediate: true })
const summary = computed(() => summaryRaw.value || {})

// ── 列表数据 ──────────────────────────────────
const queryParams = ref({ keyword: '', status: '', page_size: 999 })

const { isFetching: hostLoading, data: hostRaw, execute: fetchHosts } = useGet<any>(ApiInfraHost.getList, queryParams, { immediate: true })
const { isFetching: vmLoading, data: vmRaw, execute: fetchVms } = useGet<any>(ApiInfraVm.getList, queryParams, { immediate: true })
const { isFetching: serviceLoading, data: serviceRaw, execute: fetchServices } = useGet<any>(ApiInfraService.getList, queryParams, { immediate: true })

const hosts = computed(() => hostRaw.value?.list || [])
const vms = computed(() => vmRaw.value?.list || [])
const services = computed(() => serviceRaw.value?.list || [])
const isLoading = computed(() => hostLoading.value || vmLoading.value || serviceLoading.value)

function handleSearch() { fetchHosts(); fetchVms(); fetchServices() }

function refreshAll() { handleSearch(); fetchSummary() }

// ── 树表数据 ──────────────────────────────────
const treeData = computed(() => {
  return hosts.value.map((host: any) => ({
    key: `host-${host.id}`,
    id: host.id,
    type: 'host',
    name: host.host_name,
    ip: host.host_ip,
    role: '物理机',
    spec: `CPU:${host.cpu_total}核 | 内存:${host.memory_gb}GB | 存储:${host.storage_total_gb}GB`,
    status: host.status,
    remark: host.network_spec || '',
    raw: host,
    children: vms.value
      .filter((vm: any) => vm.host_id === host.id)
      .map((vm: any) => ({
        key: `vm-${vm.id}`,
        id: vm.id,
        type: 'vm',
        name: vm.vm_name,
        ip: vm.vm_ip,
        role: vm.vm_role,
        spec: `CPU:${vm.cpu_cores}核 | 内存:${vm.memory_gb}GB | 磁盘:${vm.disk_gb}GB`,
        status: vm.status,
        remark: vm.purpose || '',
        raw: vm,
        children: services.value
          .filter((s: any) => s.vm_id === vm.id)
          .map((s: any) => ({
            key: `service-${s.id}`,
            id: s.id,
            type: 'service',
            name: s.service_name,
            ip: s.port ? `:${s.port}` : '',
            role: s.service_type,
            spec: s.version || '',
            status: s.status,
            remark: s.conn_url || '',
            raw: s,
          })),
      })),
  }))
})

const columns = [
  { title: '名称', dataIndex: 'name', width: 220, ellipsis: true, tooltip: true },
  { title: 'IP/端口', dataIndex: 'ip', width: 150 },
  { title: '类型/角色', dataIndex: 'role', width: 100, slotName: 'role' },
  { title: '规格', dataIndex: 'spec', width: 280, ellipsis: true, tooltip: true },
  { title: '备注/用途', dataIndex: 'remark', width: 180, ellipsis: true, tooltip: true },
  { title: '状态', dataIndex: 'status', width: 70, slotName: 'status' },
  { title: '操作', dataIndex: 'operations', slotName: 'operations', width: 220, fixed: 'right' as const },
]

// ── 新增/编辑弹窗 ──────────────────────────────────
type ModalType = 'host' | 'vm' | 'service'
const modalVisible = ref(false)
const modalType = ref<ModalType>('host')
const isEdit = ref(false)
const form = ref<any>({})
const submitting = ref(false)

function handleAddHost() {
  modalType.value = 'host'; isEdit.value = false
  form.value = { host_name: '', host_ip: '', cpu_total: 0, memory_gb: 0, storage_spec: '', storage_total_gb: 0, network_spec: '', status: '1', remark: '' }
  modalVisible.value = true
}

function handleAddVm(hostId: string) {
  modalType.value = 'vm'; isEdit.value = false
  form.value = { host_id: hostId, vm_name: '', vm_ip: '', cpu_cores: 0, memory_gb: 0, disk_gb: 0, disk_detail: '', os_type: 'linux', vm_role: 'other', purpose: '', container_spec_text: '', status: '1', remark: '' }
  modalVisible.value = true
}

function handleAddService(vmId: string) {
  modalType.value = 'service'; isEdit.value = false
  form.value = { vm_id: vmId, service_name: '', service_type: 'other', port: null, version: '', conn_url: '', conn_params_text: '', status: '1', remark: '' }
  modalVisible.value = true
}

function handleEdit(record: any) {
  modalType.value = record.type as ModalType; isEdit.value = true
  const raw = { ...record.raw }
  if (raw.container_spec) raw.container_spec_text = JSON.stringify(raw.container_spec, null, 2)
  if (raw.conn_params) raw.conn_params_text = JSON.stringify(raw.conn_params, null, 2)
  form.value = raw
  modalVisible.value = true
}

async function handleSubmit() {
  const payload: any = { ...form.value }
  // 处理 JSON 字段
  if (modalType.value === 'vm' && payload.container_spec_text) {
    try { payload.container_spec = JSON.parse(payload.container_spec_text) } catch { Message.error('容器规格 JSON 格式错误'); return }
  } else if (modalType.value === 'vm') {
    payload.container_spec = null
  }
  delete payload.container_spec_text
  if (modalType.value === 'service' && payload.conn_params_text) {
    try { payload.conn_params = JSON.parse(payload.conn_params_text) } catch { Message.error('连接参数 JSON 格式错误'); return }
  } else if (modalType.value === 'service') {
    payload.conn_params = null
  }
  delete payload.conn_params_text

  submitting.value = true
  try {
    const api = modalType.value === 'host' ? ApiInfraHost : modalType.value === 'vm' ? ApiInfraVm : ApiInfraService
    let execFn: () => Promise<any>
    if (isEdit.value) {
      const { data, execute, error } = usePut(api.edit, payload)
      execFn = async () => { await execute(); return { data, error } }
    } else {
      const { data, execute, error } = usePost(api.add, payload)
      execFn = async () => { await execute(); return { data, error } }
    }
    const { data, error } = await execFn()
    if (error.value || data.value === ErrorFlag) { return }
    Message.success(isEdit.value ? '编辑成功' : '添加成功')
    modalVisible.value = false
    refreshAll()
  } finally {
    submitting.value = false
  }
}

// ── 删除 ──────────────────────────────────
async function handleDelete(record: any) {
  const api = record.type === 'host' ? ApiInfraHost : record.type === 'vm' ? ApiInfraVm : ApiInfraService
  const { data, execute, error } = useDelete(api.delete, { ids: [record.id] })
  await execute()
  if (error.value || data.value === ErrorFlag) { return }
  Message.success('删除成功')
  refreshAll()
}

// ── 展开/折叠 ──────────────────────────────────
const expandAll = ref(false)
const expandedKeys = ref<string[]>([])
function toggleExpandAll() {
  expandAll.value = !expandAll.value
  if (expandAll.value) {
    const keys: string[] = []
    treeData.value.forEach((h: any) => {
      keys.push(h.key)
      h.children?.forEach((v: any) => keys.push(v.key))
    })
    expandedKeys.value = keys
  } else {
    expandedKeys.value = []
  }
}

function getRoleLabel(value: string) {
  if (value === '物理机') return '物理机'
  const opts = modalType.value === 'vm' ? vmRoleOptions.value : serviceTypeOptions.value
  const found = opts.find((o: any) => o.value === value)
  return found?.label || value
}
</script>

<template>
  <div class="infra-manage">
    <!-- 资源汇总卡片 -->
    <a-card :bordered="false" class="m-b-8px">
      <a-row :gutter="16">
        <a-col :span="6">
          <a-statistic title="物理机数量" :value="summary.host_count || 0" />
        </a-col>
        <a-col :span="6">
          <a-statistic title="总 CPU (核)" :value="summary.cpu_total || 0" />
        </a-col>
        <a-col :span="6">
          <a-statistic title="总内存 (GB)" :value="summary.memory_gb || 0" />
        </a-col>
        <a-col :span="6">
          <a-statistic title="总存储 (GB)" :value="summary.storage_gb || 0" />
        </a-col>
      </a-row>
    </a-card>

    <!-- 查询区 -->
    <a-card :bordered="false" class="m-b-8px">
      <a-row :gutter="16" align="center">
        <a-col :span="8">
          <a-input-search v-model="queryParams.keyword" placeholder="搜索名称/IP" allow-clear @search="handleSearch" @press-enter="handleSearch" />
        </a-col>
        <a-col :span="4">
          <a-select v-model="queryParams.status" placeholder="状态" allow-clear @change="handleSearch">
            <a-option value="1">启用</a-option>
            <a-option value="0">禁用</a-option>
          </a-select>
        </a-col>
        <a-col :span="8">
          <a-space>
            <a-button type="primary" @click="handleSearch">搜索</a-button>
            <a-button @click="toggleExpandAll">{{ expandAll ? '折叠全部' : '展开全部' }}</a-button>
            <a-button type="primary" status="success" @click="handleAddHost">
              <template #icon><icon-plus /></template>
              新增物理机
            </a-button>
          </a-space>
        </a-col>
      </a-row>
    </a-card>

    <!-- 树表 -->
    <a-card :bordered="false">
      <a-table
        :loading="isLoading"
        :data="treeData"
        :columns="columns"
        v-model:expanded-keys="expandedKeys"
        row-key="key"
        :pagination="false"
        :scroll="{ x: 1200 }"
      >
        <template #role="{ record }">
          <a-tag v-if="record.type === 'host'" color="arcoblue">物理机</a-tag>
          <a-tag v-else-if="record.type === 'vm'" color="green">{{ getRoleLabel(record.role) }}</a-tag>
          <a-tag v-else color="orange">{{ getRoleLabel(record.role) }}</a-tag>
        </template>
        <template #status="{ record }">
          <a-tag :color="record.status === '1' ? 'green' : 'red'">{{ record.status === '1' ? '启用' : '禁用' }}</a-tag>
        </template>
        <template #operations="{ record }">
          <a-space>
            <a-button v-if="record.type === 'host'" type="text" size="small" status="success" @click="handleAddVm(record.id)">+虚拟机</a-button>
            <a-button v-if="record.type === 'vm'" type="text" size="small" status="success" @click="handleAddService(record.id)">+服务</a-button>
            <a-button type="text" size="small" @click="handleEdit(record)">编辑</a-button>
            <a-popconfirm content="确认删除？删除后不可恢复" @ok="handleDelete(record)">
              <a-button type="text" size="small" status="danger">删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑弹窗 -->
    <a-modal v-model:visible="modalVisible" :title="isEdit ? '编辑' : '新增'" :width="680" :ok-loading="submitting" @ok="handleSubmit">
      <a-form :model="form" layout="vertical">
        <!-- 物理机表单 -->
        <template v-if="modalType === 'host'">
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="物理机名称" required><a-input v-model="form.host_name" placeholder="如：物理机1" /></a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="IP地址" required><a-input v-model="form.host_ip" placeholder="如：172.20.180.230" /></a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :span="8"><a-form-item label="CPU核数"><a-input-number v-model="form.cpu_total" :min="0" /></a-form-item></a-col>
            <a-col :span="8"><a-form-item label="内存(GB)"><a-input-number v-model="form.memory_gb" :min="0" /></a-form-item></a-col>
            <a-col :span="8"><a-form-item label="存储总量(GB)"><a-input-number v-model="form.storage_total_gb" :min="0" /></a-form-item></a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :span="12"><a-form-item label="存储规格"><a-input v-model="form.storage_spec" placeholder="如：SSD RAID5, 5x3200G" /></a-form-item></a-col>
            <a-col :span="12"><a-form-item label="网络规格"><a-input v-model="form.network_spec" placeholder="如：交换机端口1GB" /></a-form-item></a-col>
          </a-row>
          <a-form-item label="状态">
            <a-radio-group v-model="form.status"><a-radio value="1">启用</a-radio><a-radio value="0">禁用</a-radio></a-radio-group>
          </a-form-item>
          <a-form-item label="备注"><a-textarea v-model="form.remark" :auto-size="{ minRows: 2, maxRows: 4 }" /></a-form-item>
        </template>

        <!-- 虚拟机表单 -->
        <template v-if="modalType === 'vm'">
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="虚拟机名称" required><a-input v-model="form.vm_name" placeholder="如：fi-db1.sz.kingdee.net" /></a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="IP地址" required><a-input v-model="form.vm_ip" placeholder="如：172.20.198.10" /></a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :span="6"><a-form-item label="CPU核数"><a-input-number v-model="form.cpu_cores" :min="0" /></a-form-item></a-col>
            <a-col :span="6"><a-form-item label="内存(GB)"><a-input-number v-model="form.memory_gb" :min="0" /></a-form-item></a-col>
            <a-col :span="6"><a-form-item label="磁盘(GB)"><a-input-number v-model="form.disk_gb" :min="0" :step="0.1" :precision="1" /></a-form-item></a-col>
            <a-col :span="6"><a-form-item label="角色"><a-select v-model="form.vm_role" :options="vmRoleOptions" /></a-form-item></a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :span="12"><a-form-item label="磁盘明细"><a-input v-model="form.disk_detail" placeholder="如：5368+10240" /></a-form-item></a-col>
            <a-col :span="6"><a-form-item label="操作系统"><a-input v-model="form.os_type" placeholder="linux" /></a-form-item></a-col>
            <a-col :span="6"><a-form-item label="状态"><a-select v-model="form.status"><a-option value="1">启用</a-option><a-option value="0">禁用</a-option></a-select></a-form-item></a-col>
          </a-row>
          <a-form-item label="用途"><a-input v-model="form.purpose" placeholder="如：PG主库, 压测/基准错峰" /></a-form-item>
          <a-form-item label="容器规格 (JSON, k8s节点用)">
            <a-textarea v-model="form.container_spec_text" :auto-size="{ minRows: 2, maxRows: 6 }" placeholder='{"count":2,"cpu":8,"memory_gb":200}' />
          </a-form-item>
          <a-form-item label="备注"><a-textarea v-model="form.remark" :auto-size="{ minRows: 2, maxRows: 4 }" /></a-form-item>
        </template>

        <!-- 服务实例表单 -->
        <template v-if="modalType === 'service'">
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="服务名称" required><a-input v-model="form.service_name" placeholder="如：PostgreSQL主库" /></a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="服务类型" required><a-select v-model="form.service_type" :options="serviceTypeOptions" /></a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :span="6"><a-form-item label="端口"><a-input-number v-model="form.port" :min="0" :max="65535" /></a-form-item></a-col>
            <a-col :span="6"><a-form-item label="版本"><a-input v-model="form.version" placeholder="如：15.4" /></a-form-item></a-col>
            <a-col :span="12"><a-form-item label="状态"><a-radio-group v-model="form.status"><a-radio value="1">启用</a-radio><a-radio value="0">禁用</a-radio></a-radio-group></a-form-item></a-col>
          </a-row>
          <a-form-item label="连接URL"><a-input v-model="form.conn_url" placeholder="如：postgresql://172.20.198.10:5432" /></a-form-item>
          <a-form-item label="连接参数 (JSON)">
            <a-textarea v-model="form.conn_params_text" :auto-size="{ minRows: 3, maxRows: 8 }" placeholder='{"database":"app_db_test","password":"xxx","pool_size":20}' />
          </a-form-item>
          <a-form-item label="备注"><a-textarea v-model="form.remark" :auto-size="{ minRows: 2, maxRows: 4 }" /></a-form-item>
        </template>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.infra-manage { padding: 0; }
</style>
