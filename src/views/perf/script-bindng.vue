<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useGet, usePost, useDelete } from '@/hooks'
import { ApiPerfScript, ApiPerfEnv, ApiPerfScriptMenu, ApiPerfMenu } from '@/api/apis'

defineOptions({ name: 'PerfScriptBinding' })

// ── 环境选择 ──────────────────────────────────
const envId = ref('')
const { data: envData } = useGet<any>(ApiPerfEnv.getList, { page_num: 1, page_size: 100 }, { immediate: true })
const envOptions = computed(() => (envData.value?.list || []).map((e: any) => ({ label: e.env_name, value: e.id })))

// ── 左侧菜单树 ──────────────────────────────────
const treeData = ref<any[]>([])
const selectedKeys = ref<string[]>([])
const selectedMenuId = ref('')
const selectedMenuName = ref('')

const { data: treeRawData, execute: fetchTree } = useGet<any[]>(ApiPerfMenu.tree, computed(() => ({ env_id: envId.value })), { immediate: false })

watch(envId, (val) => {
  selectedKeys.value = []
  selectedMenuId.value = ''
  selectedMenuName.value = ''
  if (val) {
    fetchTree()
    // 默认加载全部绑定记录
    bindListQuery.value.env_id = val
    bindListQuery.value.menu_ids = ''
    bindListQuery.value.page_num = 1
    fetchBindList()
  } else {
    treeData.value = []
  }
}, { immediate: false })

watch(treeRawData, (val) => {
  treeData.value = val || []
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
  bindListQuery.value.env_id = envId.value
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
const bindListQuery = ref({ page_num: 1, page_size: 20, menu_ids: '', env_id: '' })
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
      env_id: envId.value,
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
    <!-- 顶部环境选择栏 -->
    <a-card :bordered="false" class="m-b-8px">
      <a-row :gutter="16" align="center">
        <a-col :span="6">
          <a-select v-model="envId" :options="envOptions" placeholder="请选择环境" allow-search />
        </a-col>
      </a-row>
    </a-card>

    <a-card :bordered="false" v-if="!envId">
      <a-empty description="请先选择环境" />
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
