<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useGet, usePost, usePut } from '@/hooks'
import { ApiPerfEnv, ApiPerfMenu } from '@/api/apis'

defineOptions({ name: 'PerfMenuCatalog' })

// ── 环境选择 ──────────────────────────────────
const envId = ref('')
const { data: envData } = useGet<any>(ApiPerfEnv.getList, { page_num: 1, page_size: 100 }, { immediate: true })
const envOptions = computed(() => (envData.value?.list || []).map((e: any) => ({ label: e.env_name, value: e.id })))

// ── 左侧树 ──────────────────────────────────
const treeData = ref<any[]>([])
const selectedKeys = ref<string[]>([])
const selectedNode = ref<any>(null)
const treeLoading = ref(false)

const { data: treeRawData, execute: fetchTree } = useGet<any[]>(ApiPerfMenu.tree, computed(() => ({ env_id: envId.value })), { immediate: false })

watch(envId, (val) => {
  if (val) {
    fetchTree()
  }
}, { immediate: false })

watch(treeRawData, (val) => {
  treeData.value = val || []
})

function handleTreeSelect(keys: string[], data: { node: any }) {
  selectedKeys.value = keys
  selectedNode.value = data?.node || null
  const extra = data?.node?.extra
  if (extra?.type === 'menu') {
    // 选中菜单节点：查该菜单的子菜单
    menuQuery.value.app_id = ''
    menuQuery.value.parent_id = extra.id
    menuQuery.value.env_id = envId.value
    menuQuery.value.page_num = 1
    getMenuList()
  } else if (extra?.type === 'app') {
    // 选中应用节点：查该应用下所有菜单
    menuQuery.value.app_id = extra.id
    menuQuery.value.parent_id = ''
    menuQuery.value.env_id = envId.value
    menuQuery.value.page_num = 1
    getMenuList()
  } else {
    // 选中 cloud 或其他：查所有菜单
    menuQuery.value.app_id = ''
    menuQuery.value.parent_id = ''
    menuQuery.value.env_id = envId.value
    menuQuery.value.page_num = 1
    getMenuList()
  }
}

// ── 统计面板 ──────────────────────────────────
const { data: statsData, execute: fetchStats } = useGet<any>(ApiPerfMenu.stats, computed(() => ({ env_id: envId.value })), { immediate: false })
watch(envId, () => { if (envId.value) fetchStats() })

// ── 右侧菜单列表 ──────────────────────────────────
const menuQuery = ref({
  page_num: 1,
  page_size: 20,
  env_id: '',
  app_id: '',
  parent_id: '',
  keyword: '',
  in_test_scope: '',
})

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

// 当 envId 变化时，初始化右侧列表
watch(envId, (val) => {
  if (val) {
    menuQuery.value.env_id = val
    menuQuery.value.page_num = 1
    getMenuList()
  }
})

const menuColumns = [
  { title: '菜单名称', dataIndex: 'menu_name', width: 200, ellipsis: true, tooltip: true },
  { title: '层级路径', dataIndex: 'sort_path', width: 90 },
  { title: '完整路径', dataIndex: 'full_path', width: 280, ellipsis: true, tooltip: true },
  { title: '表单ID', dataIndex: 'form_id', width: 110, ellipsis: true, tooltip: true },
  { title: '实体ID', dataIndex: 'entity_id', width: 110, ellipsis: true, tooltip: true },
  { title: '打开方式', dataIndex: 'open_type', width: 110, ellipsis: true, tooltip: true },
  { title: '测试范围', dataIndex: 'in_test_scope', width: 80, slot: 'in_test_scope' },
  { title: '操作', dataIndex: 'operations', slot: 'operations', width: 80, fixed: 'right' as const },
]

// ── 批量设置测试范围 ──────────────────────────────────
const selectedMenuIds = ref<string[]>([])

function handleSelectionChange(keys: string[]) {
  selectedMenuIds.value = keys
}

async function handleSetScope(inScope: string) {
  if (selectedMenuIds.value.length === 0) {
    Message.warning('请先勾选菜单')
    return
  }
  const { execute, error } = usePut(ApiPerfMenu.scope, {
    menu_ids: selectedMenuIds.value,
    in_test_scope: inScope,
  })
  await execute()
  if (error.value) { Message.error('设置失败'); return }
  Message.success(`已${inScope === '1' ? '纳入' : '移出'}测试范围`)
  selectedMenuIds.value = []
  getMenuList()
  fetchStats()
}

// ── 单个切换测试范围 ──────────────────────────────────
async function handleToggleScope(record: any) {
  const newScope = record.in_test_scope === '1' ? '0' : '1'
  const { execute, error } = usePut(ApiPerfMenu.scope, {
    menu_ids: [record.id],
    in_test_scope: newScope,
  })
  await execute()
  if (error.value) { Message.error('设置失败'); return }
  Message.success(`已${newScope === '1' ? '纳入' : '移出'}测试范围`)
  getMenuList()
  fetchStats()
}

