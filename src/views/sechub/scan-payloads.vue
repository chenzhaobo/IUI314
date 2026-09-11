<script setup lang="ts">
/**
 * 安全扫描 — Payload 库管理
 *
 * 对应后端 `/sechub/scan/payloads`（api/src/sechub/scan_task.rs + service/sec_payload.rs）：
 *   - 列表：GET /sechub/scan/payloads（vuln_type / enabled=Y，无分页，直接返回数组）
 *   - 新增：POST /sechub/scan/payloads
 *   - 初始化内置：POST /sechub/scan/payloads/seed（幂等：库里已有数据则跳过）
 *   - 启停：POST /sechub/scan/payloads/{id}/toggle（body: {enabled: bool}）
 *   - 删除：POST /sechub/scan/payloads/{id}/delete
 *
 * 注入测试执行时按 vuln_type 批量读取 enabled='Y' 的 payload（设计文档 §12），
 * 所以本页只做「增删改查 + 启停」，不做 payload 内容编排。
 */
import { Message, Modal } from '@arco-design/web-vue'
import { computed, reactive, ref } from 'vue'

import { ApiSecScan, resolveStaticScanApi } from '@/api/sechubApis'
import ListPage from '@/components/common/ListPage.vue'
import { getAction, postAction, useGet } from '@/hooks'

// 组件名必须与路由 name（= sys_menu.path）一致，keep-alive :include 按它对上缓存
// （见 components/layout/app-main.vue 的注释）。lint 的 PascalCase 提示只是警告，
// 改名却会让页签缓存失效，所以此处保持 kebab-case。
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'scan-payloads' })

// ── 漏洞类型（sec_sec_payload.vuln_type）───────────
const VULN_TYPE: Record<string, { label: string, color: string }> = {
  xss: { label: 'XSS', color: 'orangered' },
  sqli: { label: 'SQL注入', color: 'purple' },
  java_reflect: { label: 'Java反射', color: 'arcoblue' },
}
const vulnTypeLabel = (v?: string | null) => (v ? VULN_TYPE[v]?.label || v : '--')
const vulnTypeColor = (v?: string | null) => VULN_TYPE[v || '']?.color || 'gray'

// ── 严重度（sec_sec_payload.severity）──────────────
const SEVERITY: Record<string, { label: string, color: string }> = {
  high: { label: '高', color: 'red' },
  medium: { label: '中', color: 'orange' },
  low: { label: '低', color: 'blue' },
}
const severityMeta = (v?: string | null) => SEVERITY[v || ''] || { label: v || '--', color: 'gray' }

// ── 检测方式（sec_sec_payload.detect_method）───────
const DETECT_METHODS = [
  { value: 'response_contains', label: '响应包含(response_contains)' },
  { value: 'response_time', label: '响应耗时(response_time)' },
  { value: 'error_keyword', label: '错误关键字(error_keyword)' },
]
const DETECT_METHOD_LABELS: Record<string, string> = {
  response_contains: '响应包含',
  response_time: '响应耗时',
  error_keyword: '错误关键字',
}
const detectMethodText = (v?: string | null) => (v ? DETECT_METHOD_LABELS[v] || v : '--')

// ── 筛选 ──────────────────────────────────────────
const searchForm = reactive({
  vuln_type: '',
  /** 仅看启用：后端 enabled=Y 时才过滤，空串即不过滤 */
  enabledOnly: false,
})

const queryParams = computed(() => ({
  vuln_type: searchForm.vuln_type,
  enabled: searchForm.enabledOnly ? 'Y' : '',
}))

// 该接口不分页：data 直接是 payload 数组（service/sec_payload.rs::list）
const {
  isFetching: loading,
  data: rawData,
  execute: fetchData,
} = useGet<any[]>(ApiSecScan.payloadList, queryParams, { immediate: true })

const tableData = computed(() => (Array.isArray(rawData.value) ? rawData.value : []))

// ── 初始化内置 Payload（幂等）──────────────────────
const seeding = ref(false)

