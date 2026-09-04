<script lang="ts" setup>
import { Message, Modal } from '@arco-design/web-vue'
import { computed, ref } from 'vue'
import { ApiSysMigration } from '@/api/apis'
import { formatTime, useDelete, useGet, usePost } from '@/hooks'

defineOptions({ name: 'DbUpgrade' })

const query = ref({ keyword: '', failed_only: false })
const { isFetching, data: raw, execute: fetchList } = useGet<any>(ApiSysMigration.getList, query, { immediate: true })

const rows = computed(() => raw.value?.list || [])
const appliedTotal = computed(() => raw.value?.applied_total ?? 0)
const logAvailable = computed(() => raw.value?.log_available ?? false)
const database = computed(() => raw.value?.database || '-')
const failedCount = computed(() => rows.value.filter((r: any) => !r.applied || (r.stmt_failed || 0) > 0).length)

/// applied_at 是 Unix 秒（服务端已把历史毫秒值归一）
function fmtApplied(sec: number | null) {
  if (!sec)
    return '-'
  return formatTime(new Date(sec * 1000))
}

/// 一行的状态：已应用 / 失败（有失败语句或压根没记为已应用）
function statusOf(r: any): { text: string, color: string } {
  if ((r.stmt_failed || 0) > 0)
    return { text: `失败 ${r.stmt_failed} 条语句`, color: 'red' }
  if (!r.applied)
    return { text: '未应用（已中止/回滚）', color: 'red' }
  return { text: '成功', color: 'green' }
}

// ── 展开详情 ──────────────────────────────────
const detailCache = ref<Record<string, any[]>>({})
const detailLoading = ref<string>('')

async function loadDetail(migration: string) {
  if (detailCache.value[migration])
    return
  detailLoading.value = migration
  const { data } = await useGet<any>(ApiSysMigration.getDetail, { migration }, { immediate: true }).execute()
  detailCache.value[migration] = Array.isArray(data?.value) ? data.value : []
  detailLoading.value = ''
}

// arco 的 expand 事件签名是 (rowKey: string | number, record) —— row-key 虽然是
// migration（字符串），类型上仍可能是 number，直接标 string 会编译不过
function onExpand(rowKey: string | number) {
  loadDetail(String(rowKey))
}

// ── 重置以便重跑（高危）────────────────────────
function handleReset(r: any) {
  Modal.warning({
    title: '重置为未应用？',
    width: 560,
    content:
      `迁移 ${r.migration}\n\n`
      + '这个操作只删除「已应用」标记，本身不执行任何 SQL。'
      + '真正的重跑发生在下一次启动（RUN_MIGRATION=1 时自动执行 migration up）。\n\n'
      + '风险：迁移 SQL 未必幂等。本项目多数写成 IF NOT EXISTS / ON CONFLICT DO NOTHING，'
      + '重跑无害；但只要有一条不是，重跑会失败，而迁移失败会让容器起不来。',
    hideCancel: false,
    okText: '确认重置',
    onOk: async () => {
      const { data } = await usePost(ApiSysMigration.reset, {
        migration: r.migration,
        confirm: true,
        purge_log: false,
      }).execute()
      const d: any = data?.value
      if (d) {
        Message.success({ content: `${d.migration}：删除已应用标记 ${d.applied_removed} 行。${d.next_step}`, duration: 8000 })
        delete detailCache.value[r.migration]
        fetchList()
      }
    },
  })
}

function handlePurge(r: any) {
  Modal.warning({
    title: '清理执行流水？',
    content: `只删除 ${r.migration} 的逐条语句记录，不影响「是否已应用」，也不会导致重跑。`,
    hideCancel: false,
    onOk: async () => {
      const { data } = await useDelete(ApiSysMigration.purgeLog, { migration: r.migration }).execute()
      if (data?.value !== null) {
        delete detailCache.value[r.migration]
        fetchList()
      }
    },
  })
}

const columns = [
  { title: '迁移', dataIndex: 'migration', ellipsis: true, tooltip: true },
  { title: '说明', dataIndex: 'title', width: 260, ellipsis: true, tooltip: true },
  { title: '状态', dataIndex: 'status', width: 180, slotName: 'status' },
  { title: '升级时间', dataIndex: 'applied_at', width: 175, slotName: 'time' },
  { title: '语句', dataIndex: 'stmt_total', width: 90, slotName: 'stmt' },
  { title: '耗时', dataIndex: 'elapsed_ms', width: 90, slotName: 'elapsed' },
  { title: '机器', dataIndex: 'host', width: 110, ellipsis: true },
  { title: '操作', dataIndex: 'operations', slotName: 'operations', width: 150, fixed: 'right' as const },
]
</script>

