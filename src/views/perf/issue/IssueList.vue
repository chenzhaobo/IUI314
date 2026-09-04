<template>
  <div>
    <div class="page-container">
      <a-card :bordered="false">
    
        <!--
          筛选区改为换行 flex + 按钮独立成行。

          原来用 a-row/a-col 的 span 分配，出了三个问题：
          1. 一个 `span="3"` 的列里**竖着塞了三个控件**（处理进度、DMP 编码组、状态），
             那一列因此有三倍高，旁边单行高的字段下方就空出一大片（反馈的"明显空白"）；
             DMP 编码组里 140px 输入框 + "未关联"按钮又塞不进 span=3 的宽度，按钮压到了输入框上。
          2. 各 col 的 span 加起来正好 24，按钮那一列（span="4"）只能跟在"应用编码"后面同一行，
             而里面有 10 个按钮，远超 4/24 的宽度 → 直接溢出到画面外。
          3. span 是按 24 等分算的，字段实际需要的宽度各不相同（下拉窄、关键词宽），
             等分必然有的挤有的空。

          换成 flex-wrap 后每个字段按自己需要的宽度占位、放不下自动换行，
          不再需要凑 24；按钮单独一行，数量再增加也不会挤到字段里。
        -->
        <!--
          每个控件外面**必须**包一层原生 div 来给宽度。

          Arco 的 Input / Select 都是 `inheritAttrs: false`（`es/input/input.js`、
          `es/select/select.js`），传给组件的 `class` 不会落到根节点上 ——
          上一版直接给 `<a-select class="f-mid">` 写宽度，那些类**从未生效**，
          控件保持 Arco 自带的 `width: 100%`，在 flex 容器里就变成每个占满一行
          （反馈："每个查询条件字段一行"，比改之前更糟）。
          包一层原生 div 后宽度落在 div 上，控件在 div 内 100% 填充，与是否透传无关。
        -->
        <div class="filter-bar">
          <div class="f-wide">
            <a-input v-model="searchForm.keyword" placeholder="标题/编号/表单" allow-clear @press-enter="handleSearch" />
          </div>

          <div class="f-mid">
            <a-select v-model="searchForm.process_status" placeholder="处理进度" allow-clear @change="handleSearch">
              <a-option v-for="s in PROCESS_FLOW" :key="s.value" :value="s.value">{{ s.label }}</a-option>
              <a-option value="__none__">未认领</a-option>
            </a-select>
          </div>

          <!-- 输入框与按钮同组：整组给足宽度，按钮不再压到输入框上 -->
          <div class="f-dmp">
            <a-input-group>
              <a-input
                v-model="searchForm.dmp_defect_code"
                placeholder="DMP 编码"
                allow-clear
                @press-enter="handleSearch"
                @clear="handleSearch"
              />
              <a-tooltip content="只看还没关联 DMP 单的" mini>
                <a-button :type="searchForm.dmp_defect_code === '__none__' ? 'primary' : 'outline'" @click="toggleDmpUnlinked">
                  未关联
                </a-button>
              </a-tooltip>
            </a-input-group>
          </div>

          <div class="f-mid">
            <a-select v-model="searchForm.status" placeholder="状态" allow-clear>
              <a-option value="pending">待确认</a-option>
              <a-option value="confirmed">已确认</a-option>
              <a-option value="fixing">处理中</a-option>
              <a-option value="fixed">已修复</a-option>
              <a-option value="verified">已验证</a-option>
              <a-option value="closed">已关闭</a-option>
              <a-option value="wontfix">不修复</a-option>
            </a-select>
          </div>

          <div class="f-narrow">
            <a-select v-model="searchForm.severity" placeholder="严重度" allow-clear>
              <a-option value="critical">严重</a-option>
              <a-option value="major">重要</a-option>
              <a-option value="minor">一般</a-option>
            </a-select>
          </div>

          <div class="f-narrow">
            <a-select v-model="searchForm.category" placeholder="分类" allow-clear>
              <a-option value="standard">标品</a-option>
              <a-option value="custom">二开</a-option>
            </a-select>
          </div>

          <div class="f-mid">
            <a-select v-model="searchForm.source" placeholder="来源" allow-clear>
              <a-option value="manual">手动</a-option>
              <a-option value="diagnosis">诊断</a-option>
              <a-option value="trace_ai">AI分析</a-option>
            </a-select>
          </div>

          <div class="f-mid">
            <a-input v-model="searchForm.app_number" placeholder="应用编码" allow-clear />
          </div>

          <!-- 查询/重置跟随筛选区：它们是"筛选"的一部分，与表格操作按钮分开 -->
          <a-button type="primary" @click="handleSearch">查询</a-button>
          <a-button @click="handleReset">重置</a-button>
        </div>


        <!--
        布局行必须有**确定高度**，不能只给 min-height：
        IssueScopeTree 内部是 `flex:1; min-height:0; overflow:auto`（自己滚），
        但那要求父级高度确定 —— 只有 min-height 时父级仍是 auto，
        树会一路把页面撑长（反馈：左树太长导致出现页面滚动条）。
        高度用实测而非写死 calc(100vh - N)：写死值只要与实际顶边不符就会超出视口。
      -->
      <div ref="layoutRow" class="scope-layout" :style="{ height: layoutRowH + 'px' }">
          <aside class="scope-panel panel-scroll-y">
            <IssueScopeTree :key="scopeTreeKey" :filters="scopeCountFilters" source="issue" @change="handleScopeChange" />
          </aside>
          <div ref="tableWrap" class="scope-content">
            <!--
              对表格记录的操作按钮放在**表格正上方**、与选中提示同一行。
              这样按钮紧邻它作用的对象；也不再和筛选字段抢同一行的宽度。
            -->
            <div class="table-toolbar">
              <!-- 内部处理流程：勾选行后点。与「状态」列（生产复现状态）是两个维度，不会互相覆盖 -->
              <a-button type="primary" :disabled="!selectedIds.length" @click="openClaim">认领</a-button>
              <a-dropdown :disabled="!selectedIds.length" @select="(v) => transition(String(v))">
                <a-button :disabled="!selectedIds.length" :loading="transitionLoading">
                  处理状态
                  <template #icon><icon-down /></template>
                </a-button>
                <template #content>
                  <a-doption v-for="s in PROCESS_FLOW" :key="s.value" :value="s.value">
                    {{ s.label }}
                  </a-doption>
                </template>
              </a-dropdown>
              <a-button :disabled="!selectedIds.length" @click="openDmp">DMP 编码</a-button>
              <span v-if="selectedIds.length" class="sel-hint">已选 {{ selectedIds.length }} 条</span>
              <div class="toolbar-spacer" />
              <a-button status="success" @click="handleExport">导出 Excel</a-button>
              <a-button type="primary" status="success" @click="handleAdd">新增</a-button>
            </div>
            <!-- 表格 -->
            <!--
              操作列是 fixed="right"，但这张表原本**没有 :scroll.x** ——
              Arco 只有在有横向滚动容器时才能正确定位固定列，缺了它操作列会
              溢出到表格右边界之外（反馈："按钮超右边了"）。
              16 个列宽合计 1965px，取整设为 scroll.x；容器更宽时 Arco 会自动拉伸，
              不会因此凭空多出横向滚动条。
            -->
            <a-table
              column-resizable
              :data="tableData"
              :loading="loading"
              :pagination="pagination"
              :row-selection="{ type: 'checkbox', showCheckedAll: true }"
              :selected-keys="selectedIds"
              :scroll="{ minWidth: 1965, y: tableHeight }"
              row-key="id"
              @selection-change="onSelectionChange"
              @page-change="handlePageChange"
            >
              <template #columns>
                <a-table-column title="编号" data-index="issue_no" :width="130" />
                <a-table-column title="标题" data-index="title" :width="250" ellipsis />
                <a-table-column title="严重度" data-index="severity" :width="80">
                  <template #cell="{ record }">
                    <a-tag :color="severityColor(record.severity)">{{ severityText(record.severity) }}</a-tag>
                  </template>
                </a-table-column>
                <a-table-column title="类型" data-index="issue_type" :width="100">
                  <template #cell="{ record }">{{ issueTypeText(record.issue_type) }}</template>
                </a-table-column>
                <a-table-column title="应用" data-index="app_number" :width="80" />
                <a-table-column title="表单" data-index="form_name" :width="150" ellipsis />
                <a-table-column title="客户" data-index="customer_name" :width="120" ellipsis />
                <a-table-column title="状态" data-index="status" :width="90">
                  <template #cell="{ record }">
                    <a-tag :color="statusColor(record.status)">{{ statusText(record.status) }}</a-tag>
                  </template>
                </a-table-column>
                <!-- 内部处理进度：与上面的「状态」不是一回事，那个是生产复现状态 -->
                <a-table-column title="处理进度" data-index="process_status" :width="90">
                  <template #cell="{ record }">
                    <a-tooltip v-if="record.process_status" :content="`处理人：${record.process_owner || '-'}${record.process_prev_status ? ` ← ${processLabel(record.process_prev_status)}` : ''}`" mini>
                      <a-tag :color="processColor(record.process_status)" size="small">{{ processLabel(record.process_status) }}</a-tag>
                    </a-tooltip>
                    <span v-else class="dmp-empty">未认领</span>
                  </template>
                </a-table-column>
                <a-table-column title="处理人" data-index="process_owner" :width="85" ellipsis tooltip />
                <a-table-column title="DMP 编码" data-index="dmp_defect_code" :width="130" ellipsis>
                  <template #cell="{ record }">
                    <a-typography-text v-if="record.dmp_defect_code" copyable :copy-text="record.dmp_defect_code">
                      {{ record.dmp_defect_code }}
                    </a-typography-text>
                    <span v-else class="dmp-empty">未关联</span>
                  </template>
                </a-table-column>
                <a-table-column title="来源" data-index="source" :width="80">
                  <template #cell="{ record }">
                    <a-tag :color="sourceColor(record.source)" size="small">{{ sourceText(record.source) }}</a-tag>
                  </template>
                </a-table-column>
                <a-table-column title="发现日期" data-index="found_date" :width="100" />
                <a-table-column title="创建时间" data-index="created_at" :width="150" ellipsis tooltip />
                <a-table-column title="更新时间" data-index="updated_at" :width="150" ellipsis tooltip />
                <a-table-column title="操作" :width="180" fixed="right">
                  <template #cell="{ record }">
                    <a-space>
                      <a-link @click="handleDetail(record)">详情</a-link>
                      <a-dropdown>
                        <a-link>状态</a-link>
                        <template #content>
                          <a-doption v-for="s in getNextStatuses(record.status)" :key="s" @click="handleChangeStatus(record, s)">
                            {{ statusText(s) }}
                          </a-doption>
                        </template>
                      </a-dropdown>
                      <a-popconfirm content="确定删除？" @ok="handleDelete(record)">
                        <a-link status="danger">删除</a-link>
                      </a-popconfirm>
                    </a-space>
                  </template>
                </a-table-column>
              </template>
            </a-table>
          </div>
        </div>
      </a-card>

      <!-- 详情抽屉 -->
      <a-drawer
        v-model:visible="drawerVisible"
        :width="'82vw'"
        title="问题详情"
        :body-style="{ maxHeight: 'calc(100vh - 120px)', overflow: 'auto' }"
      >
        <a-descriptions :column="2" bordered size="small">
          <a-descriptions-item label="编号">{{ currentRecord?.issue_no }}</a-descriptions-item>
          <a-descriptions-item label="状态">
            <a-tag :color="statusColor(currentRecord?.status)">{{ statusText(currentRecord?.status) }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="标题" :span="2">{{ currentRecord?.title }}</a-descriptions-item>
          <a-descriptions-item label="严重度">{{ severityText(currentRecord?.severity) }}</a-descriptions-item>
          <a-descriptions-item label="类型">{{ issueTypeText(currentRecord?.issue_type) }}</a-descriptions-item>
          <a-descriptions-item label="应用">{{ currentRecord?.app_number }} - {{ currentRecord?.app_name }}</a-descriptions-item>
          <a-descriptions-item label="表单">{{ currentRecord?.form_name }}</a-descriptions-item>
          <a-descriptions-item label="按钮">{{ currentRecord?.control_name }}</a-descriptions-item>
          <a-descriptions-item label="客户">{{ currentRecord?.customer_name }}</a-descriptions-item>
          <a-descriptions-item label="项目组">{{ currentRecord?.project_group_name }}</a-descriptions-item>
          <a-descriptions-item label="负责人">{{ currentRecord?.assignee }}</a-descriptions-item>
          <a-descriptions-item label="发现日期">{{ currentRecord?.found_date }}</a-descriptions-item>
          <a-descriptions-item label="修复日期">{{ currentRecord?.fixed_date }}</a-descriptions-item>
          <a-descriptions-item label="来源">{{ sourceText(currentRecord?.source) }}</a-descriptions-item>
          <a-descriptions-item label="出现次数">{{ currentRecord?.recurrence_count || 1 }}</a-descriptions-item>
          <a-descriptions-item label="归因标签">{{ currentRecord?.attribution_tag || '--' }}</a-descriptions-item>
          <a-descriptions-item label="产品线">{{ currentRecord?.product_line || '--' }}</a-descriptions-item>
          <a-descriptions-item v-if="currentRecord?.related_issue_id" label="关联问题" :span="2">
            <a-link @click="openRelatedIssue(currentRecord.related_issue_id)">{{ currentRecord.related_issue_id }}</a-link>
          </a-descriptions-item>
        </a-descriptions>
        <!-- 这三段都是 Markdown（归因产出带列表、代码块、表格）。
             原来 class 叫 markdown-content 却用 {{ }} 纯文本插值，名字骗人：
             实际看到的是带 # 与 | 的原文。 -->
        <a-divider>问题描述</a-divider>
        <MdPreview v-if="currentRecord?.description" :modelValue="currentRecord.description" />
        <div v-else class="markdown-content">暂无</div>
        <a-divider>根因分析</a-divider>
        <MdPreview v-if="currentRecord?.root_cause" :modelValue="currentRecord.root_cause" />
        <div v-else class="markdown-content">暂无</div>
        <a-divider>修复建议</a-divider>
        <MdPreview v-if="currentRecord?.fix_suggestion" :modelValue="currentRecord.fix_suggestion" />
        <div v-else class="markdown-content">暂无</div>
        <a-divider>样本 Trace IDs</a-divider>
        <div v-if="traceIdList(currentRecord?.trace_ids).length" class="markdown-content">
          <a-typography-paragraph v-for="traceId in traceIdList(currentRecord?.trace_ids)" :key="traceId" copyable style="margin: 0 0 4px">{{ traceId }}</a-typography-paragraph>
        </div>
        <div v-else class="markdown-content">暂无</div>
        <!-- 与问题台账详情保持一致：同一份缺陷报告 md，同样的渲染方式。
             两者是不同的表（perf_issue 是跟踪单、perf_issue_pattern 是归因台账），
             但面向的是同一个问题，展示应当一致 —— 差异只在流程字段上。 -->
        <a-divider>缺陷报告</a-divider>
        <a-spin :loading="mdLoading" style="display: block; min-height: 60px">
          <MdPreview v-if="mdContent" :modelValue="mdContent" />
          <a-alert v-else-if="mdReason" type="info">{{ mdReason }}</a-alert>
          <a-empty v-else description="暂无缺陷报告" />
        </a-spin>
        <div v-if="mdMeta" style="margin-top: 6px; color: #86909c; font-size: 12px">
          来源：{{ mdMeta.run_date }} / {{ mdMeta.file }}（{{ Math.round((mdMeta.bytes || 0) / 1024) }} KB{{ mdMeta.truncated ? '，已截断' : '' }}）
        </div>

        <a-divider>技术签名</a-divider>
        <pre class="json-content">{{ prettyJson(currentRecord?.tech_signature) }}</pre>

        <template #footer>
          <a-space>
            <a-button @click="drawerVisible = false">关闭</a-button>
            <!-- 归因产物（原始日志 + 缺陷报告 md）打一个 zip。
                 接口按 issue_no 反查台账，所以这里不需要台账 id。 -->
            <!-- tooltip 包在 span 上：disabled 的按钮不派发鼠标事件，
                 否则禁用态下提示不出来。 -->
            <a-tooltip :content="bundleTip(currentRecord)">
              <span style="display: inline-block">
                <a-button
                  type="primary"
                  status="success"
                  :loading="bundleDownloading"
                  :disabled="!hasBundle(currentRecord)"
                  @click="handleBundleDownload()"
                >下载关联文件</a-button>
              </span>
            </a-tooltip>
          </a-space>
        </template>
      </a-drawer>

      <!-- 新增弹窗 -->
      <a-modal v-model:visible="modalVisible" title="新增问题" :width="700" @ok="handleSubmit">
        <a-form :model="formData" layout="vertical">
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="标题" required>
                <a-input v-model="formData.title" placeholder="问题标题" />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="严重度">
                <a-select v-model="formData.severity">
                  <a-option value="critical">严重</a-option>
                  <a-option value="major">重要</a-option>
                  <a-option value="minor">一般</a-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="问题类型">
                <a-select v-model="formData.issue_type">
                  <a-option value="slow_sql">慢SQL</a-option>
                  <a-option value="index_loop">索引循环</a-option>
                  <a-option value="rpc_slow">RPC慢调用</a-option>
                  <a-option value="accumulated">累积耗时</a-option>
                  <a-option value="other">其他</a-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="分类">
                <a-select v-model="formData.category">
                  <a-option value="standard">标品</a-option>
                  <a-option value="custom">二开</a-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="应用编码">
                <a-input v-model="formData.app_number" />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="表单ID">
                <a-input v-model="formData.form_id" />
              </a-form-item>
            </a-col>
            <a-col :span="8">
              <a-form-item label="表单名称">
                <a-input v-model="formData.form_name" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="客户编码">
                <a-input v-model="formData.tenant_code" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="客户名称">
                <a-input v-model="formData.customer_name" />
              </a-form-item>
            </a-col>
            <a-col :span="24">
              <a-form-item label="问题描述">
                <a-textarea v-model="formData.description" :auto-size="{ minRows: 3 }" />
              </a-form-item>
            </a-col>
          </a-row>
        </a-form>
      </a-modal>
    </div>

      <!-- 认领：必须有处理人 —— 认领的全部意义就是把责任落到人头上 -->
      <a-modal v-model:visible="claimVisible" :title="`认领缺陷（${selectedIds.length} 条）`" :ok-loading="claimLoading" @ok="submitClaim">
        <a-form :model="{ claimOwner }" layout="vertical">
          <a-form-item label="处理人" required>
            <a-input v-model="claimOwner" placeholder="默认为当前登录人" allow-clear />
          </a-form-item>
        </a-form>
      </a-modal>

      <!-- DMP 编码：留空提交即清除关联 -->
      <a-modal v-model:visible="dmpVisible" :title="`设置 DMP 缺陷编码（${selectedIds.length} 条）`" :ok-loading="dmpLoading" @ok="submitDmp">
        <a-form :model="{ dmpCode }" layout="vertical">
          <a-form-item label="DMP 缺陷编码">
            <a-input v-model="dmpCode" placeholder="如 DMP-2026-0001，留空则清除关联" allow-clear />
          </a-form-item>
          <a-alert v-if="!dmpCode.trim()" type="warning">
            留空提交会清除所选 {{ selectedIds.length }} 条缺陷的 DMP 编码
          </a-alert>
        </a-form>
      </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRoute } from 'vue-router'
