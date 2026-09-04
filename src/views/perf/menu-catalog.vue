<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import { Message, type TreeNodeData } from '@arco-design/web-vue'

// 本页构造树时往节点上额外挂了 extra（区分菜单/按钮并带业务 id）和 is_leaf，
// arco 的 TreeNodeData 没有这两个字段（它自己的是 isLeaf），所以在这里补上真实结构。
interface CatalogTreeNode extends TreeNodeData {
  extra?: { type?: string, id?: string, form_id?: string, [k: string]: unknown }
  is_leaf?: boolean
  children?: CatalogTreeNode[]
}
import { formatTime, postAction, putAction, useGet, useTableAutoHeight, withTableDefaults } from '@/hooks'
import { ApiPerfEnv, ApiPerfApp, ApiPerfMenu, ApiSysDictData, ApiSecProjectGroup } from '@/api/apis'
import SyncMenuModal from './components/SyncMenuModal.vue'
import AutoMatchModal from './components/AutoMatchModal.vue'

defineOptions({ name: 'menu-catalog' })

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

// ── 环境选择（按产品线过滤）──────────────────────────
const sourceEnvId = ref('')
const { data: envData, execute: fetchEnvList } = useGet<any>(ApiPerfEnv.getList, computed(() => ({ page_num: 1, page_size: 100, product_line: productLine.value })), { immediate: false })
const envOptions = computed(() => (envData.value?.list || []).map((e: any) => ({ label: e.env_name, value: e.id })))

// ── 领域选项（产品领域字典 sec_pg_product_domain）──────────────────────────
const { data: appData, execute: fetchAppList } = useGet<any>(ApiPerfApp.getList, computed(() => ({ product_line: productLine.value })), { immediate: false })
const { data: domainDictRaw } = useGet<any>(ApiSysDictData.getByType, { dict_type: 'sec_pg_product_domain' }, { immediate: true })
const domainOptions = computed(() => (Array.isArray(domainDictRaw.value) ? domainDictRaw.value : []).map((d: any) => ({ label: d.dict_label, value: d.dict_value })))

// ── 项目组选项（从 sec_project_group 获取，按领域过滤）──────────────────────────
const { data: pgRawData, execute: fetchPgList } = useGet<any>(ApiSecProjectGroup.getAll, {}, { immediate: true })
const projectGroupOptions = computed(() => {
  const all = Array.isArray(pgRawData.value) ? pgRawData.value : []
  const dc = menuQuery.value.domain_code
  const filtered = dc ? all.filter((pg: any) => pg.product_group_name === dc) : all
  return filtered.map((pg: any) => ({ label: pg.name, value: pg.name }))
})

// ── 菜单列表查询 ──────────────────────────────────
const menuQuery = ref({
  page_num: 1,
  page_size: 20,
  product_line: '',
  app_id: '',
  parent_id: '',
  keyword: '',
  in_test_scope: '',
  domain_code: '',
  project_group_name: '',
})

// 领域默认选择（读取 is_default='Y' 的字典项，必须在 menuQuery 定义之后）
const domainResolved = ref(false)
watch(domainDictRaw, (val) => {
  if (domainResolved.value) return
  if (!Array.isArray(val)) return
  domainResolved.value = true
  if (!menuQuery.value.domain_code && val.length > 0) {
    const defaultItem = val.find((d: any) => d.is_default === 'Y')
    if (defaultItem) {
      // 设置默认领域 → domain_code watch 会触发 fetch
      menuQuery.value.domain_code = defaultItem.dict_value
      return
    }
  }
  // 没有默认领域，如果产品线已就绪则直接 fetch
  if (productLine.value) {
    fetchTree()
    fetchStats()
    getMenuList()
  }
}, { immediate: true })

const { isFetching: menuLoading, data: menuRawData, execute: getMenuList } = useGet<any>(ApiPerfMenu.getList, menuQuery, { immediate: false })
const menuList = computed(() => menuRawData.value?.list || [])
const menuTotal = computed(() => menuRawData.value?.total || 0)