// ── 同步菜单（从被测系统 meta 库拉取）──────────────────────────
const syncing = ref(false)
async function handleSync() {
  if (!envId.value) {
    Message.warning('请先选择环境')
    return
  }
  syncing.value = true
  try {
    const { execute, error, data } = usePost<any>(ApiPerfMenu.sync, { id: envId.value })
    await execute()
    if (error.value) { Message.error('同步失败，请查看环境同步状态'); return }
    const r = data.value
    Message.success(`同步成功：${r?.cloud_count ?? 0} 云 / ${r?.app_count ?? 0} 应用 / ${r?.menu_count ?? 0} 菜单`)
    fetchTree()
    fetchStats()
    getMenuList()
  } finally {
    syncing.value = false
  }
}
</script>

<template>
  <div class="perf-menu-catalog">
    <!-- 顶部环境选择栏 -->
    <a-card :bordered="false" class="m-b-8px">
      <a-row :gutter="16" align="center">
        <a-col :span="6">
          <a-select v-model="envId" :options="envOptions" placeholder="请选择环境" allow-search @change="() => { treeData = []; selectedKeys = []; selectedNode = null }" />
        </a-col>
        <a-col :span="4">
          <a-button type="primary" status="success" :loading="syncing" :disabled="!envId" @click="handleSync">
            <template #icon><icon-refresh /></template>
            同步菜单
          </a-button>
        </a-col>
        <a-col :span="14" v-if="statsData">
          <a-space size="large">
            <a-statistic title="云数" :value="statsData.cloud_count || 0" />
            <a-statistic title="应用数" :value="statsData.app_count || 0" />
            <a-statistic title="菜单总数" :value="statsData.total_menus || 0" />
            <a-statistic title="测试范围内" :value="statsData.in_scope_menus || 0" :value-style="{ color: '#00b42a' }" />
          </a-space>
        </a-col>
      </a-row>
    </a-card>

    <a-card :bordered="false" v-if="!envId">
      <a-empty description="请先选择环境" />
    </a-card>

    <div v-else class="catalog-layout">
      <!-- 左侧树 -->
      <a-card :bordered="false" class="tree-panel">
        <template #title>云 / 应用 / 菜单</template>
        <a-spin :loading="treeLoading" style="width: 100%">
          <a-tree
            :data="treeData"
            v-model:selected-keys="selectedKeys"
            :field-names="{ key: 'key', title: 'title', children: 'children' }"
            block-node
            @select="handleTreeSelect"
          />
        </a-spin>
      </a-card>

      <!-- 右侧菜单列表 -->
      <a-card :bordered="false" class="table-panel">
        <a-row :gutter="16" class="m-b-8px">
          <a-col :span="8">
            <a-input-search v-model="menuQuery.keyword" placeholder="搜索菜单名称" allow-clear @search="handleMenuSearch" @press-enter="handleMenuSearch" />
          </a-col>
          <a-col :span="6">
            <a-select v-model="menuQuery.in_test_scope" placeholder="测试范围" allow-clear @change="handleMenuSearch">
              <a-option value="1">已纳入</a-option>
              <a-option value="0">未纳入</a-option>
            </a-select>
          </a-col>
          <a-col :span="10">
            <a-space>
              <a-button type="primary" @click="handleMenuSearch">搜索</a-button>
              <a-button status="success" :disabled="selectedMenuIds.length === 0" @click="handleSetScope('1')">纳入测试范围</a-button>
              <a-button status="warning" :disabled="selectedMenuIds.length === 0" @click="handleSetScope('0')">移出测试范围</a-button>
            </a-space>
          </a-col>
        </a-row>

        <a-table
          :loading="menuLoading"
          :data="menuList"
          :columns="menuColumns"
          :pagination="{ total: menuTotal, current: menuQuery.page_num, pageSize: menuQuery.page_size, showTotal: true, showPageSize: true }"
          row-key="id"
          :row-selection="{ type: 'checkbox', showCheckedAll: true, selectedRowKeys: selectedMenuIds }"
          @selection-change="handleSelectionChange"
          @page-change="handleMenuPageChange"
        >
          <template #in_test_scope="{ record }">
            <a-switch
              :model-value="record.in_test_scope === '1'"
              checked-text="纳入" unchecked-text="未纳入"
              @change="() => handleToggleScope(record)"
            />
          </template>
          <template #operations="{ record }">
            <a-button type="text" size="small" @click="handleToggleScope(record)">
              {{ record.in_test_scope === '1' ? '移出' : '纳入' }}
            </a-button>
          </template>
        </a-table>
      </a-card>
    </div>
  </div>
</template>

<style scoped>
.perf-menu-catalog { padding: 0; }
.catalog-layout {
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