import { Message } from '@arco-design/web-vue'
import { MdPreview } from 'md-editor-v3'
// 必须导入样式，否则 MdPreview 渲染出来没有任何格式
import 'md-editor-v3/lib/style.css'
import { ApiPerfIssue, ApiPerfPatternLedger } from '@/api/perfApis'
import { useDelete, useDownload, useGet, usePost, usePut, useTableAutoHeight, useAutoHeight } from '@/hooks'
import IssueScopeTree from '@/views/perf/components/IssueScopeTree.vue'
import { useUserStore } from '@/stores'

defineOptions({ name: 'issue-list' })

// 表格高度自适应：滚动条落在表格内、表头固定
// 布局行高度实测（左树靠它才能内部滚动，见模板处说明）
const layoutRow = ref<HTMLElement>()
const { height: layoutRowH } = useAutoHeight(layoutRow)

const tableWrap = ref<HTMLElement>()
const { tableHeight } = useTableAutoHeight(tableWrap)

const route = useRoute()
const initialKeyword = typeof route.query.keyword === 'string' ? route.query.keyword : ''

const pageNum = ref(1)
const pageSize = ref(20)
const scopeTreeKey = ref(0)
const searchForm = reactive({
  keyword: initialKeyword,
  status: '',
  severity: '',
  category: '',
  source: '',
  product_line: '',
  project_group_code: '',
  cloud_number: '',
  business_area: '',
  product_domain: '',
  app_number: '',
  form_id: '',
  // DMP 缺陷编码过滤，模糊匹配；__none__ 筛未提单的
  dmp_defect_code: '',
  // 内部处理状态过滤；__none__ 筛未进入流程的
  process_status: '',
})
const scopeCountFilters = computed(() => ({
  keyword: searchForm.keyword,
  status: searchForm.status,
  dmp_defect_code: searchForm.dmp_defect_code,
  process_status: searchForm.process_status,
  severity: searchForm.severity,
  category: searchForm.category,
  source: searchForm.source,
}))

