<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useGet, usePost, useDelete } from '@/hooks'
import { ApiPerfScript, ApiPerfScriptMenu, ApiPerfMenu, ApiSysDictData, ApiSecProjectGroup } from '@/api/apis'

defineOptions({ name: 'PerfScriptBinding' })

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

// ── 项目组选项（从 sec_project_group 获取，按领域过滤）──────────────────────────
const { data: pgRawData } = useGet<any>(ApiSecProjectGroup.getAll, {}, { immediate: true })
const projectGroupOptions = computed(() => {
  const all = Array.isArray(pgRawData.value) ? pgRawData.value : []
  const dc = domainCode.value
  const filtered = dc ? all.filter((pg: any) => pg.product_group_name === dc) : all
  return filtered.map((pg: any) => ({ label: pg.name, value: pg.name }))
})
const projectGroupName = ref('')

// ── 左侧菜单树 ──────────────────────────────────
const treeData = ref<any[]>([])
const selectedKeys = ref<string[]>([])
const selectedMenuId = ref('')
const selectedMenuName = ref('')

const { data: treeRawData, execute: fetchTree } = useGet<any[]>(ApiPerfMenu.tree, computed(() => ({ product_line: productLine.value, domain_code: domainCode.value || undefined, project_group_name: projectGroupName.value || undefined })), { immediate: false })

// 领域默认选择（读取 is_default='Y' 的字典项）
watch(domainDictRaw, (val) => {
  if (domainResolved.value) return
  if (!Array.isArray(val)) return
  domainResolved.value = true
  if (!domainCode.value && val.length > 0) {
    const defaultItem = val.find((d: any) => d.is_default === 'Y')
    if (defaultItem) {
      domainCode.value = defaultItem.dict_value
      return // domainCode watch 会触发 fetch
    }
  }
  // 没有默认领域，如果产品线已就绪则直接 fetch
  if (productLine.value) {
    fetchTree()
    fetchBindList()
  }
}, { immediate: true })

watch(productLine, (val) => {
  selectedKeys.value = []
  selectedMenuId.value = ''
  selectedMenuName.value = ''
  treeData.value = []
  if (val) {
    bindListQuery.value.product_line = val
    bindListQuery.value.menu_ids = ''
    bindListQuery.value.page_num = 1
    // 等领域字典加载完成后再 fetch（避免双重请求被斩断）
    if (domainResolved.value) {
      fetchTree()
      fetchBindList()
    }
  }
})

// ── 领域 / 项目组变化联动 ──────────────────────────────
let skipPgWatch = false

watch(domainCode, () => {
  // 领域变化时清空项目组
  if (projectGroupName.value) {
    skipPgWatch = true
    projectGroupName.value = ''
  }
  if (productLine.value && domainResolved.value) {
    selectedKeys.value = []
    selectedMenuId.value = ''
    selectedMenuName.value = ''
    bindListQuery.value.menu_ids = ''
    bindListQuery.value.domain_code = domainCode.value
    bindListQuery.value.project_group_name = ''
    bindListQuery.value.page_num = 1
    fetchTree()
    fetchBindList()
  }
})

watch(projectGroupName, () => {
  if (skipPgWatch) { skipPgWatch = false; return }
  if (productLine.value && domainResolved.value) {
    selectedKeys.value = []
    selectedMenuId.value = ''
    selectedMenuName.value = ''
    bindListQuery.value.menu_ids = ''
    bindListQuery.value.project_group_name = projectGroupName.value
    bindListQuery.value.page_num = 1
    fetchTree()
    fetchBindList()
  }
})

watch(treeRawData, (val) => {
  treeData.value = Array.isArray(val) ? val : []
})

/// 从 treeData 中按 key 查找完整节点（含 children 子树）
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

/// 递归收集节点及其所有子节点中的菜单 ID
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

function handleTreeSelect(keys: string[], data: { node: any }) {
  selectedKeys.value = keys
  bindListQuery.value.page_num = 1
  if (keys.length === 0) {
    // 取消选中 → 显示全部
    selectedMenuId.value = ''
    selectedMenuName.value = ''
    bindListQuery.value.menu_ids = ''
    fetchBindList()
    return
  }
  // 从 treeData 中查找完整节点（含 children），不依赖事件传递的 node
  const fullNode = findNodeByKey(treeData.value, keys[0]) || data?.node
  const extra = fullNode?.extra
  selectedMenuName.value = fullNode?.title || ''
  if (extra?.type === 'menu') {
    selectedMenuId.value = extra.id
  } else {
    selectedMenuId.value = ''
  }
  // 任何节点（cloud/app/menu）都递归收集其下所有菜单 ID
  const ids = collectMenuIds(fullNode)
  if (ids.length > 0) {
    bindListQuery.value.menu_ids = ids.join(',')
  } else {
    // 该节点下没有菜单 → 传不存在的 ID 确保返回空
    bindListQuery.value.menu_ids = '__none__'
  }
  fetchBindList()
}

