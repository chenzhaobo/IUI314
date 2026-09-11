<script setup lang="ts">
/**
 * API 清单同步（右侧工具行「同步」+「同步记录」两个弹窗）
 *
 * 同步语义（后端 service::metadata::api_inventory::sync_inventory）：
 *   选一个测试环境 → 拉该环境 OpenAPI 定义库 → 存在则更新 / 不存在新增 / 源侧删除则标记删除，
 *   每次同步留一条记录（插入/更新/标记删除/合并重复数量）。
 *
 * 通过 `defineExpose({ openSync, openRecords })` 由页面调用，同步成功后 emit('synced')，
 * 由页面负责刷新树与表格（本组件不持有页面数据）。
 */
import { Message } from '@arco-design/web-vue'
import { computed, ref } from 'vue'

import { ApiMetadataInventory } from '@/api/metadataApis'
import { ApiPerfEnv } from '@/api/perfApis'
import { formatTime, getAction, postAction, useGet } from '@/hooks'

const props = defineProps<{
  /** 当前已同步/正在使用的测试环境（同步记录按它过滤） */
  envId?: string
  /** 环境下拉按产品线过滤 */
  productLine?: string
}>()

const emit = defineEmits<{
  /** 同步完成：页面把 activeEnvId 设为它并刷新树/表 */
  (e: 'synced', envId: string): void
}>()

// ── 同步弹窗 ──────────────────────────────────────
const syncVisible = ref(false)
const syncEnvId = ref('')
const syncing = ref(false)
const envOptions = ref<any[]>([])

// 注意：`execute()` 不返回数据，必须读 hook 暴露的 data（其它写法会拿到 undefined → 下拉为空）
const { data: envRaw, execute: fetchEnvs } = useGet<any>(
  ApiPerfEnv.getList,
  computed(() => ({ page_num: 1, page_size: 100, product_line: props.productLine || undefined })),
  { immediate: false },
)

async function openSync() {
  syncVisible.value = true
  await fetchEnvs()
  const list = envRaw.value?.list || []
  envOptions.value = list
  if (!syncEnvId.value && list.length)
    syncEnvId.value = list[0].id
}

async function handleSync() {
  if (!syncEnvId.value) {
    Message.warning('请选择要同步的测试环境')
    return
  }
  syncing.value = true
  try {
    const stats: any = await postAction(ApiMetadataInventory.sync, { env_id: syncEnvId.value })
    if (stats === null)
      return
    const dedupedText = stats.deduped ? `（合并重复 ${stats.deduped}）` : ''
    Message.success(`同步完成：新增 ${stats.inserted}，更新 ${stats.updated}，标记删除 ${stats.deleted}${dedupedText}`)
    syncVisible.value = false
    emit('synced', syncEnvId.value)
  }
  finally {
    syncing.value = false
  }
}

// ── 同步记录弹窗 ──────────────────────────────────
const recordsVisible = ref(false)
const recordsLoading = ref(false)
const records = ref<any[]>([])

async function openRecords() {
  recordsVisible.value = true
  recordsLoading.value = true
  try {
    const res = await getAction<any>(ApiMetadataInventory.syncRuns, {
      env_id: props.envId || undefined,
      page_num: 1,
      page_size: 50,
    })
    records.value = res?.list || []
  }
  finally {
    recordsLoading.value = false
  }
}

defineExpose({ openSync, openRecords })
</script>

<template>
  <div>
    <!-- 同步：选环境 → 拉取定义库（存在则更新/不存在新增/源侧删除则标记删除） -->
    <a-modal
      v-model:visible="syncVisible"
      title="同步 API 清单"
      :width="520"
      :ok-loading="syncing"
      ok-text="开始同步"
      @ok="handleSync"
    >
      <a-form :model="{ env_id: syncEnvId }" layout="vertical">
        <a-form-item label="测试环境（基础配置 → 测试环境）" required>
          <a-select v-model="syncEnvId" placeholder="选择要同步的环境" allow-search>
            <a-option v-for="e in envOptions" :key="e.id" :value="e.id">
              {{ e.env_name }}（{{ e.env_code }}）
            </a-option>
          </a-select>
        </a-form-item>
        <div class="sync-hint">
          同步语义：已存在则更新、不存在则新增、源侧已删除则标记删除。<br>
          数据来源：该环境的 OpenAPI 定义库；应用/云归属随同步刷新，项目组/领域在查看时动态关联。<br>
          环境列表按上方选择的「产品线（{{ productLine || '--' }}）」过滤。
        </div>
      </a-form>
    </a-modal>

    <!-- 同步记录：时间 / 环境 / 新增 / 更新 / 标记删除 -->
    <a-modal
      v-model:visible="recordsVisible"
      title="同步记录"
      :width="760"
      :footer="false"
    >
      <a-table
        :data="records"
        :loading="recordsLoading"
        :pagination="false"
        :scroll="{ y: 420 }"
        row-key="id"
        size="small"
      >
        <template #columns>
          <a-table-column title="同步时间" :width="170">
            <template #cell="{ record }">
              {{ formatTime(record.finished_at || record.started_at) }}
            </template>
          </a-table-column>
          <a-table-column title="测试环境" :width="170" ellipsis tooltip>
            <template #cell="{ record }">
              {{ record.env_name || record.env_id }}
            </template>
          </a-table-column>
          <a-table-column title="接口总数" data-index="total" :width="90" />
          <a-table-column title="新增" data-index="inserted" :width="76" />
          <a-table-column title="更新" data-index="updated" :width="76" />
          <a-table-column title="标记删除" data-index="deleted" :width="90" />
          <a-table-column title="合并重复" data-index="deduped" :width="90" />
        </template>
        <template #empty>
          <a-empty description="暂无同步记录" />
        </template>
      </a-table>
    </a-modal>
  </div>
</template>

<style scoped>
.sync-hint {
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