const drawerVisible = ref(false)
const currentRecord = ref<any>(null)
const modalVisible = ref(false)
const formData = reactive<any>({
  title: '', severity: 'major', issue_type: 'slow_sql', category: 'standard',
  app_number: '', form_id: '', form_name: '', tenant_code: '', customer_name: '', description: '',
})

const statusMap: Record<string, string> = { pending: '待确认', confirmed: '已确认', fixing: '处理中', fixed: '已修复', verified: '已验证', closed: '已关闭', wontfix: '不修复' }
const severityMap: Record<string, string> = { critical: '严重', major: '重要', minor: '一般' }
const issueTypeMap: Record<string, string> = { slow_sql: '慢SQL', index_loop: '索引循环', rpc_slow: 'RPC慢调用', accumulated: '累积耗时', other: '其他' }

const statusText = (s: string) => statusMap[s] || s
const severityText = (s: string) => severityMap[s] || s
const issueTypeText = (s: string) => issueTypeMap[s] || s
const statusColor = (s: string) => ({ pending: 'orange', confirmed: 'blue', fixing: 'purple', fixed: 'cyan', verified: 'green', closed: 'gray', wontfix: 'red' }[s] || 'gray')
const severityColor = (s: string) => ({ critical: 'red', major: 'orange', minor: 'blue' }[s] || 'gray')
const sourceText = (s: string) => ({ manual: '手动', diagnosis: '诊断', trace_ai: 'AI分析' }[s] || s || '手动')
const sourceColor = (s: string) => ({ manual: 'gray', diagnosis: 'blue', trace_ai: 'purple' }[s] || 'gray')