function handleMenuSearch() {
  menuQuery.value.page_num = 1
  getMenuList()
}
function handleMenuPageChange(page: number) {
  menuQuery.value.page_num = page
  getMenuList()
}

const menuColumns = withTableDefaults([
  { title: '菜单名称', dataIndex: 'menu_name', width: 180 },
  { title: '完整路径', dataIndex: 'full_path', width: 200 },
  { title: '领域', dataIndex: 'domain_name', width: 100 },
  { title: '表单ID', dataIndex: 'form_id', width: 100 },
  { title: '实体ID', dataIndex: 'entity_id', width: 100 },
  { title: '项目组', dataIndex: 'project_group_name', width: 130 },
  { title: '来源环境', dataIndex: 'source_env_name', width: 90 },
  { title: '同步时间', dataIndex: 'synced_at', width: 140, slotName: 'synced_at' },
  { title: '同步人', dataIndex: 'synced_by_name', width: 70 },
  { title: '测试范围', dataIndex: 'in_test_scope', width: 90, slotName: 'in_test_scope' },
  { title: '操作', dataIndex: 'operations', slotName: 'operations', width: 90, fixed: 'right' as const },
])

// ── 批量选择 ──────────────────────────────────
const selectedMenuIds = ref<string[]>([])

function handleSelectionChange(keys: (string | number)[]) {
  selectedMenuIds.value = keys.map(String)
}

// ── 测试范围 ──────────────────────────────────
async function handleSetScope(inScope: string) {
  if (selectedMenuIds.value.length === 0) { Message.warning('请先勾选菜单'); return }
  const res = await putAction(ApiPerfMenu.scope, { menu_ids: selectedMenuIds.value, in_test_scope: inScope })
  if (!res) return
  Message.success(`已${inScope === '1' ? '纳入' : '移出'}测试范围`)
  selectedMenuIds.value = []
  getMenuList()
  fetchStats()
}

async function handleToggleScope(record: any) {
  const newScope = record.in_test_scope === '1' ? '0' : '1'
  const res = await putAction(ApiPerfMenu.scope, { menu_ids: [record.id], in_test_scope: newScope })
  if (!res) return
  Message.success(`已${newScope === '1' ? '纳入' : '移出'}测试范围`)
  getMenuList()
  fetchStats()
}

// ── 统计面板 ──────────────────────────────────
const { data: statsData, isFetching: statsLoading, execute: fetchStats } = useGet<any>(ApiPerfMenu.stats, computed(() => ({ product_line: productLine.value, domain_code: menuQuery.value.domain_code || undefined, project_group_name: menuQuery.value.project_group_name || undefined })), { immediate: false })

// ── 左侧树 ──────────────────────────────────
const treeData = ref<any[]>([])
const selectedKeys = ref<string[]>([])
const expandedKeys = ref<string[]>([])
const selectedNode = ref<any>(null)
const treeLoading = ref(false)
const loadedButtonKeys = ref<Set<string>>(new Set())

const { data: treeRawData, execute: fetchTree } = useGet<any[]>(ApiPerfMenu.tree, computed(() => ({ product_line: productLine.value, domain_code: menuQuery.value.domain_code || undefined, project_group_name: menuQuery.value.project_group_name || undefined })), { immediate: false })

watch(treeRawData, (val) => {
  treeData.value = Array.isArray(val) ? val : []
})

function findTreeNode(nodes: any[], key: string): any | null {
  for (const node of nodes) {
    if (node.key === key) return node
    if (node.children?.length) {
      const found = findTreeNode(node.children, key)
      if (found) return found
    }
  }
  return null
}