<template>
  <div class="p-4">
    <a-card :bordered="false">
      <template #title>
        <a-space>
          <span>数据库升级记录</span>
          <a-tag>库：{{ database }}</a-tag>
          <a-tag color="green">
            已应用 {{ appliedTotal }}
          </a-tag>
          <a-tag v-if="failedCount > 0" color="red">
            异常 {{ failedCount }}
          </a-tag>
        </a-space>
      </template>
      <template #extra>
        <a-space>
          <a-input v-model="query.keyword" placeholder="迁移名" allow-clear style="width: 220px" @change="() => fetchList()" />
          <a-switch v-model="query.failed_only" @change="() => fetchList()" />
          <span class="text-sm">只看异常</span>
          <a-button @click="() => fetchList()">
            刷新
          </a-button>
        </a-space>
      </template>

      <a-alert class="mb-3" :type="logAvailable ? 'normal' : 'warning'">
        <template v-if="logAvailable">
          显示的是<b>当前实例所连数据库</b>（{{ database }}）的升级情况。展开一行可看逐条语句与报错原因。
          历史迁移在执行日志功能上线前跑的，没有逐条记录，只有「已应用」时间。
        </template>
        <template v-else>
          这个库还没有执行日志表（<span class="font-mono">sys_migration_log</span>），
          所以只能看到「已应用」清单，没有逐条语句与报错原因。
          下次用新版制品跑一次 <span class="font-mono">migration up</span> 就会自动建表并开始记录。
        </template>
      </a-alert>

      <a-table
        :loading="isFetching"
        :columns="columns"
        :data="rows"
        row-key="migration"
        size="small"
        :pagination="{ pageSize: 20, showTotal: true, showPageSize: true }"
        :scroll="{ x: 1300 }"
        :expandable="logAvailable ? { width: 40 } : undefined"
        :row-class="(record: any) => (!record.applied || (record.stmt_failed || 0) > 0 ? 'db-upg-bad' : '')"
        @expand="(rowKey: string | number) => onExpand(rowKey)"
      >
        <template #status="{ record }">
          <a-tag :color="statusOf(record).color">
            {{ statusOf(record).text }}
          </a-tag>
        </template>
        <template #time="{ record }">
          {{ record.applied_at ? fmtApplied(record.applied_at) : (record.last_run_at ? formatTime(record.last_run_at) : '-') }}
        </template>
        <template #stmt="{ record }">
          <span v-if="record.stmt_total == null" class="text-gray-400">无记录</span>
          <span v-else>{{ record.stmt_total - (record.stmt_failed || 0) }}/{{ record.stmt_total }}</span>
        </template>
        <template #elapsed="{ record }">
          {{ record.elapsed_ms == null ? '-' : `${record.elapsed_ms} ms` }}
        </template>
        <template #operations="{ record }">
          <a-space>
            <a-button type="text" status="danger" size="mini" @click="handleReset(record)">
              重置重跑
            </a-button>
            <a-button v-if="record.stmt_total != null" type="text" size="mini" @click="handlePurge(record)">
              清流水
            </a-button>
          </a-space>
        </template>

        <template #expand-row="{ record }">
          <a-spin :loading="detailLoading === record.migration" style="width: 100%">
            <a-table
              :data="detailCache[record.migration] || []"
              :pagination="false"
              size="mini"
              row-key="id"
              :bordered="{ cell: true }"
            >
              <template #columns>
                <a-table-column title="时间" :width="170">
                  <template #cell="{ record: s }">
                    {{ formatTime(s.created_at) }}
                  </template>
                </a-table-column>
                <a-table-column title="文件" data-index="file_name" :width="180" ellipsis />
                <a-table-column title="#" data-index="stmt_index" :width="50" />
                <a-table-column title="方向" data-index="direction" :width="70" />
                <a-table-column title="状态" :width="80">
                  <template #cell="{ record: s }">
                    <a-tag :color="s.status === 'ok' ? 'green' : 'red'">
                      {{ s.status }}
                    </a-tag>
                  </template>
                </a-table-column>
                <a-table-column title="影响行" data-index="rows_affected" :width="80" />
                <a-table-column title="耗时" :width="80">
                  <template #cell="{ record: s }">
                    {{ s.elapsed_ms == null ? '-' : `${s.elapsed_ms} ms` }}
                  </template>
                </a-table-column>
                <a-table-column title="语句 / 报错原因">
                  <template #cell="{ record: s }">
                    <div class="font-mono text-xs text-gray-600">
                      {{ s.stmt_digest }}
                    </div>
                    <div v-if="s.error" class="text-xs text-red-600 mt-1">
                      {{ s.error }}
                    </div>
                    <div v-if="s.actor" class="text-xs text-gray-400 mt-1">
                      操作者 {{ s.actor }}
                    </div>
                  </template>
                </a-table-column>
              </template>
            </a-table>
          </a-spin>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<style scoped>
/* 异常行整行标红，扫一眼就能定位 */
:deep(.db-upg-bad) {
  background-color: rgb(255 236 232 / 60%);
}
</style>