async function handleSeed() {
  // 后端把新增条数放在响应 msg 里（Res::with_msg(&n)），而请求钩子只解包 data.data，
  // msg 到不了调用点，所以用「调用前后总条数差」还原本次真正写入了几条。
  const before = await getAction<any[]>(ApiSecScan.payloadList)
  if (before === null)
    return

  seeding.value = true
  try {
    const res = await postAction<string>(ApiSecScan.payloadSeed, {})
    if (res === null)
      return
    const after = await getAction<any[]>(ApiSecScan.payloadList)
    const added = after === null ? 0 : after.length - before.length
    if (added > 0)
      Message.success(`已初始化 ${added} 条内置 Payload`)
    else
      Message.info('库中已有 Payload，未重复写入（初始化是幂等的）')
    await fetchData()
  }
  finally {
    seeding.value = false
  }
}

// ── 新增 ──────────────────────────────────────────
const modalVisible = ref(false)
const modalLoading = ref(false)
const form = reactive({
  vuln_type: '',
  payload: '',
  description: '',
  severity: 'medium',
  detect_method: 'response_contains',
})

function openAdd() {
  form.vuln_type = ''
  form.payload = ''
  form.description = ''
  form.severity = 'medium'
  form.detect_method = 'response_contains'
  modalVisible.value = true
}

async function handleSubmit() {
  if (!form.vuln_type) {
    Message.warning('请选择漏洞类型')
    return
  }
  if (!form.payload.trim()) {
    Message.warning('请填写 Payload 内容')
    return
  }

  modalLoading.value = true
  try {
    const res = await postAction<string>(ApiSecScan.payloadList, {
      vuln_type: form.vuln_type,
      payload: form.payload.trim(),
      description: form.description || null,
      severity: form.severity,
      detect_method: form.detect_method || null,
    })
    if (res === null)
      return
    Message.success('新增成功')
    modalVisible.value = false
    await fetchData()
  }
  finally {
    modalLoading.value = false
  }
}

// ── 启停 ──────────────────────────────────────────
// 记录正在切换的行，避免同一行连点两次发出两个相反的请求
const togglingId = ref('')

async function handleToggle(record: any, enabled: boolean) {
  togglingId.value = record.id
  try {
    const res = await postAction<string>(resolveStaticScanApi(ApiSecScan.payloadToggle, { id: record.id }), { enabled })
    if (res === null)
      return
    Message.success(enabled ? '已启用' : '已禁用')
    await fetchData()
  }
  finally {
    togglingId.value = ''
  }
}

// ── 删除（物理删除：payload 是纯配置数据，无历史引用）──
function handleDelete(record: any) {
  Modal.confirm({
    title: '删除 Payload',
    content: `确认删除「${record.payload}」？删除后该 payload 不再参与注入测试。`,
    okText: '删除',
    cancelText: '取消',
    onOk: async () => {
      const res = await postAction<string>(resolveStaticScanApi(ApiSecScan.payloadDelete, { id: record.id }))
      if (res === null)
        return
      Message.success('删除成功')
      await fetchData()
    },
  })
}

// ── 查询 / 重置 ───────────────────────────────────
function handleSearch() {
  fetchData()
}

function handleReset() {
  searchForm.vuln_type = ''
  searchForm.enabledOnly = false
  handleSearch()
}
</script>