async function handleTreeExpand(_keys: (string | number)[], data: { expanded?: boolean; expandedNodes: CatalogTreeNode[]; node?: CatalogTreeNode; e?: Event }) {
  if (!data.expanded) return
  const node = data.node
  if (!node) return
  const extra = node.extra
  if (extra?.type !== 'menu' || !extra?.form_id) return
  const key = String(node.key)
  if (loadedButtonKeys.value.has(key)) return

  // 如果该菜单已有子菜单（非按钮节点），说明不是末级菜单，不加载按钮到树中
  const hasMenuChildren = (node.children || []).some((c: any) => c.extra?.type !== 'button')
  if (hasMenuChildren) return

  loadedButtonKeys.value.add(key)

  try {
    const { data: btnData, execute } = useGet<any[]>(ApiPerfMenu.buttons, {
      product_line: productLine.value,
      env_id: sourceEnvId.value,
      form_number: extra.form_id,
    }, { immediate: false })
    await execute()
    const buttons = Array.isArray(btnData.value) ? btnData.value : []
    const btnChildren = buttons.map((b: any) => ({
      key: `btn_${b.id}`,
      title: `${b.is_important === '1' ? '★ ' : ''}${b.button_name}`,
      is_leaf: true,
      children: [],
      extra: { type: 'button', id: b.id, button_name: b.button_name, button_key: b.button_key, is_important: b.is_important },
    }))

    const targetNode = findTreeNode(treeData.value, key)
    if (targetNode) {
      // 仅在没有子菜单时才用按钮填充
      const existingMenuChildren = (targetNode.children || []).filter((c: any) => c.extra?.type !== 'button')
      if (existingMenuChildren.length === 0) {
        targetNode.children = btnChildren
        targetNode.is_leaf = btnChildren.length === 0
        if (btnChildren.length === 0) {
          targetNode.title = targetNode.title + ' (无按钮)'
        }
      }
    }
  } catch (e) {
    loadedButtonKeys.value.delete(key)
  }
}

function handleTreeSelect(keys: (string | number)[], data: { selected?: boolean; selectedNodes: CatalogTreeNode[]; node?: CatalogTreeNode; e?: Event }) {
  selectedKeys.value = keys.map(String)
  selectedNode.value = data?.node || null
  const extra = data?.node?.extra
  const node = data?.node

  // 点击有子节点的节点时，自动展开下一级
  if (node && node.children && node.children.length > 0 && !node.is_leaf) {
    const nodeKey = String(node.key)
    if (!expandedKeys.value.includes(nodeKey)) {
      expandedKeys.value = [...expandedKeys.value, nodeKey]
    }
  }

  if (extra?.type === 'menu' && extra?.form_id) {
    // 判断是否有子菜单（非按钮节点）
    const hasMenuChildren = (node?.children || []).some((c: any) => c.extra?.type === 'menu')
    if (!hasMenuChildren) {
      // 真正的末级菜单 — 显示按钮面板
      currentFormNumber.value = extra.form_id
      buttonQuery.value.keyword = ''
      buttonQuery.value.is_important = ''
      getButtonList()
      return
    }
    // 有子菜单 — 走菜单列表逻辑
    menuQuery.value.app_id = ''
    menuQuery.value.parent_id = extra.id ?? ''
    menuQuery.value.page_num = 1
    getMenuList()
  } else if (extra?.type === 'button') {
    // 按钮节点 — 保持父菜单的按钮面板
  } else {
    if (extra?.type === 'menu') {
      menuQuery.value.app_id = ''
      menuQuery.value.parent_id = extra.id ?? ''
    } else if (extra?.type === 'app') {
      menuQuery.value.app_id = extra.id ?? ''
      menuQuery.value.parent_id = ''
    } else {
      menuQuery.value.app_id = ''
      menuQuery.value.parent_id = ''
    }
    menuQuery.value.page_num = 1
    getMenuList()
  }
}

const selectedNodeType = computed(() => {
  const extra = selectedNode.value?.extra
  if (!extra) return 'root'
  if (extra.type === 'button') return 'button'
  if (extra.type === 'menu' && extra.form_id) {
    // 有子菜单的菜单节点 → 显示菜单列表（下级菜单）
    const node = selectedNode.value
    const hasMenuChildren = (node?.children || []).some((c: any) => c.extra?.type === 'menu')
    if (!hasMenuChildren) return 'leaf-menu' // 真正的末级菜单 — 显示按钮面板
  }
  return 'menu-list'
})