const getNextStatuses = (current: string) => {
  const transitions: Record<string, string[]> = {
    pending: ['confirmed', 'wontfix'], confirmed: ['fixing', 'wontfix'], fixing: ['fixed'],
    fixed: ['verified', 'fixing'], verified: ['closed'], wontfix: ['pending'],
  }
  return transitions[current] || []
}

// ===== 内部处理流程 =====
//
// 与「状态」列是两码事：那个是**生产复现状态**（对外口径：生产上还复现不复现），
// 这个是内部处理进度。两者会同时存在 —— 比如已发版但生产仍复现。
const PROCESS_FLOW = [
  { value: 'claimed', label: '已认领', color: 'blue' },
  { value: 'fixing', label: '修复中', color: 'orange' },
  { value: 'fixed', label: '已修复', color: 'cyan' },
  { value: 'released', label: '已发版', color: 'green' },
] as const

function processLabel(v?: string | null) {
  return PROCESS_FLOW.find(x => x.value === v)?.label ?? ''
}
function processColor(v?: string | null) {
  return PROCESS_FLOW.find(x => x.value === v)?.color ?? 'gray'
}

const selectedIds = ref<string[]>([])
function onSelectionChange(keys: (string | number)[]) {
  selectedIds.value = keys.map(String)
}