<template>
  <div>
    <ListPage>
      <!-- 筛选区：控件外层必须是原生 div，Arco Input/Select/Switch 的 inheritAttrs: false 会吞掉 class -->
      <template #filter>
        <div class="filter-bar">
          <div class="f-mid">
            <a-select v-model="searchForm.vuln_type" placeholder="漏洞类型" allow-clear @change="handleSearch">
              <a-option value="">
                全部
              </a-option>
              <a-option value="xss">
                XSS
              </a-option>
              <a-option value="sqli">
                SQL注入
              </a-option>
              <a-option value="java_reflect">
                Java反射
              </a-option>
            </a-select>
          </div>
          <div class="f-switch">
            <a-switch v-model="searchForm.enabledOnly" @change="handleSearch" />
            <span class="switch-label">仅看启用</span>
          </div>
          <a-button type="primary" @click="handleSearch">
            查询
          </a-button>
          <a-button @click="handleReset">
            重置
          </a-button>
        </div>
      </template>

      <template #toolbar>
        <a-button :loading="seeding" @click="handleSeed">
          初始化内置Payload
        </a-button>
        <!-- 新建是全局动作，推到工具行右端，与本行其他按钮分开 -->
        <div class="toolbar-spacer" />
        <a-button type="primary" @click="openAdd">
          新增Payload
        </a-button>
      </template>

      <template #default="{ tableHeight }">
        <a-table
          :data="tableData"
          :loading="loading"
          :pagination="false"
          :scroll="{ minWidth: 1080, y: tableHeight }"
          row-key="id"
        >
          <template #columns>
            <a-table-column title="漏洞类型" :width="110">
              <template #cell="{ record }">
                <a-tag :color="vulnTypeColor(record.vuln_type)" size="small">
                  {{ vulnTypeLabel(record.vuln_type) }}
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column title="内容" data-index="payload" :width="300" ellipsis tooltip>
              <template #cell="{ record }">
                <a-typography-text class="payload-text" copyable :copy-text="record.payload">
                  {{ record.payload }}
                </a-typography-text>
              </template>
            </a-table-column>
            <a-table-column title="描述" data-index="description" :width="220" ellipsis tooltip>
              <template #cell="{ record }">
                {{ record.description || '--' }}
              </template>
            </a-table-column>
            <a-table-column title="严重度" :width="90">
              <template #cell="{ record }">
                <a-tag :color="severityMeta(record.severity).color" size="small">
                  {{ severityMeta(record.severity).label }}
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column title="检测方式" :width="120">
              <template #cell="{ record }">
                {{ detectMethodText(record.detect_method) }}
              </template>
            </a-table-column>
            <a-table-column title="启用" :width="80">
              <template #cell="{ record }">
                <a-switch
                  :model-value="record.enabled === 'Y'"
                  :loading="togglingId === record.id"
                  @change="(v: string | number | boolean) => handleToggle(record, Boolean(v))"
                />
              </template>
            </a-table-column>
            <a-table-column title="操作" :width="90" fixed="right">
              <template #cell="{ record }">
                <a-popconfirm content="确认删除该 Payload？" @ok="handleDelete(record)">
                  <a-link status="danger">
                    删除
                  </a-link>
                </a-popconfirm>
              </template>
            </a-table-column>
          </template>
        </a-table>
      </template>
    </ListPage>

    <!-- 新增 Payload -->
    <a-modal
      v-model:visible="modalVisible"
      title="新增 Payload"
      :width="640"
      :ok-loading="modalLoading"
      @ok="handleSubmit"
    >
      <a-form :model="form" layout="vertical">
        <a-form-item label="漏洞类型" required>
          <a-select v-model="form.vuln_type" placeholder="选择漏洞类型">
            <a-option value="xss">
              XSS
            </a-option>
            <a-option value="sqli">
              SQL注入
            </a-option>
            <a-option value="java_reflect">
              Java反射
            </a-option>
          </a-select>
        </a-form-item>
        <a-form-item label="Payload 内容" required>
          <a-textarea
            v-model="form.payload"
            placeholder="如：<script>alert('xss')</script>"
            :auto-size="{ minRows: 3, maxRows: 6 }"
          />
        </a-form-item>
        <a-form-item label="描述">
          <a-input v-model="form.description" placeholder="如：基础脚本标签" :max-length="500" />
        </a-form-item>
        <a-form-item label="严重度">
          <a-select v-model="form.severity">
            <a-option value="high">
              高
            </a-option>
            <a-option value="medium">
              中
            </a-option>
            <a-option value="low">
              低
            </a-option>
          </a-select>
        </a-form-item>
        <a-form-item label="检测方式">
          <a-select v-model="form.detect_method">
            <a-option v-for="m in DETECT_METHODS" :key="m.value" :value="m.value">
              {{ m.label }}
            </a-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

/* 宽度必须落在包裹 div 上：Arco 的 Input / Select 是 inheritAttrs: false */
.f-mid {
  width: 150px;
}

/* Switch 没有宽度问题，但同样要在包裹层里排文字 */
.f-switch {
  display: flex;
  gap: 6px;
  align-items: center;
  height: 32px;
}

.switch-label {
  color: var(--color-text-2);
  font-size: 13px;
}

.filter-bar > div :deep(.arco-select) {
  width: 100%;
}

/* 把「新增Payload」推到工具行右端（工具行本身的 flex 由 ListPage 提供） */
.toolbar-spacer {
  flex: 1;
}

/*
  Payload 内容可能很长：单行省略 + 悬停看全量（column 的 ellipsis/tooltip 对自定义
  cell 不生效），复制按钮由 a-typography-text 的 copyable 提供。
*/
.payload-text {
  display: block;
  max-width: 100%;
  overflow: hidden;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