// ── 产品线变化联动 ──────────────────────────────────
watch(productLine, (val) => {
  sourceEnvId.value = ''
  treeData.value = []
  selectedKeys.value = []
  expandedKeys.value = []
  selectedNode.value = null
  loadedButtonKeys.value.clear()
  if (val) {
    menuQuery.value.product_line = val
    menuQuery.value.page_num = 1
    fetchEnvList()
    fetchAppList()
    // 等领域字典加载完成后再 fetch tree/stats/list（避免双重请求被掐断）
    if (domainResolved.value) {
      fetchTree()
      fetchStats()
      getMenuList()
    }
  }
})

// ── 领域 / 项目组变化联动：左树 + 统计 + 列表 ──────────────────────────────
let skipPgWatch = false

watch(() => menuQuery.value.domain_code, () => {
  // 领域变化时清空项目组（选项已变），并刷新所有
  if (menuQuery.value.project_group_name) {
    skipPgWatch = true
    menuQuery.value.project_group_name = ''
  }
  if (productLine.value) {
    loadedButtonKeys.value.clear()
    selectedKeys.value = []
    expandedKeys.value = []
    selectedNode.value = null
    menuQuery.value.app_id = ''
    menuQuery.value.parent_id = ''
    menuQuery.value.page_num = 1
    fetchTree()
    fetchStats()
    getMenuList()
  }
})

watch(() => menuQuery.value.project_group_name, () => {
  if (skipPgWatch) {
    skipPgWatch = false
    return
  }
  if (productLine.value) {
    loadedButtonKeys.value.clear()
    selectedKeys.value = []
    expandedKeys.value = []
    selectedNode.value = null
    menuQuery.value.app_id = ''
    menuQuery.value.parent_id = ''
    menuQuery.value.page_num = 1
    fetchTree()
    fetchStats()
    getMenuList()
  }
})

// ════════════════════════════════════════════════════
// 同步菜单 — 弹窗
// ════════════════════════════════════════════════════
const syncMenuVisible = ref(false)

function openSyncMenuModal() {
  syncMenuVisible.value = true
}

function handleSyncSuccess() {
  loadedButtonKeys.value.clear()
  fetchTree()
  fetchStats()
  getMenuList()
}

// ════════════════════════════════════════════════════
// 自动匹配项目组
// ════════════════════════════════════════════════════
const autoMatchLoading = ref(false)
const autoMatchResult = ref<any>(null)
const autoMatchVisible = ref(false)

async function handleAutoMatchPg() {
  if (!productLine.value) { Message.warning('请先选择产品线'); return }
  autoMatchLoading.value = true
  try {
    const payload: any = { product_line: productLine.value }
    if (selectedMenuIds.value.length > 0) {
      payload.menu_ids = selectedMenuIds.value
    }
    const res = await postAction<any>(ApiPerfMenu.autoMatchPg, payload)
    if (!res) return
    autoMatchResult.value = res
    autoMatchVisible.value = true
    Message.success('自动匹配完成')
    getMenuList()
    fetchStats()
  } finally {
    autoMatchLoading.value = false
  }
}

// ════════════════════════════════════════════════════
// 按钮面板
// ════════════════════════════════════════════════════

const currentFormNumber = ref('')
const buttonQuery = ref({ keyword: '', is_important: '' })
const selectedButtonIds = ref<string[]>([])
const tableInfo = ref<any>(null)

const { isFetching: buttonLoading, data: buttonRawData, execute: getButtonList } = useGet<any>(ApiPerfMenu.buttons, computed(() => ({
  product_line: productLine.value,
  env_id: sourceEnvId.value,
  form_number: currentFormNumber.value,
  keyword: buttonQuery.value.keyword,
  is_important: buttonQuery.value.is_important,
})), { immediate: false })

const buttonList = computed(() => Array.isArray(buttonRawData.value) ? buttonRawData.value : [])