// 认领：必须有处理人，认领的全部意义就是把责任落到人头上
const claimVisible = ref(false)
const claimOwner = ref('')
const claimLoading = ref(false)
const userStore = useUserStore()

function openClaim() {
  if (!selectedIds.value.length)
    return
  // 默认填当前登录人 —— 绝大多数情况是「我认领」
  claimOwner.value = userStore.user?.nickname || userStore.user?.name || ''
  claimVisible.value = true
}

async function submitClaim() {
  if (!claimOwner.value.trim()) {
    Message.warning('请填写处理人')
    return
  }
  claimLoading.value = true
  try {
    await transition('claimed', claimOwner.value.trim())
    claimVisible.value = false
  }
  finally {
    claimLoading.value = false
  }
}

const transitionLoading = ref(false)

/** 内部状态流转。不校验先后顺序 —— 实际会有「直接标已修复」「退回修复中」。 */
async function transition(target: string, owner?: string) {
  if (!selectedIds.value.length)
    return
  transitionLoading.value = true
  try {
    const { data, execute } = usePost<{ updated: number, message: string }>(
      ApiPerfIssue.processTransition,
      { ids: selectedIds.value, process_status: target, process_owner: owner },
      { immediate: false },
    )
    await execute()
    Message.success(data.value?.message || '已更新')
    selectedIds.value = []
    await fetchData()
  }
  finally {
    transitionLoading.value = false
  }
}

