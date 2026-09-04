<script lang="ts" setup>
import { Message, Modal } from '@arco-design/web-vue'
import { computed, ref } from 'vue'
import { ApiMcArtifact, ApiMcAudit } from '@/api/apis'
import { formatTime, useDelete, useGet, useTableAutoHeight, useToken, withTableDefaults } from '@/hooks'

defineOptions({ name: 'McArtifact' })

// ── 制品列表 ──────────────────────────────────
const queryParams = ref({ kind: '', version: '', page_num: 1, page_size: 20 })
const { isFetching, data: listRaw, execute: fetchList } = useGet<any>(ApiMcArtifact.getList, queryParams, { immediate: true })
const artifacts = computed(() => listRaw.value?.list || [])
const total = computed(() => listRaw.value?.total || 0)

// ── 审计流水 ──────────────────────────────────
const auditParams = ref({ page_num: 1, page_size: 20 })
const { data: auditRaw, execute: fetchAudit } = useGet<any>(ApiMcAudit.getList, auditParams, { immediate: true })
const audits = computed(() => auditRaw.value?.list || [])

function refresh() {
  fetchList()
  fetchAudit()
}

function fmtSize(bytes: number) {
  if (!bytes)
    return '-'
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const columns = withTableDefaults([
  { title: '版本', dataIndex: 'version', width: 150 },
  { title: '种类', dataIndex: 'kind', width: 130, slotName: 'kind' },
  { title: '大小', dataIndex: 'size_bytes', width: 100, slotName: 'size' },
  { title: 'SHA256', dataIndex: 'sha256', width: 200, slotName: 'sha256' },
  { title: '迁移条目', dataIndex: 'migrations_count', width: 100, slotName: 'migrations' },
  { title: '构建', dataIndex: 'build_meta', width: 220, slotName: 'build' },
  { title: '说明', dataIndex: 'notes' },
  { title: '上传时间', dataIndex: 'created_at', width: 170, slotName: 'created' },
  { title: '操作', dataIndex: 'operations', slotName: 'operations', width: 90, fixed: 'right' as const },
])

// ── 表格高度自适应（表头固定，滚动条落在表格内）──────────────
const tableWrap = ref<HTMLElement>()
const { tableHeight } = useTableAutoHeight(tableWrap)

const auditColumns = [
  { title: '时间', dataIndex: 'created_at', width: 170, slotName: 'created' },
  { title: '动作', dataIndex: 'action', width: 150 },
  { title: '对象', dataIndex: 'target_ref', width: 200, ellipsis: true, tooltip: true },
  { title: '操作者', dataIndex: 'actor', width: 200, ellipsis: true },
  { title: '来源', dataIndex: 'actor_source', width: 100, slotName: 'source' },
  { title: '结果', dataIndex: 'result', width: 80, slotName: 'result' },
  { title: '详情', dataIndex: 'detail', ellipsis: true, tooltip: true, slotName: 'detail' },
]

// ── 上传 ──────────────────────────────────────
// multipart 必须用裸 fetch：useRequest 只封装了 JSON 请求体。
// 与 views/ai/skill-manage.vue 的上传写法保持一致。
const uploading = ref(false)
const uploadNotes = ref('')
const lastOutcome = ref<any>(null)

async function handleUpload(file: File) {
  uploading.value = true
  lastOutcome.value = null
  try {
    const { token } = useToken()
    const formData = new FormData()
    formData.append('file', file)
    if (uploadNotes.value)
      formData.append('notes', uploadNotes.value)
    const resp = await fetch(import.meta.env.VITE_API_BASE_URL + ApiMcArtifact.upload, {
      method: 'POST',
      body: formData,
      headers: { Authorization: token },
    })
    const data = await resp.json()
    if (data?.code === 200) {
      lastOutcome.value = data.data
      if (data.data?.deduplicated)
        Message.info(`制品 ${data.data.artifact.version} 已存在且内容一致，本次为幂等接受`)
      else
        Message.success(`制品 ${data.data.artifact.version} 入库成功`)
      refresh()
    }
    else {
      // 后端把冲突原因写得很具体（含两个摘要），原样显示，别缩成「上传失败」
      Message.error({ content: data?.msg || '上传失败', duration: 8000 })
    }
  }
  catch (e: any) {
    Message.error(e?.message || '上传失败')
  }
  finally {
    uploading.value = false
  }
  return false // 交由 before/@change 流程处理，不走 arco 的默认上传
}

function handleDelete(row: any) {
  Modal.warning({
    title: '删除制品',
    content: `确认删除 ${row.version}？被环境引用的制品会被后端拒绝删除。`,
    hideCancel: false,
    onOk: async () => {
      const { data } = await useDelete(ApiMcArtifact.delete, { id: row.id })
      if (data.value !== null)
        refresh()
    },
  })
}
</script>

<template>
  <div class="p-4">
    <a-card title="制品仓库" :bordered="false">
      <template #extra>
        <a-space>
          <a-input v-model="queryParams.version" placeholder="版本号" allow-clear style="width: 160px" @change="() => fetchList()" />
          <a-select v-model="queryParams.kind" placeholder="种类" allow-clear style="width: 150px" @change="() => fetchList()">
            <a-option value="linux_artifact">
              Linux 制品
            </a-option>
            <a-option value="windows_zip">
              Windows 包
            </a-option>
          </a-select>
          <a-button @click="refresh">
            刷新
          </a-button>
        </a-space>
      </template>

      <a-alert type="warning" class="mb-3">
        上传制品等价于向生产投递可执行文件。入库只是登记，<b>不会</b>让任何环境生效；
        生效需要到「环境总览」里改期望版本，并重启目标实例。
      </a-alert>

      <a-space class="mb-3" align="start">
        <a-input v-model="uploadNotes" placeholder="变更说明（写进审计）" style="width: 320px" />
        <a-upload
          :auto-upload="false"
          :show-file-list="false"
          accept=".gz,.zip"
          @change="(files: any) => { if (files?.[0]?.file) handleUpload(files[0].file) }"
        >
          <template #upload-button>
            <a-button type="primary" :loading="uploading">
              上传制品（ttp-&lt;版本&gt;.tar.gz）
            </a-button>
          </template>
        </a-upload>
      </a-space>

      <a-descriptions v-if="lastOutcome" :column="1" bordered size="small" class="mb-3">
        <a-descriptions-item label="本次入库">
          {{ lastOutcome.artifact.kind }} / {{ lastOutcome.artifact.version }}
          <a-tag v-if="lastOutcome.deduplicated" color="orange" class="ml-2">
            幂等（未重复落盘）
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="SHA256">
          <span class="font-mono text-xs">{{ lastOutcome.artifact.sha256 }}</span>
        </a-descriptions-item>
        <a-descriptions-item v-if="lastOutcome.warnings?.length" label="提示">
          <div v-for="w in lastOutcome.warnings" :key="w">
            {{ w }}
          </div>
        </a-descriptions-item>
      </a-descriptions>

      <div ref="tableWrap">
        <a-table
          :loading="isFetching"
          :columns="columns"
          :data="artifacts"
          :pagination="{ total, current: queryParams.page_num, pageSize: queryParams.page_size, showTotal: true }"
          row-key="id"
          size="small"
          column-resizable
          :scroll="{ minWidth: 1500, y: tableHeight }"
          @page-change="(p: number) => { queryParams.page_num = p; fetchList() }"
        >
          <template #kind="{ record }">
            <a-tag :color="record.kind === 'linux_artifact' ? 'blue' : 'purple'">
              {{ record.kind === 'linux_artifact' ? 'Linux' : 'Windows' }}
            </a-tag>
          </template>
          <template #size="{ record }">
            {{ fmtSize(record.size_bytes) }}
          </template>
          <template #sha256="{ record }">
            <a-tooltip :content="record.sha256">
              <span class="font-mono text-xs">{{ record.sha256?.slice(0, 16) }}…</span>
            </a-tooltip>
          </template>
          <template #migrations="{ record }">
            <a-tooltip content="制品内 sql/ 目录数（sql_dir 型迁移条目数），用于与其他制品比对是否需要跑迁移">
              {{ record.migrations_count ?? '-' }}
            </a-tooltip>
          </template>
          <template #build="{ record }">
            <span class="text-xs">
              {{ record.build_meta?.git_sha || '-' }}
              <span class="text-gray-400">{{ record.build_meta?.build_time || '' }}</span>
            </span>
          </template>
          <template #created="{ record }">
            {{ formatTime(record.created_at) }}
          </template>
          <template #operations="{ record }">
            <a-button type="text" status="danger" size="mini" @click="handleDelete(record)">
              删除
            </a-button>
          </template>
        </a-table>
      </div>
    </a-card>

    <a-card title="操作审计" :bordered="false" class="mt-4">
      <a-table
        :columns="auditColumns"
        :data="audits"
        row-key="id"
        size="small"
        :pagination="{ pageSize: 10 }"
        :scroll="{ minWidth: 1200 }"
      >
        <template #created="{ record }">
          {{ formatTime(record.created_at) }}
        </template>
        <template #source="{ record }">
          <a-tag :color="record.actor_source === 'capability' ? 'orange' : record.actor_source === 'system' ? 'gray' : 'blue'">
            {{ record.actor_source === 'capability' ? 'AI' : record.actor_source }}
          </a-tag>
        </template>
        <template #result="{ record }">
          <a-tag :color="record.result === 'ok' ? 'green' : 'red'">
            {{ record.result }}
          </a-tag>
        </template>
        <template #detail="{ record }">
          <span class="text-xs">{{ record.detail ? JSON.stringify(record.detail) : '' }}</span>
        </template>
      </a-table>
    </a-card>
  </div>
</template>