// ── 右侧：脚本绑定列表 ──────────────────────────────────
const bindListQuery = ref({ page_num: 1, page_size: 20, menu_ids: '', product_line: '', domain_code: '', project_group_name: '' })
const { isFetching: bindLoading, data: bindListRaw, execute: fetchBindList } = useGet<any>(ApiPerfScriptMenu.getList, bindListQuery, { immediate: false })
const bindList = computed(() => bindListRaw.value?.list || [])
const bindTotal = computed(() => bindListRaw.value?.total || 0)
const boundScriptIds = computed(() => bindList.value.map((b: any) => b.script_id))

function handlePageChange(page: number) {
  bindListQuery.value.page_num = page
  fetchBindList()
}

const bindColumns = [
  { title: '菜单名称', dataIndex: 'menu_name', width: 200, ellipsis: true, tooltip: true },
  { title: '脚本名称', dataIndex: 'script_name', width: 200, ellipsis: true, tooltip: true },
  { title: '编码', dataIndex: 'script_code', width: 120 },
  { title: '版本', dataIndex: 'script_version', width: 60 },
  { title: '状态', dataIndex: 'script_status', width: 60, slotName: 'status' },
  { title: '测试场景', dataIndex: 'test_scenario', width: 200, ellipsis: true, tooltip: true },
  { title: '绑定时间', dataIndex: 'created_at', width: 160, slotName: 'created_at' },
  { title: '操作', dataIndex: 'operations', slotName: 'operations', width: 80, fixed: 'right' as const },
]

// ── 时间格式化 ──────────────────────────────────
function formatTime(time?: string | null) {
  if (!time) return '-'
  return time.replace('T', ' ').substring(0, 19)
}

// ── 解绑 ──────────────────────────────────
async function handleUnbind(record: any) {
  const { execute, error } = useDelete(ApiPerfScriptMenu.unbind, { ids: [record.id] })
  await execute()
  if (error.value) { Message.error('解绑失败'); return }
  Message.success('解绑成功')
  fetchBindList()
}

// ── 添加脚本弹窗 ──────────────────────────────────
const addVisible = ref(false)
const addSubmitting = ref(false)
const testScenario = ref('')
const scriptQuery = ref({ page_num: 1, page_size: 100, keyword: '' })
const { isFetching: scriptLoading, data: scriptRawData, execute: getScriptList } = useGet<any>(ApiPerfScript.getList, scriptQuery, { immediate: false })
const allScripts = computed(() => scriptRawData.value?.list || [])
const selectedScriptIds = ref<string[]>([])

function handleAddClick() {
  if (!selectedMenuId.value) {
    Message.warning('请先在左侧选择菜单节点')
    return
  }
  addVisible.value = true
  testScenario.value = ''
  scriptQuery.value.page_num = 1
  scriptQuery.value.keyword = ''
  selectedScriptIds.value = []
  getScriptList()
}

function handleScriptSearch() {
  scriptQuery.value.page_num = 1
  getScriptList()
}

const addColumns = [
  { title: '脚本名称', dataIndex: 'name', width: 200, ellipsis: true, tooltip: true },
  { title: '编码', dataIndex: 'code', width: 120 },
  { title: '版本', dataIndex: 'version', width: 60 },
  { title: '状态', dataIndex: 'status', width: 60, slotName: 'status' },
  { title: '绑定状态', dataIndex: 'bound', width: 90, slotName: 'bound' },
]

function handleSelectionChange(keys: string[]) {
  selectedScriptIds.value = keys
}

async function handleAddSubmit() {
  if (selectedScriptIds.value.length === 0) {
    Message.warning('请选择要绑定的脚本')
    return
  }
  addSubmitting.value = true
  let okCount = 0
  let failCount = 0
  for (const sid of selectedScriptIds.value) {
    const { execute, error } = usePost(ApiPerfScriptMenu.bind, {
      script_id: sid,
      menu_ids: [selectedMenuId.value],
      product_line: productLine.value,
      test_scenario: testScenario.value || undefined,
    })
    await execute()
    if (error.value) { failCount++ } else { okCount++ }
  }
  addSubmitting.value = false
  if (failCount > 0) {
    Message.warning(`绑定完成：成功${okCount}条，失败${failCount}条`)
  } else {
    Message.success(`绑定成功${okCount}条`)
  }
  addVisible.value = false
  fetchBindList()
}
</script>