// ===== DMP 缺陷编码：批量回填 =====
// 一批缺陷常对应同一个 DMP 单，所以是「勾选后填一个」而非逐行编辑。
const dmpVisible = ref(false)
const dmpCode = ref('')
const dmpLoading = ref(false)

function openDmp() {
  if (!selectedIds.value.length)
    return
  const codes = new Set(tableData.value.filter((r: any) => selectedIds.value.includes(r.id)).map((r: any) => r.dmp_defect_code || ''))
  // 全都一样时预填，方便在原值上改；不一致就留空，避免误覆盖
  dmpCode.value = codes.size === 1 ? String([...codes][0]) : ''
  dmpVisible.value = true
}

async function submitDmp() {
  dmpLoading.value = true
  try {
    const { data, execute } = usePost<{ updated: number, message: string }>(
      ApiPerfIssue.dmpCode,
      { ids: selectedIds.value, dmp_defect_code: dmpCode.value.trim() },
      { immediate: false },
    )
    await execute()
    Message.success(data.value?.message || '已更新')
    dmpVisible.value = false
    selectedIds.value = []
    await fetchData()
  }
  finally {
    dmpLoading.value = false
  }
}

/** 「未关联 DMP」快捷筛选，再点取消 */
function toggleDmpUnlinked() {
  searchForm.dmp_defect_code = searchForm.dmp_defect_code === '__none__' ? '' : '__none__'
  handleSearch()
}