const buttonColumns = withTableDefaults([
  { title: '按钮名称', dataIndex: 'button_name', width: 120 },
  { title: 'Button Key', dataIndex: 'button_key', width: 120 },
  { title: '类型', dataIndex: 'button_type', width: 80 },
  { title: '关键按钮', dataIndex: 'is_important', width: 80, slotName: 'is_important' },
  { title: '排序', dataIndex: 'sort_seq', width: 50 },
])

function handleButtonSearch() { getButtonList() }

function handleButtonSelectionChange(keys: (string | number)[]) {
  selectedButtonIds.value = keys.map(String)
}

async function handleMarkButtons(isImportant: string) {
  if (selectedButtonIds.value.length === 0) { Message.warning('请先勾选按钮'); return }
  const res = await putAction(ApiPerfMenu.markButtons, { ids: selectedButtonIds.value, is_important: isImportant })
  if (!res) return
  Message.success(isImportant === '1' ? '已标记为关键按钮' : '已取消关键标记')
  selectedButtonIds.value = []
  getButtonList()
  fetchStats()
}

async function handleToggleButtonImportant(record: any) {
  const newVal = record.is_important === '1' ? '0' : '1'
  const res = await putAction(ApiPerfMenu.markButtons, { ids: [record.id], is_important: newVal })
  if (!res) return
  getButtonList()
  fetchStats()
}

// ── 表信息（环境相关）──────────────────────────────
const { data: tableInfoData, execute: fetchTableInfo } = useGet<any>(ApiPerfMenu.tableInfo, computed(() => ({
  env_id: sourceEnvId.value,
  form_number: currentFormNumber.value,
})), { immediate: false })

watch(tableInfoData, (val) => {
  tableInfo.value = val
}, { immediate: true })

watch([sourceEnvId, currentFormNumber], () => {
  if (sourceEnvId.value && currentFormNumber.value) {
    fetchTableInfo()
  } else {
    tableInfo.value = null
  }
}, { immediate: false })

// 表格高度自适应（滚动条在表格内、表头固定）；右侧按钮面板与菜单列表面板各一个容器，
// 因为两者上方的信息条/操作栏高度不同，分别测量才准
const menuTableWrap = ref<HTMLElement>()
const { tableHeight: menuTableHeight } = useTableAutoHeight(menuTableWrap)
const buttonTableWrap = ref<HTMLElement>()
const { tableHeight: buttonTableHeight } = useTableAutoHeight(buttonTableWrap)
</script>