<template>
  <div class="perf-script-bindng">
    <!-- 顶部筛选栏 -->
    <a-card :bordered="false" class="m-b-8px">
      <a-row :gutter="16" align="center">
        <a-col :span="5">
          <a-select v-model="productLine" :options="productLineOptions" placeholder="选择产品线" allow-search />
        </a-col>
        <a-col :span="5">
          <a-select v-model="domainCode" :options="domainOptions" placeholder="全部领域" allow-clear />
        </a-col>
        <a-col :span="5">
          <a-select v-model="projectGroupName" :options="projectGroupOptions" placeholder="全部项目组" allow-search allow-clear />
        </a-col>
      </a-row>
    </a-card>

    <a-card :bordered="false" v-if="!productLine">
      <a-empty description="请先选择产品线" />
    </a-card>

    <div v-else class="bind-layout">
      <!-- 左侧菜单树 -->
      <a-card :bordered="false" class="tree-panel">
        <template #title>云 / 应用 / 菜单</template>
        <a-tree
          :data="treeData"
          v-model:selected-keys="selectedKeys"
          :field-names="{ key: 'key', title: 'title', children: 'children' }"
          block-node
          @select="handleTreeSelect"
        />
      </a-card>

      <!-- 右侧脚本绑定列表 -->
      <a-card :bordered="false" class="table-panel">
        <template #title>
          {{ selectedMenuName ? `关联脚本 - ${selectedMenuName}` : '全部关联脚本' }}
        </template>
        <template #extra>
          <a-button type="primary" :disabled="!selectedMenuId" @click="handleAddClick">
            <template #icon><icon-plus /></template>
            添加脚本
          </a-button>
        </template>

        <a-table
          :loading="bindLoading"
          :data="bindList"
          :columns="bindColumns"
          row-key="id"
          :pagination="{ total: bindTotal, current: bindListQuery.page_num, pageSize: bindListQuery.page_size, showTotal: true, showPageSize: true }"
          size="small"
          @page-change="handlePageChange"
        >
          <template #created_at="{ record }">{{ formatTime(record.created_at) }}</template>
          <template #status="{ record }">
            <a-tag :color="record.script_status === '1' ? 'green' : 'red'">{{ record.script_status === '1' ? '启用' : '禁用' }}</a-tag>
          </template>
          <template #operations="{ record }">
            <a-popconfirm content="确认解绑？" @ok="handleUnbind(record)">
              <a-button type="text" size="small" status="danger">解绑</a-button>
            </a-popconfirm>
          </template>
        </a-table>
      </a-card>
    </div>

    <!-- 添加脚本弹窗 -->
    <a-modal v-model:visible="addVisible" title="添加脚本绑定" :width="900" :ok-loading="addSubmitting" @ok="handleAddSubmit" ok-text="绑定选中">
      <a-input v-model="testScenario" placeholder="测试场景（可选，如：列表查询基准测试）" allow-clear style="margin-bottom: 12px" />
      <a-input-search v-model="scriptQuery.keyword" placeholder="搜索脚本名称/编码" allow-clear style="margin-bottom: 12px" @search="handleScriptSearch" @press-enter="handleScriptSearch" />
      <a-table
        :loading="scriptLoading"
        :data="allScripts"
        :columns="addColumns"
        row-key="id"
        :pagination="false"
        size="small"
        :scroll="{ y: 360 }"
        :row-selection="{ type: 'checkbox', showCheckedAll: true, selectedRowKeys: selectedScriptIds }"
        @selection-change="handleSelectionChange"
      >
        <template #status="{ record }">
          <a-tag :color="record.status === '1' ? 'green' : 'red'">{{ record.status === '1' ? '启用' : '禁用' }}</a-tag>
        </template>
        <template #bound="{ record }">
          <a-tag v-if="boundScriptIds.includes(record.id)" color="arcoblue" size="small">已绑定</a-tag>
          <span v-else style="color: #999">-</span>
        </template>
      </a-table>
    </a-modal>
  </div>
</template>

<style scoped>
.perf-script-bindng { padding: 0; }
.bind-layout {
  display: flex;
  gap: 8px;
}
.tree-panel {
  width: 320px;
  min-width: 320px;
  max-height: calc(100vh - 220px);
  overflow-y: auto;
}
.table-panel {
  flex: 1;
  min-width: 0;
}
</style>