const queryParams = computed(() => ({ ...searchForm, page_num: pageNum.value, page_size: pageSize.value }))
const { isFetching: loading, data: rawData, execute: fetchData } = useGet<any>(ApiPerfIssue.getList, queryParams, { immediate: true })
const tableData = computed(() => rawData.value?.list || [])
const pagination = computed(() => ({ current: pageNum.value, pageSize: pageSize.value, total: rawData.value?.total || 0 }))

const traceIdList = (raw?: string): string[] => (raw || '').split(/[,;\s]+/).filter(Boolean)
const prettyJson = (value: any): string => {
  if (!value) return '暂无'
  try { return JSON.stringify(typeof value === 'string' ? JSON.parse(value) : value, null, 2) } catch { return String(value) }
}

const { downloadWithTip } = useDownload()

// ── 归因产物打包下载（原始日志 + 缺陷报告 md）──────────────────
// 后端 pattern/logs 接受 issue 参数并反查台账，两个页面共用同一套打包逻辑。
const bundleDownloading = ref(false)

// ── 缺陷报告 md（与问题台账详情同一个接口，按 issue 反查台账）──────────
const mdContent = ref('')
const mdReason = ref('')
const mdMeta = ref<any>(null)
const mdLoading = ref(false)
const mdPayload = ref<any>({})
const { execute: fetchIssueMd } = useGet<any>(ApiPerfPatternLedger.reportMd, mdPayload, {
  immediate: false,
  onSuccess(data: any) {
    const d = data || {}
    mdContent.value = d.markdown || ''
    mdReason.value = d.found ? '' : (d.reason || '')
    mdMeta.value = d.found ? d : null
  },
})

const loadIssueMd = (record: any) => {
  mdContent.value = ''
  mdReason.value = ''
  mdMeta.value = null
  const key = record?.issue_no || record?.id
  if (!key) return
  mdPayload.value = { issue: key }
  mdLoading.value = true
  fetchIssueMd().finally(() => { mdLoading.value = false })
}

/**
 * 是否可能有归因产物。
 *
 * 手工创建的问题没有归因链路产物（没有 trace、也没有 md），点了必然失败，
 * 所以按 trace_ids 与来源判断先禁掉，别让用户白点一次再看报错。
 */
const hasBundle = (record: any): boolean => {
  if (!record?.issue_no && !record?.id) return false
  const t = record?.trace_ids
  if (Array.isArray(t)) return t.length > 0
  if (typeof t === 'string') return t.trim().length > 0 && t.trim() !== '[]'
  return false
}

const bundleTip = (record: any): string =>
  hasBundle(record)
    ? '打包该问题的原始天梯日志与缺陷报告 md'
    : '该问题没有关联的归因产物（无 trace 记录，通常是手工创建的问题）'

const handleBundleDownload = async () => {
  const record = currentRecord.value
  const key = record?.issue_no || record?.id
  if (!key) return
  bundleDownloading.value = true
  try {
    await downloadWithTip(
      `${ApiPerfPatternLedger.logs}?issue=${encodeURIComponent(key)}`,
      `${record.issue_no || '问题'}-关联文件.zip`,
      '打包失败：该问题可能没有关联台账，或日志已过留存期',
    )
  }
  finally {
    bundleDownloading.value = false
  }
}