<template>
  <div class="perf-menu-catalog">
    <!-- 顶部操作栏 -->
    <a-card :bordered="false" class="m-b-8px top-bar">
      <!-- 查询筛选行（带标签）-->
      <div class="filter-row">
        <div class="filter-item">
          <span class="filter-label">产品线</span>
          <a-select v-model="productLine" :options="productLineOptions" placeholder="选择产品线" allow-search style="width: 150px" />
        </div>
        <div class="filter-item">
          <span class="filter-label">环境</span>
          <a-select v-model="sourceEnvId" :options="envOptions" placeholder="选择环境" allow-search :disabled="!productLine" style="width: 150px" />
        </div>
        <div class="filter-item">
          <span class="filter-label">菜单名称</span>
          <a-input v-model="menuQuery.keyword" placeholder="搜索菜单名称" allow-clear style="width: 160px" @press-enter="handleMenuSearch" />
        </div>
        <div class="filter-item">
          <span class="filter-label">领域</span>
          <a-select v-model="menuQuery.domain_code" :options="domainOptions" placeholder="全部领域" allow-clear style="width: 130px" />
        </div>
        <div class="filter-item">
          <span class="filter-label">项目组</span>
          <a-select v-model="menuQuery.project_group_name" :options="projectGroupOptions" placeholder="全部项目组" allow-search allow-clear style="width: 150px" />
        </div>
        <div class="filter-item">
          <span class="filter-label">测试范围</span>
          <a-select v-model="menuQuery.in_test_scope" placeholder="全部" allow-clear style="width: 100px" @change="handleMenuSearch">
            <a-option value="1">已纳入</a-option>
            <a-option value="0">未纳入</a-option>
          </a-select>
        </div>
        <a-button type="primary" @click="handleMenuSearch">
          <template #icon><icon-search /></template>
          搜索
        </a-button>
      </div>

      <!-- 统计数字 -->
      <div class="stats-row" :class="{ 'stats-loading': statsLoading }">
        <a-spin v-if="statsLoading" class="stats-spin" />
        <template v-if="statsData && !statsLoading">
        <a-statistic title="云" :value="statsData.cloud_count || 0" />
        <a-divider direction="vertical" />
        <a-statistic title="应用" :value="statsData.app_count || 0" />
        <a-divider direction="vertical" />
        <a-statistic title="菜单" :value="statsData.total_menus || 0" />
        <a-divider direction="vertical" />
        <a-statistic title="按钮" :value="statsData.button_count || 0" />
        <a-divider direction="vertical" />
        <a-statistic title="关键按钮" :value="statsData.important_button_count || 0" :value-style="{ color: '#ff7d00' }" />
        <a-divider direction="vertical" />
        <a-statistic title="测试范围内" :value="statsData.in_scope_menus || 0" :value-style="{ color: '#00b42a' }" />
        </template>
      </div>
    </a-card>

    <a-card :bordered="false" v-if="!productLine">
      <a-empty description="请先选择产品线" />
    </a-card>

    <div v-else class="catalog-layout">
      <!-- 左侧树 -->
      <a-card :bordered="false" class="tree-panel">
        <template #title>云 / 应用 / 菜单</template>
        <a-spin :loading="treeLoading" style="width: 100%">
          <a-tree
            :data="treeData"
            v-model:selected-keys="selectedKeys"
            v-model:expanded-keys="expandedKeys"
            :field-names="{ key: 'key', title: 'title', children: 'children' }"
            block-node
            :default-expand-all="false"
            @select="handleTreeSelect"
            @expand="handleTreeExpand"
          />
        </a-spin>
      </a-card>

      <!-- 右侧动态面板 -->
      <a-card :bordered="false" class="table-panel">
        <!-- 按钮面板（叶子菜单选中时）-->
        <template v-if="selectedNodeType === 'leaf-menu' || selectedNodeType === 'button'">
          <!-- 表信息条 -->
          <a-descriptions :column="4" layout="inline-horizontal" bordered size="small" class="m-b-8px" v-if="tableInfo">
            <a-descriptions-item label="表单">{{ tableInfo.form_number }}</a-descriptions-item>
            <a-descriptions-item label="数据库路由">{{ tableInfo.db_route_key }}</a-descriptions-item>
            <a-descriptions-item label="主表">{{ tableInfo.main_table }}</a-descriptions-item>
            <a-descriptions-item label="行数">{{ tableInfo.row_count ?? '-' }}</a-descriptions-item>
            <a-descriptions-item label="空间占用">{{ tableInfo.total_size_human ?? '-' }}</a-descriptions-item>
            <a-descriptions-item label="统计同步时间">{{ formatTime(tableInfo.synced_at) }}</a-descriptions-item>
          </a-descriptions>

          <!-- 按钮筛选栏 -->
          <a-row :gutter="16" class="m-b-8px">
            <a-col :span="6">
              <a-input-search v-model="buttonQuery.keyword" placeholder="搜索按钮名称" allow-clear @search="handleButtonSearch" @press-enter="handleButtonSearch" />
            </a-col>
            <a-col :span="4">
              <a-select v-model="buttonQuery.is_important" placeholder="关键按钮" allow-clear @change="handleButtonSearch">
                <a-option value="1">仅关键按钮</a-option>
                <a-option value="0">非关键按钮</a-option>
              </a-select>
            </a-col>
            <a-col :span="14">
              <a-space>
                <a-button type="primary" @click="handleButtonSearch">搜索</a-button>
                <a-button status="success" :disabled="selectedButtonIds.length === 0" @click="handleMarkButtons('1')">标记关键</a-button>
                <a-button status="warning" :disabled="selectedButtonIds.length === 0" @click="handleMarkButtons('0')">取消标记</a-button>
              </a-space>
            </a-col>
          </a-row>

          <div ref="buttonTableWrap">
