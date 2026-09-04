<template>
  <div class="page-container">
    <!-- 源配置 + 一键更新 -->
    <a-card :bordered="false" title="反编译源码库">
      <template #extra>
        <a-space>
          <a-button @click="fetchSources()">刷新</a-button>
          <a-button type="primary" @click="openSourceEdit()">新增源</a-button>
        </a-space>
      </template>
      <a-alert style="margin-bottom: 16px">
        公有云标品代码没有 git 仓库，唯一可查的源码是包仓库 jar 的 CFR 反编译产物。这里配置包索引地址并一键更新，
        产物落在扫描工作根的 local-repositories 下；公有云性能分析按 className 反查源码，代码扫描可把包登记成 local-test 仓库直接扫。
        更新为串行执行（单个 cfr 进程峰值约 2 核），避免抢占同机服务。
      </a-alert>

      <a-empty v-if="!sources.length && !sourcesLoading" description="还没有配置反编译源" />
      <a-card v-for="item in sources" :key="item.source.id" class="source-card" :bordered="true">
        <a-descriptions :column="3" size="small" bordered>
          <a-descriptions-item label="源">{{ item.source.name }}（{{ item.source.code }}）</a-descriptions-item>
          <a-descriptions-item label="状态">
            <a-tag :color="item.source.enabled === '1' ? 'green' : 'gray'">{{ item.source.enabled === '1' ? '启用' : '停用' }}</a-tag>
            <a-tag v-if="item.source.last_sync_status" :color="syncStatusColor(item.source.last_sync_status)" style="margin-left: 6px">
              上次{{ syncStatusText(item.source.last_sync_status) }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="上次更新">{{ item.source.last_sync_at || '从未' }}</a-descriptions-item>
          <a-descriptions-item label="包索引地址" :span="3">{{ item.source.index_url }}</a-descriptions-item>
          <a-descriptions-item label="源码库目录" :span="3">{{ item.library_root || '—' }}</a-descriptions-item>
          <a-descriptions-item label="jar 过滤">{{ item.source.jar_filter || '（全量）' }}</a-descriptions-item>
          <a-descriptions-item label="排除包">{{ item.source.exclude_patterns || '（不排除）' }}</a-descriptions-item>
          <a-descriptions-item label="并发 / 磁盘下限">{{ item.source.concurrency }} / {{ item.source.min_free_gb }}GB</a-descriptions-item>
        </a-descriptions>

        <a-row :gutter="16" style="margin-top: 12px">
          <a-col :span="4"><a-statistic title="可用包" :value="item.stats.package_ok" /></a-col>
          <a-col :span="5"><a-statistic title="Java 文件" :value="item.stats.java_files" /></a-col>
          <a-col :span="5"><a-statistic title="Java 行数" :value="item.stats.java_lines" /></a-col>
          <a-col :span="5"><a-statistic title="已关联项目组" :value="item.stats.with_project_group" :suffix="`/ ${item.stats.package_total}`" /></a-col>
          <a-col :span="5"><a-statistic title="已登记扫描仓库" :value="item.stats.registered" :suffix="`/ ${item.stats.package_total}`" /></a-col>
        </a-row>

        <!-- 更新进度 -->
        <div v-if="runningRun(item)" class="run-progress">
          <a-progress :percent="(runningRun(item)!.progress || 0) / 100" :show-text="true" />
          <div class="run-meta">
            正在处理：{{ runningRun(item)!.current_package || '准备中' }} ·
            完成 {{ runningRun(item)!.done_items }}/{{ runningRun(item)!.total_items }} ·
            失败 {{ runningRun(item)!.failed_items }}
            <a-button size="mini" status="danger" style="margin-left: 12px" @click="cancelRun(runningRun(item)!.id)">取消</a-button>
          </div>
        </div>

        <template #actions>
          <a-space wrap>
            <a-button type="primary" :disabled="!!runningRun(item)" @click="startSync(item, false)">一键更新</a-button>
            <a-button :disabled="!!runningRun(item)" @click="startSync(item, true)">强制重做</a-button>
            <a-button :disabled="!!runningRun(item)" @click="importExisting(item)">导入已有产物</a-button>
            <a-button @click="reassociate(item)">重新关联应用</a-button>
            <a-button @click="rebuildIndex(item)">重建索引文件</a-button>
            <a-button @click="openRegister(item)">登记扫描仓库</a-button>
            <a-button @click="openSourceEdit(item.source)">编辑</a-button>
            <a-button status="danger" @click="removeSource(item.source)">删除</a-button>
          </a-space>
        </template>
      </a-card>
    </a-card>

    <!-- 包清单 -->
    <a-card :bordered="false" title="包清单" style="margin-top: 16px">
      <a-row :gutter="12" style="margin-bottom: 12px">
        <a-col :span="5">
          <a-input v-model="packageQuery.keyword" placeholder="包名，如 tmc-fcs" allow-clear @press-enter="fetchPackages()" />
        </a-col>
        <a-col :span="5">
          <a-input v-model="packageQuery.class_prefix" placeholder="class 前缀，如 kd.tmc.fcs" allow-clear @press-enter="fetchPackages()" />
        </a-col>
        <a-col :span="4">
          <a-select v-model="packageQuery.status" placeholder="状态" allow-clear>
            <a-option value="ok">ok</a-option>
            <a-option value="empty">无匹配类</a-option>
            <a-option value="placeholder">占位包</a-option>
            <a-option value="failed">失败</a-option>
          </a-select>
        </a-col>
        <a-col :span="10">
          <a-space>
            <a-button type="primary" @click="fetchPackages()">查询</a-button>
            <a-button @click="resetPackageQuery()">重置</a-button>
            <a-checkbox v-model="packageQuery.unregistered_only" @change="fetchPackages()">只看未登记</a-checkbox>
          </a-space>
        </a-col>
      </a-row>

      <div ref="packageTableWrap">
        <a-table :data="packages" :loading="packagesLoading" :pagination="packagePagination" row-key="id" column-resizable :scroll="{ y: packageTableHeight }" @page-change="changePackagePage">
        <template #columns>
          <a-table-column title="包名" data-index="package_name" :width="200" ellipsis tooltip />
          <a-table-column title="状态" :width="100">
            <template #cell="{ record }">
              <a-tag :color="record.status === 'ok' ? 'green' : 'gray'">{{ record.status }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="应用" :width="180">
            <template #cell="{ record }">
              <span v-if="record.app_number">{{ record.app_number }} / {{ record.app_name }}</span>
              <a-tag v-else color="orange">未归类</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="项目组" :width="200">
            <template #cell="{ record }">
              <span v-if="record.project_group_code">{{ record.project_group_code }} / {{ record.project_group_name }}</span>
              <a-tag v-else color="orange">未归类</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="jar" data-index="jar_count" :width="70" />
          <a-table-column title="Java 文件" data-index="java_files" :width="100" />
          <a-table-column title="行数" data-index="java_lines" :width="100" />
          <a-table-column title="扫描仓库" :width="100">
            <template #cell="{ record }">
              <a-tag :color="record.repository_id ? 'green' : 'gray'">{{ record.repository_id ? '已登记' : '未登记' }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="更新时间" data-index="decompiled_at" :width="170" ellipsis tooltip />
          <a-table-column title="操作" :width="150" fixed="right">
            <template #cell="{ record }">
              <a-space>
                <a-link @click="showPackageDetail(record)">详情</a-link>
                <a-link @click="registerOne(record)">登记扫描</a-link>
              </a-space>
            </template>
          </a-table-column>
        </template>
        </a-table>
      </div>
    </a-card>

    <!-- className 反查 -->
    <a-card :bordered="false" title="按 className 反查源码" style="margin-top: 16px">
      <a-space style="width: 100%">
        <a-input
          v-model="lookupClassName"
          style="width: 560px"
          placeholder="完整类名，如 kd.tmc.fcs.mservice.repeat.PayAccessRepeatCtrlServiceImpl"
          allow-clear
          @press-enter="doLookup()"
        />
        <a-button type="primary" :loading="lookupLoading" @click="doLookup()">反查</a-button>
      </a-space>
      <div v-if="lookupResult" class="lookup-result">
        <p>class 前缀：<code>{{ lookupResult.class_prefix }}</code> · 候选包：{{ (lookupResult.candidate_packages || []).join('、') || '无' }}</p>
        <a-list v-if="(lookupResult.matches || []).length" size="small">
          <a-list-item v-for="m in lookupResult.matches" :key="m.path">
            <a-typography-paragraph copyable style="margin: 0">{{ m.path }}</a-typography-paragraph>
            <template #extra>{{ m.jar_dir }}</template>
          </a-list-item>
        </a-list>
        <a-alert v-else type="warning">{{ lookupResult.hint }}</a-alert>
      </div>
    </a-card>

    <!-- 源编辑 -->
    <a-modal v-model:visible="sourceModalVisible" :title="sourceForm.id ? '编辑源' : '新增源'" @ok="saveSource" @cancel="sourceModalVisible = false">
      <a-form :model="sourceForm" layout="vertical">
        <a-form-item label="编码" required><a-input v-model="sourceForm.code" placeholder="sit-appstore-biz" /></a-form-item>
        <a-form-item label="名称" required><a-input v-model="sourceForm.name" placeholder="SIT 包仓库（biz）" /></a-form-item>
        <a-form-item label="包索引地址" required>
          <a-input v-model="sourceForm.index_url" placeholder="http://172.20.198.18:88/sit/appstore/biz/" />
        </a-form-item>
        <a-form-item label="输出子目录" help="产物落在 {扫描工作根}/local-repositories/{该值}/ 下">
          <a-input v-model="sourceForm.output_subdir" placeholder="appstore-biz" />
        </a-form-item>
        <a-form-item label="jar 过滤（cfr --jarfilter）" help="留空表示全量反编译，会显著增大磁盘占用">
          <a-input v-model="sourceForm.jar_filter" placeholder="^kd\." />
        </a-form-item>
        <a-form-item label="排除包（逗号分隔通配）" help="默认排除单测包">
          <a-input v-model="sourceForm.exclude_patterns" placeholder="*unittest*" />
        </a-form-item>
        <a-form-item label="并发" help="默认 1（串行）。单个 cfr 进程峰值约 2 核，调大会影响同机服务">
          <a-input-number v-model="sourceForm.concurrency" :min="1" :max="4" />
        </a-form-item>
        <a-form-item label="剩余磁盘下限（GB）">
          <a-input-number v-model="sourceForm.min_free_gb" :min="1" :max="500" />
        </a-form-item>
        <a-form-item label="启用"><a-switch v-model="sourceForm.enabled" /></a-form-item>
        <a-form-item label="备注"><a-textarea v-model="sourceForm.remark" :auto-size="{ minRows: 2 }" /></a-form-item>
      </a-form>
    </a-modal>

    <!-- 包详情 -->
    <a-drawer v-model:visible="packageDrawerVisible" :width="'60vw'" :title="currentPackage?.package_name" :footer="false">
      <a-descriptions v-if="currentPackage" :column="1" bordered size="small">
        <a-descriptions-item label="相对路径">{{ currentPackage.relative_path }}</a-descriptions-item>
        <a-descriptions-item label="状态">{{ currentPackage.status }}</a-descriptions-item>
        <a-descriptions-item label="应用">{{ currentPackage.app_number ? `${currentPackage.app_number} / ${currentPackage.app_name}` : '未归类' }}</a-descriptions-item>
        <a-descriptions-item label="项目组">{{ currentPackage.project_group_code ? `${currentPackage.project_group_code} / ${currentPackage.project_group_name}` : '未归类' }}</a-descriptions-item>
        <a-descriptions-item label="jar 目录"><pre class="mono">{{ (currentPackage.jar_dirs || []).join('\n') || '—' }}</pre></a-descriptions-item>
        <a-descriptions-item label="class 前缀"><pre class="mono">{{ (currentPackage.class_prefixes || []).join('\n') || '—' }}</pre></a-descriptions-item>
        <a-descriptions-item label="源包大小">{{ currentPackage.zip_bytes }} 字节 · {{ currentPackage.zip_modified || '—' }}</a-descriptions-item>
        <a-descriptions-item label="备注">{{ currentPackage.message || '—' }}</a-descriptions-item>
      </a-descriptions>
    </a-drawer>

    <!-- 登记扫描仓库 -->
    <a-modal v-model:visible="registerModalVisible" title="登记为代码扫描仓库" @ok="doRegister" @cancel="registerModalVisible = false">
      <a-alert style="margin-bottom: 12px">
        会把该源下反编译成功的包登记成 <code>local-test:</code> 仓库，扫描侧可直接选用。
        能按 class 前缀反查到应用的会自动带上应用与项目组，关联不上的挂「未归类」，后续补齐主数据再点「重新关联应用」即可。
      </a-alert>
      <a-form-item label="包名（留空=该源全部成功包）">
        <a-textarea v-model="registerPackagesText" placeholder="逗号或换行分隔，如 tmc-fcs,ssc-task" :auto-size="{ minRows: 3 }" />
      </a-form-item>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { Message, Modal } from '@arco-design/web-vue'
import { ApiSecDecompile } from '@/api/sechubApis'
import { useGet, usePost, useTableAutoHeight } from '@/hooks'

defineOptions({ name: 'decompile-library' })

// ── 源 ──────────────────────────────────────
const sourcesRaw = ref<any[]>([])
const sourcesLoading = ref(false)
const sources = computed(() => sourcesRaw.value || [])
const { data: sourceData, execute: loadSources } = useGet<any>(ApiSecDecompile.sourceList, undefined, { immediate: false })

const fetchSources = async () => {
  sourcesLoading.value = true
  try {
    await loadSources()
    sourcesRaw.value = sourceData.value || []
  } finally {
    sourcesLoading.value = false
  }
}

// running_run 为空表示当前没有在跑的更新任务
const runningRun = (item: any) => item?.running_run || null

const syncStatusText = (status: string) => (({ success: '成功', failed: '失败', cancelled: '已取消', running: '进行中' }) as Record<string, string>)[status] || status
const syncStatusColor = (status: string) => (({ success: 'green', failed: 'red', cancelled: 'gray', running: 'orangered' }) as Record<string, string>)[status] || 'gray'

// ── 一键更新 ──────────────────────────────────────
const syncPayload = ref<any>({})
const { execute: doSync } = usePost<any>(ApiSecDecompile.sync, syncPayload, { immediate: false })

const startSync = async (item: any, force: boolean) => {
  const run = () => {
    syncPayload.value = { source_id: String(item.source.id).trim(), force }
    return doSync().then(() => {
      Message.success(force ? '已触发强制重做' : '已触发一键更新')
      fetchSources()
    })
  }
  if (!force) {
    await run()
    return
  }
  Modal.confirm({
    title: '强制重做',
    content: '会忽略断点状态重新下载并反编译全部包，耗时较长且占用 CPU。确定继续？',
    okText: '确定',
    cancelText: '取消',
    onOk: run,
  })
}

const cancelPayload = ref<any>({})
const { execute: doCancel } = usePost<any>(ApiSecDecompile.runCancel, cancelPayload, { immediate: false })
const cancelRun = async (runId: string) => {
  cancelPayload.value = { id: String(runId).trim() }
  await doCancel()
  Message.success('已请求取消，当前包处理完成后停止')
  fetchSources()
}

const importPayload = ref<any>({})
const { execute: doImport } = usePost<any>(ApiSecDecompile.importExisting, importPayload, { immediate: false })
const importExisting = (item: any) => {
  Modal.confirm({
    title: '导入已有产物',
    content: '扫描源码库目录，把已存在的反编译工程认领进包清单（不下载、不反编译）。适合用技能脚本离线跑完后同步。',
    okText: '开始导入',
    cancelText: '取消',
    onOk: async () => {
      importPayload.value = { id: String(item.source.id).trim() }
      await doImport()
      Message.success('导入完成')
      fetchSources()
      fetchPackages()
    },
  })
}

const reassociatePayload = ref<any>({})
const { execute: doReassociate } = usePost<any>(ApiSecDecompile.reassociate, reassociatePayload, { immediate: false })
const reassociate = async (item: any) => {
  reassociatePayload.value = { id: String(item.source.id).trim() }
  await doReassociate()
  Message.success('已重新关联应用与项目组')
  fetchSources()
  fetchPackages()
}

// 重建 index.json / package_index.tsv / class_prefix_index.tsv。
// 这三个文件是 rg/AI 直接 grep 的入口，sync 与 import 会自动重写；
// 手工改动过目录、或索引被单包运行覆盖过时用这个修复。
const rebuildPayload = ref<any>({})
const { execute: doRebuildIndex } = usePost<any>(ApiSecDecompile.rebuildIndex, rebuildPayload, { immediate: false })
const rebuildIndex = async (item: any) => {
  rebuildPayload.value = { id: String(item.source.id).trim() }
  await doRebuildIndex()
  Message.success('索引文件已重建')
}

// ── 源编辑 ──────────────────────────────────────
const sourceModalVisible = ref(false)
const sourceForm = reactive<any>({})
const defaultSourceForm = () => ({
  id: undefined,
  code: '',
  name: '',
  index_url: '',
  output_subdir: 'appstore-biz',
  jar_filter: '^kd\\.',
  exclude_patterns: '*unittest*',
  concurrency: 1,
  min_free_gb: 5,
  enabled: true,
  remark: '',
})

const openSourceEdit = (source?: any) => {
  Object.assign(sourceForm, defaultSourceForm())
  if (source) {
    Object.assign(sourceForm, {
      id: String(source.id).trim(),
      code: source.code,
      name: source.name,
      index_url: source.index_url,
      output_subdir: source.output_subdir,
      jar_filter: source.jar_filter,
      exclude_patterns: source.exclude_patterns,
      concurrency: source.concurrency,
      min_free_gb: source.min_free_gb,
      enabled: source.enabled === '1',
      remark: source.remark || '',
    })
  }
  sourceModalVisible.value = true
}

const savePayload = ref<any>({})
const { execute: doSave } = usePost<any>(ApiSecDecompile.sourceSave, savePayload, { immediate: false })
const saveSource = async () => {
  savePayload.value = { ...sourceForm }
  await doSave()
  Message.success('已保存')
  sourceModalVisible.value = false
  fetchSources()
}

const deletePayload = ref<any>({})
const { execute: doDelete } = usePost<any>(ApiSecDecompile.sourceDelete, deletePayload, { immediate: false })
const removeSource = (source: any) => {
  Modal.confirm({
    title: '删除源',
    content: `确定删除《${source.name}》？已反编译的产物文件不会被删除。`,
    okText: '确认删除',
    cancelText: '取消',
    okButtonProps: { status: 'danger' },
    onOk: async () => {
      deletePayload.value = { id: String(source.id).trim() }
      await doDelete()
      Message.success('已删除')
      fetchSources()
    },
  })
}

// ── 包清单 ──────────────────────────────────────
const packageQuery = reactive<any>({ keyword: '', class_prefix: '', status: '', unregistered_only: false, page_num: 1, page_size: 20 })
const packagesRaw = ref<any>({})
const packagesLoading = ref(false)
const packages = computed(() => packagesRaw.value?.list || [])
const packagePagination = computed(() => ({
  current: packageQuery.page_num,
  pageSize: packageQuery.page_size,
  total: packagesRaw.value?.total || 0,
  showTotal: true,
}))

const packageParams = ref<any>({})
const { data: packageData, execute: loadPackages } = useGet<any>(ApiSecDecompile.packageList, packageParams, { immediate: false })

const fetchPackages = async () => {
  packagesLoading.value = true
  try {
    const params: any = { page_num: packageQuery.page_num, page_size: packageQuery.page_size }
    if (packageQuery.keyword) params.keyword = packageQuery.keyword
    if (packageQuery.class_prefix) params.class_prefix = packageQuery.class_prefix
    if (packageQuery.status) params.status = packageQuery.status
    if (packageQuery.unregistered_only) params.unregistered_only = true
    packageParams.value = params
    await loadPackages()
    packagesRaw.value = packageData.value || {}
  } finally {
    packagesLoading.value = false
  }
}

const resetPackageQuery = () => {
  Object.assign(packageQuery, { keyword: '', class_prefix: '', status: '', unregistered_only: false, page_num: 1 })
  fetchPackages()
}
const changePackagePage = (page: number) => {
  packageQuery.page_num = page
  fetchPackages()
}

// 包清单表格高度自适应（滚动条出现在表格内，表头固定）
const packageTableWrap = ref<HTMLElement>()
const { tableHeight: packageTableHeight } = useTableAutoHeight(packageTableWrap)

const packageDrawerVisible = ref(false)
const currentPackage = ref<any>(null)
const showPackageDetail = (record: any) => {
  currentPackage.value = record
  packageDrawerVisible.value = true
}

// ── 登记扫描仓库 ──────────────────────────────────────
const registerModalVisible = ref(false)
const registerPackagesText = ref('')
const registerSourceId = ref('')
const registerPayload = ref<any>({})
const { execute: doRegisterRepo } = usePost<any>(ApiSecDecompile.registerRepositories, registerPayload, { immediate: false })

const openRegister = (item: any) => {
  registerSourceId.value = String(item.source.id).trim()
  registerPackagesText.value = ''
  registerModalVisible.value = true
}

const doRegister = async () => {
  const list = registerPackagesText.value.split(/[,;\s\n]+/).map(v => v.trim()).filter(Boolean)
  registerPayload.value = { source_id: registerSourceId.value, packages: list }
  await doRegisterRepo()
  Message.success('已登记为代码扫描仓库')
  registerModalVisible.value = false
  fetchSources()
  fetchPackages()
}

const registerOne = async (record: any) => {
  registerPayload.value = { source_id: String(record.source_id).trim(), packages: [record.package_name] }
  await doRegisterRepo()
  Message.success(`已登记 ${record.package_name}`)
  fetchSources()
  fetchPackages()
}

// ── className 反查 ──────────────────────────────────────
const lookupClassName = ref('')
const lookupLoading = ref(false)
const lookupResult = ref<any>(null)
const lookupParams = ref<any>({})
const { data: lookupData, execute: doLookupRequest } = useGet<any>(ApiSecDecompile.lookup, lookupParams, { immediate: false })

const doLookup = async () => {
  if (!lookupClassName.value.trim()) return
  lookupLoading.value = true
  try {
    lookupParams.value = { class_name: lookupClassName.value.trim() }
    await doLookupRequest()
    lookupResult.value = lookupData.value || null
  } finally {
    lookupLoading.value = false
  }
}

// 有更新任务在跑时轮询进度；跑完自动停。
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  fetchSources()
  fetchPackages()
  timer = setInterval(() => {
    if (sources.value.some(item => runningRun(item))) fetchSources()
  }, 5000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.source-card { margin-bottom: 16px; }
.run-progress { margin-top: 12px; }
.run-meta { margin-top: 6px; color: var(--color-text-3); font-size: 12px; }
.lookup-result { margin-top: 12px; }
.mono { margin: 0; font-family: monospace; white-space: pre-wrap; }
</style>