const handleExport = async () => {
  const params = new URLSearchParams()
  Object.entries(searchForm).forEach(([key, value]) => { if (value) params.set(key, String(value)) })
  await downloadWithTip(`${ApiPerfIssue.export}?${params.toString()}`, '问题跟踪.xlsx', '问题跟踪导出失败')
}

const handleScopeChange = (scope: {
  product_line: string
  project_group_code?: string
  cloud_number?: string
  business_area?: string
  product_domain?: string
  app_number?: string
  form_id?: string
}) => {
  Object.assign(searchForm, {
    project_group_code: '',
    cloud_number: '',
    business_area: '',
    product_domain: '',
    app_number: '',
    form_id: '',
    ...scope,
  })
  pageNum.value = 1
  fetchData()
}
const handleSearch = () => { pageNum.value = 1; fetchData() }
const handleReset = () => {
  Object.assign(searchForm, {
    keyword: '', status: '', severity: '', category: '', source: '', product_line: '',
    project_group_code: '',
    cloud_number: '',
    business_area: '',
    product_domain: '',
    app_number: '',
    form_id: '',
  })
  scopeTreeKey.value += 1
  handleSearch()
}
const handlePageChange = (page: number) => { pageNum.value = page; fetchData() }
const handleDetail = (record: any) => {
  currentRecord.value = record
  drawerVisible.value = true
  loadIssueMd(record)
}
const handleAdd = () => { modalVisible.value = true }

// 关联问题跳转（通过 ID 获取完整记录）
const openRelatedIssue = async (id: string) => {
  const { data, execute } = useGet<any>(ApiPerfIssue.getById, { id }, { immediate: false })
  await execute()
  if (data.value) {
    currentRecord.value = data.value
  }
}

// 状态变更
const statusPayload = ref<any>({})
const { execute: doChangeStatus } = usePut<any>(ApiPerfIssue.changeStatus, statusPayload, { immediate: false })
const handleChangeStatus = async (record: any, newStatus: string) => {
  statusPayload.value = { id: record.id, status: newStatus }
  await doChangeStatus()
  Message.success('状态更新成功')
  fetchData()
}

// 新增
const addPayload = ref<any>({})
const { execute: doAdd } = usePost<any>(ApiPerfIssue.add, addPayload, { immediate: false })
const handleSubmit = async () => {
  if (!formData.title) { Message.warning('请填写标题'); return }
  addPayload.value = { ...formData }
  await doAdd()
  Message.success('新增成功')
  modalVisible.value = false
  fetchData()
}

// 删除
const deletePayload = ref<any>({})
const { execute: doDelete } = useDelete<any>(ApiPerfIssue.delete, deletePayload, { immediate: false })
const handleDelete = async (record: any) => {
  deletePayload.value = { ids: [record.id] }
  await doDelete()
  Message.success('删除成功')
  fetchData()
}
</script>

<style scoped>
/* 筛选区：按需宽度 + 放不下自动换行，不再用 24 等分的 span 硬凑 */
.filter-bar,
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.filter-bar {
  margin-bottom: 8px;
}
.toolbar {
  margin-bottom: 16px;
}
.f-wide {
  width: 240px;
}
.f-mid {
  width: 150px;
}
.f-narrow {
  width: 120px;
}
/* DMP 编码 = 输入框 + 未关联按钮，整组要够宽，否则按钮会压到输入框上 */
.f-dmp {
  width: 240px;
}
.f-dmp :deep(.arco-input-wrapper) {
  flex: 1;
}

/* min-height:0 让两栏可被压缩，内部 overflow 才会触发（flex 默认 min-height:auto 会拒绝压缩） */
.scope-layout { display: flex; gap: 16px; min-height: 520px; align-items: stretch; }
.scope-panel { width: 280px; flex-shrink: 0; min-height: 0; padding-right: 12px; border-right: 1px solid var(--color-border-2); }
.scope-content { flex: 1; min-width: 0; min-height: 0; }
.markdown-content { white-space: pre-wrap; background: var(--color-fill-1); padding: 12px; border-radius: 4px; }
.json-content { margin: 0; max-height: 360px; overflow: auto; white-space: pre-wrap; word-break: break-all; background: var(--color-fill-1); padding: 12px; border-radius: 4px; }

.dmp-empty {
  color: var(--color-text-4);
  font-size: 12px;
}

.sel-hint {
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