<a-table
  column-resizable
            :loading="buttonLoading"
            :data="buttonList"
            :columns="buttonColumns"
            :pagination="false"
            :scroll="{ y: buttonTableHeight }"
            row-key="id"
            :row-selection="{ type: 'checkbox', showCheckedAll: true, selectedRowKeys: selectedButtonIds }"
            @selection-change="handleButtonSelectionChange"
          >
            <template #is_important="{ record }">
              <a-switch
                :model-value="record.is_important === '1'"
                checked-text="是" unchecked-text="否"
                @change="() => handleToggleButtonImportant(record)"
              />
            </template>
          </a-table>
          </div>
        </template>

        <!-- 菜单列表面板（非叶子节点选中时）-->
        <template v-else>
          <!-- 操作按钮行 -->
          <div class="action-bar">
            <a-button type="primary" status="success" :disabled="!productLine" @click="openSyncMenuModal">
              <template #icon><icon-refresh /></template>
              同步菜单
            </a-button>
            <a-dropdown-button type="primary" status="warning" :disabled="selectedMenuIds.length === 0">
              测试范围
              <template #icon><icon-down /></template>
              <template #content>
                <a-doption :disabled="selectedMenuIds.length === 0" @click="handleSetScope('1')">
                  <icon-check-circle /> 纳入测试范围
                </a-doption>
                <a-doption :disabled="selectedMenuIds.length === 0" @click="handleSetScope('0')">
                  <icon-close-circle /> 移出测试范围
                </a-doption>
              </template>
            </a-dropdown-button>
            <a-button
              type="primary"
              status="normal"
              :loading="autoMatchLoading"
              :disabled="!productLine"
              @click="handleAutoMatchPg"
            >
              <template #icon><icon-link /></template>
              自动匹配项目组
            </a-button>
          </div>

          <div ref="menuTableWrap">
<a-table
  column-resizable
            :loading="menuLoading"
            :data="menuList"
            :columns="menuColumns"
            :pagination="{ total: menuTotal, current: menuQuery.page_num, pageSize: menuQuery.page_size, showTotal: true, showPageSize: true }"
            :scroll="{ y: menuTableHeight, x: 1430 }"
            row-key="id"
            :row-selection="{ type: 'checkbox', showCheckedAll: true, selectedRowKeys: selectedMenuIds }"
            @selection-change="handleSelectionChange"
            @page-change="handleMenuPageChange"
          >
            <template #synced_at="{ record }">{{ formatTime(record.synced_at) }}</template>
            <template #in_test_scope="{ record }">
              <a-switch
                :model-value="record.in_test_scope === '1'"
                checked-text="纳入" unchecked-text="未纳入"
                @change="() => handleToggleScope(record)"
              />
            </template>
            <template #operations>
              <a-button type="text" size="small" disabled>
                生成脚本
              </a-button>
            </template>
          </a-table>
          </div>
        </template>
      </a-card>
    </div>

    <!-- 同步菜单弹窗 -->
    <SyncMenuModal
      v-model:visible="syncMenuVisible"
      :product-line="productLine"
      :source-env-id="sourceEnvId"
      :product-line-options="productLineOptions"
      @success="handleSyncSuccess"
    />

    <!-- 自动匹配项目组结果弹窗 -->
    <AutoMatchModal
      v-model:visible="autoMatchVisible"
      :result="autoMatchResult"
      :product-line="productLine"
      @modules-created="() => { getMenuList(); fetchStats() }"
    />
  </div>
</template>

<style scoped>
.perf-menu-catalog { padding: 0; }
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
.action-bar {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 10px;
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
.catalog-layout {
  display: flex;
  gap: 8px;
}
.tree-panel {
  width: 320px;
  min-width: 320px;
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
