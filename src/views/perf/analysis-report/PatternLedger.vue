<template>
  <div class="page-container">
    <a-card :bordered="false">
      <!-- 搜索栏 -->
      <a-row :gutter="16" style="margin-bottom: 16px">
        <a-col :span="3">
          <a-input v-model="searchForm.keyword" placeholder="标题/编号" allow-clear @press-enter="handleSearch" />
        </a-col>
        <a-col :span="3">
          <a-select v-model="searchForm.product_line" placeholder="产品线" allow-clear>
            <a-option value="星瀚">星瀚</a-option>
            <a-option value="苍穹">苍穹</a-option>
            <a-option value="s-HR">s-HR</a-option>
          </a-select>
        </a-col>
        <a-col :span="3">
          <a-select v-model="searchForm.dimension_type" placeholder="维度类型" allow-clear>
            <a-option value="product_domain">产品领域</a-option>
            <a-option value="business_area">业务领域</a-option>
            <a-option value="project_group">项目组</a-option>
            <a-option value="application">应用</a-option>
          </a-select>
        </a-col>
        <a-col :span="3">
          <a-input v-model="searchForm.dimension_value" placeholder="维度值" allow-clear @press-enter="handleSearch" />
        </a-col>
        <a-col :span="3">
          <a-input v-model="searchForm.attribution_tag" placeholder="归因标签" allow-clear @press-enter="handleSearch" />
        </a-col>
        <a-col :span="3">
          <a-select v-model="searchForm.status" placeholder="状态" allow-clear>
            <a-option value="new">新发现</a-option>
            <a-option value="issued">已提单</a-option>
            <a-option value="scheduled">已排期</a-option>
            <a-option value="fixing">修复中</a-option>
            <a-option value="fixed">已修复</a-option>
            <a-option value="verified">已验证</a-option>
            <a-option value="recurrent">复发</a-option>
            <a-option value="closed">已关闭</a-option>
            <a-option value="exempted">已豁免</a-option>
          </a-select>
        </a-col>
        <a-col :span="6">
          <a-space>
            <a-button type="primary" @click="handleSearch">查询</a-button>
            <a-button @click="handleReset">重置</a-button>
            <a-button status="success" @click="handleExport">导出 Excel</a-button>
          </a-space>
        </a-col>
      </a-row>

      <!--
        布局行必须有**确定高度**，不能只给 min-height：
        IssueScopeTree 内部是 `flex:1; min-height:0; overflow:auto`（自己滚），
        但那要求父级高度确定 —— 只有 min-height 时父级仍是 auto，
        树会一路把页面撑长（反馈：左树太长导致出现页面滚动条）。
        高度用实测而非写死 calc(100vh - N)：写死值只要与实际顶边不符就会超出视口。
      -->
      <div ref="layoutRow" class="scope-layout" :style="{ height: layoutRowH + 'px' }">
        <aside class="scope-panel">
          <IssueScopeTree :key="scopeTreeKey" :filters="scopeCountFilters" source="pattern" @change="handleScopeChange" />
        </aside>
        <div class="scope-content">
          <!-- 状态统计 -->
          <!--
            统计标签改用 flex 换行，不再用 a-row/a-col。

            `<a-col>` **不写 span 时默认 span=24**（占满 24 格 = 一整行），
            所以原写法每个标签独占一行 —— 状态一多整块就撑得很高
            （反馈："新发现：5 这一行……会换行，都显示到一行吧"）。
            flex + wrap 是标签这种不定宽内容的正确容器：按内容宽度排布、放不下才换行。
          -->
          <div v-if="statsData" class="stats-line">
            <a-tag v-for="(val, key) in statsData" :key="key" :color="statusColor(String(key))">
              {{ statusText(String(key)) }}: {{ val }}
            </a-tag>
          </div>

          <!-- 表格 -->
          <div ref="tableWrap" class="table-fill">
          <a-table :data="tableData" :loading="loading" :pagination="pagination" @page-change="handlePageChange"
 @page-size-change="handlePageSizeChange" row-key="id" column-resizable :scroll="{ minWidth: 1600, y: tableHeight }">
            <template #columns>
              <a-table-column title="编号" data-index="pattern_no" :width="100" ellipsis tooltip />
              <a-table-column title="标题" data-index="title" :width="250" ellipsis tooltip />
              <!-- 影响面放在标题后面：排期时先看它。
                   分数本身说明不了什么，所以悬停给出六项输入和它们怎么合成 ——
                   看到「78 分」没用，看到「4331 人次 / 3 个客户 / 平均 1.7 秒」才能判断。 -->
              <a-table-column title="影响面" :width="110" :sortable="{ sortDirections: ['descend', 'ascend'] }" data-index="impact_score">
                <template #cell="{ record }">
                  <a-tooltip v-if="record.impact_score !== null && record.impact_score !== undefined" position="right">
                    <template #content>
                      <div style="line-height: 1.9; min-width: 300px">
                        <div style="font-weight: 600; margin-bottom: 4px">
                          影响面 {{ record.impact_score }} 分（{{ record.impact_level }}）
                        </div>
                        <div v-for="row in impactRows(record)" :key="row.k" style="display: flex; gap: 10px">
                          <span style="width: 84px; opacity: 0.75">{{ row.k }}</span>
                          <span style="flex: 1">{{ row.v }}</span>
                        </div>
                        <div style="margin-top: 6px; opacity: 0.7; font-size: 12px">
                          影响面 = 受影响人次 × 客户广度 × 体验劣化，不是严重程度
                        </div>
                      </div>
                    </template>
                    <span>
                      <a-tag :color="impactColor(record.impact_level)" size="small">{{ record.impact_level || '--' }}</a-tag>
                      <span style="margin-left: 6px; font-variant-numeric: tabular-nums">{{ record.impact_score }}</span>
                    </span>
                  </a-tooltip>
                  <span v-else style="color: #c9cdd4">未评分</span>
                </template>
              </a-table-column>
              <!-- 分析层权重与系统层分开显示：口径不同（全量统计 vs 那轮抽样），
                   两者不一致本身是信息 —— 系统层低而这里高说明低频但高度集中。 -->
              <a-table-column title="分析权重" :width="96">
                <template #cell="{ record }">
                  <a-tooltip v-if="record.analysis_weight !== null && record.analysis_weight !== undefined">
                    <template #content>
                      该问题占本维度总慢时间 {{ record.analysis_share_pct ?? record.analysis_weight }}%（AI 那一轮的口径）
                      <template v-if="record.expected_avg_ms !== null && record.expected_avg_ms !== undefined">
                        <br />当前平均 {{ fmtMs(record.current_avg_ms) }}；即使该段完全消除，仍有 {{ fmtMs(record.expected_avg_ms) }}
                      </template>
                    </template>
                    <span style="font-variant-numeric: tabular-nums">{{ record.analysis_weight }}%</span>
                  </a-tooltip>
                  <span v-else style="color: #c9cdd4">--</span>
                </template>
              </a-table-column>
              <a-table-column title="归因标签" data-index="attribution_tag" :width="150">
                <template #cell="{ record }">
                  <template v-if="record.attribution_tag">
                    <a-tag v-for="(tag, idx) in splitTag(record.attribution_tag)" :key="idx" :color="idx === 0 ? 'arcoblue' : 'cyan'" size="small" style="margin-right: 4px">{{ tag }}</a-tag>
                  </template>
                  <span v-else>--</span>
                </template>
              </a-table-column>
              <a-table-column title="维度" :width="150">
                <template #cell="{ record }">
                  <span>{{ dimensionTypeText(record.dimension_type) }} / {{ record.dimension_value }}</span>
                </template>
              </a-table-column>
              <!-- 归属三列：台账原来只有任务自身的维度（如 product_domain/集团财务），
                   那表示「由哪个任务产出」而不是「归哪个项目组」，问题因此派不出去。
                   现在按 form_id 从达标率快照反查填上。查不到显示 --，
                   空值本身是「映射数据缺这个表单」的信号，不要当成 bug。 -->
              <a-table-column title="项目组" data-index="project_group_code" :width="90">
                <template #cell="{ record }">
                  <a-tag v-if="record.project_group_code" color="arcoblue" size="small">
                    {{ record.project_group_code }}
                  </a-tag>
                  <span v-else class="muted">--</span>
                </template>
              </a-table-column>
              <a-table-column title="业务领域" data-index="business_area" :width="90">
                <template #cell="{ record }">
                  {{ record.business_area || '--' }}
                </template>
              </a-table-column>
              <a-table-column title="应用" data-index="app_number" :width="80">
                <template #cell="{ record }">
                  {{ record.app_number || '--' }}
                </template>
              </a-table-column>
              <a-table-column title="产品线" data-index="product_line" :width="80" ellipsis tooltip />
              <a-table-column title="首次出现" data-index="first_found_week" :width="100" ellipsis tooltip />
              <a-table-column title="最近出现" data-index="last_found_week" :width="100" ellipsis tooltip />
              <a-table-column title="周趋势" :width="160">
                <template #cell="{ record }">
                  <span v-if="record.weekly_stats" class="weekly-bar">
                    <span v-for="(cnt, week) in recentWeeks(record.weekly_stats)" :key="week" :title="`${week}: ${cnt}次`" class="bar-item" :style="{ height: barHeight(cnt as number) + 'px' }" />
                  </span>
                  <span v-else>--</span>
                </template>
              </a-table-column>
              <a-table-column title="状态" data-index="status" :width="90">
                <template #cell="{ record }">
                  <a-tag :color="statusColor(record.status)">{{ statusText(record.status) }}</a-tag>
                </template>
              </a-table-column>
              <a-table-column title="二开" data-index="is_custom" :width="60">
                <template #cell="{ record }">
                  <a-tag v-if="record.is_custom" color="orange" size="small">是</a-tag>
                  <span v-else>--</span>
                </template>
              </a-table-column>
              <a-table-column title="豁免" data-index="is_exempted" :width="60">
                <template #cell="{ record }">
                  <a-tag v-if="record.is_exempted" color="red" size="small">是</a-tag>
                  <span v-else>--</span>
                </template>
              </a-table-column>
              <!-- 时间列放最后：排查「这条台账是什么时候建的、最近一次命中是什么时候」
                   靠周趋势看不出来，而回填/合并过的台账更需要看 updated_at。 -->
              <a-table-column title="创建时间" data-index="created_at" :width="150" ellipsis tooltip />
              <a-table-column title="更新时间" data-index="updated_at" :width="150" ellipsis tooltip />
              <a-table-column title="操作" :width="200" fixed="right">
                <template #cell="{ record }">
                  <a-space>
                    <a-link @click="handleDetail(record)">详情</a-link>
                    <a-tooltip :content="createIssueTip(record)">
                      <a-link :disabled="!!record.issue_id || !hasDefectReport(record)" status="success" @click="handleCreateIssue(record)">生成问题</a-link>
                    </a-tooltip>
                    <a-dropdown @select="(key: any) => handleMoreAction(String(key), record)">
                      <a-link>更多<icon-down /></a-link>
                      <template #content>
                        <a-doption v-if="record.issue_id" value="viewIssue">查看问题</a-doption>
                        <a-doption v-else value="linkIssue">关联已有问题</a-doption>
                        <a-doption value="logs" :disabled="!hasBundle(record)">
                          <!-- 提示挂在内部 span 上：禁用的 doption 本身不派发鼠标事件 -->
                          <a-tooltip :content="bundleTip(record)">
                            <span style="display: inline-block; width: 100%">下载关联文件</span>
                          </a-tooltip>
                        </a-doption>
                      </template>
                    </a-dropdown>
                  </a-space>
                </template>
              </a-table-column>
            </template>
          </a-table>
          </div>
        </div>
      </div>
    </a-card>

    <!-- 详情抽屉 -->
    <a-drawer
      v-model:visible="drawerVisible"
      :width="'82vw'"
      :title="currentRecord?.title || '问题详情'"
      :body-style="{ maxHeight: 'calc(100vh - 120px)', overflow: 'auto' }"
    >
      <a-descriptions :column="2" bordered size="small" style="margin-bottom: 16px">
        <a-descriptions-item label="编号">{{ currentRecord?.pattern_no }}</a-descriptions-item>
        <a-descriptions-item label="状态">
          <a-tag :color="statusColor(currentRecord?.status)">{{ statusText(currentRecord?.status) }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="归因标签" :span="2">
          <template v-if="currentRecord?.attribution_tag">
            <a-tag v-for="(tag, idx) in splitTag(currentRecord.attribution_tag)" :key="idx" :color="idx === 0 ? 'arcoblue' : 'cyan'" size="small" style="margin-right: 4px">{{ tag }}</a-tag>
          </template>
          <span v-else>--</span>
        </a-descriptions-item>
        <a-descriptions-item label="影响面">
          <template v-if="currentRecord?.impact_score !== null && currentRecord?.impact_score !== undefined">
            <a-tag :color="impactColor(currentRecord.impact_level)" size="small">{{ currentRecord.impact_level }}</a-tag>
            <span style="margin-left: 6px">{{ currentRecord.impact_score }} 分</span>
          </template>
          <span v-else>未评分</span>
        </a-descriptions-item>
        <a-descriptions-item label="分析维度">{{ currentRecord?.analysis_dimension || '--' }}</a-descriptions-item>
        <a-descriptions-item v-if="impactRows(currentRecord || {}).length" label="影响面构成" :span="2">
          <div style="line-height: 1.9">
            <div v-for="row in impactRows(currentRecord || {})" :key="row.k" style="display: flex; gap: 10px">
              <span style="width: 90px; color: #86909c">{{ row.k }}</span>
              <span style="flex: 1">{{ row.v }}</span>
            </div>
          </div>
        </a-descriptions-item>
        <a-descriptions-item label="维度">{{ dimensionTypeText(currentRecord?.dimension_type) }} / {{ currentRecord?.dimension_value }}</a-descriptions-item>
        <a-descriptions-item label="产品线">{{ currentRecord?.product_line || '--' }}</a-descriptions-item>
        <a-descriptions-item label="首次出现">{{ currentRecord?.first_found_week || '--' }}</a-descriptions-item>
        <a-descriptions-item label="最近出现">{{ currentRecord?.last_found_week || '--' }}</a-descriptions-item>
        <a-descriptions-item label="是否二开">{{ currentRecord?.is_custom ? '是' : '否' }}</a-descriptions-item>
        <a-descriptions-item label="是否豁免">{{ currentRecord?.is_exempted ? '是' : '否' }}</a-descriptions-item>
        <a-descriptions-item v-if="currentRecord?.exempt_reason" label="豁免原因" :span="2">{{ currentRecord.exempt_reason }}</a-descriptions-item>
        <a-descriptions-item v-if="currentRecord?.issue_id" label="关联问题单" :span="2">
          <a-link @click="gotoIssue(currentRecord.issue_id)">{{ currentRecord.issue_id }}</a-link>
        </a-descriptions-item>
      </a-descriptions>

      <!-- 缺陷报告直接渲染 md 原文。
           原来把 md 内容拆成十几个「框」（精确位置/复现步骤/期望实际/根因/
           修复建议/验证建议…），两个毛病：md 里的耗时分解表格与代码块渲染不出来，
           而那恰是报告最有用的部分；归因提示词一改章节，前端拆框就得跟着改。 -->
      <a-divider>缺陷报告</a-divider>
      <a-spin :loading="mdLoading" style="display: block; min-height: 60px">
        <MdPreview v-if="mdContent" :modelValue="mdContent" />
        <a-alert v-else-if="mdReason" type="info">{{ mdReason }}</a-alert>
        <a-empty v-else description="暂无缺陷报告" />
      </a-spin>
      <div v-if="mdMeta" style="margin-top: 6px; color: #86909c; font-size: 12px">
        来源：{{ mdMeta.run_date }} / {{ mdMeta.file }}（{{ Math.round((mdMeta.bytes || 0) / 1024) }} KB{{ mdMeta.truncated ? '，已截断' : '' }}）
      </div>

      <!-- 追加分析放在缺陷报告后面：质疑通常是看完报告才提的，
           放在前面等于让人先写意见再看内容。 -->
      <a-divider>再次分析</a-divider>
      <a-alert type="normal" style="margin-bottom: 10px">
        写明你的方向或质疑，AI 会带着它重新读原始日志与报告，然后判断是<strong>修正这一条</strong>、
        <strong>拆出新的一条</strong>，还是<strong>认为原结论仍然成立</strong>。
        质疑写得越具体（哪一行日志、哪个时间戳对不上）复核越准。
      </a-alert>
      <a-textarea
        v-model="reanalysisText"
        :auto-size="{ minRows: 3, maxRows: 8 }"
        placeholder="例：这份报告说空档前最后一条日志是 A，但我核对原始 xls 是 B（时间戳 14:10:53.517），而且 A 的出口日志在空档之前就打印了，说明它已经返回。"
        :max-length="2000"
        show-word-limit
      />
      <div style="margin-top: 8px">
        <a-button type="primary" :loading="reanalysisSubmitting" @click="submitReanalysis">提交复核</a-button>
        <span style="margin-left: 10px; color: #86909c; font-size: 12px">
          复核要读原始 Excel、跑分组脚本、查源码，通常几分钟。结果会自动刷新。
        </span>
      </div>

      <div v-if="reanalysisList.length" style="margin-top: 14px">
        <a-timeline>
          <a-timeline-item
            v-for="r in reanalysisList"
            :key="r.id"
            :dot-color="r.status === 'failed' ? '#f53f3f' : r.status === 'running' ? '#ff7d00' : '#00b42a'"
          >
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap">
              <span style="color: #86909c; font-size: 12px">{{ formatTime(r.created_at) }}</span>
              <a-tag v-if="r.challenger_name" size="small">{{ r.challenger_name }}</a-tag>
              <a-tag v-if="r.status === 'running'" color="orange" size="small">复核中</a-tag>
              <a-tag v-else-if="r.status === 'failed'" color="red" size="small">失败</a-tag>
              <a-tag v-else :color="decisionMeta(r.decision).color" size="small">{{ decisionMeta(r.decision).text }}</a-tag>
              <!-- create 时结果是另一条台账，给出提示让人去找那条 -->
              <span v-if="r.decision === 'create' && r.result_pattern_id" style="font-size: 12px; color: #86909c">
                新条目已生成，可在列表中查看
              </span>
            </div>
            <div class="content-block" style="margin-top: 6px">
              <strong>质疑：</strong>{{ r.challenge }}
            </div>
            <div v-if="r.decision_reason" class="content-block" style="margin-top: 6px">
              <strong>复核结论：</strong>
              <pre style="white-space: pre-wrap; margin: 4px 0; font-family: inherit">{{ r.decision_reason }}</pre>
            </div>
            <a-alert v-if="r.error_message" type="error" style="margin-top: 6px">{{ r.error_message }}</a-alert>
            <div v-if="r.input_log_files?.length || r.input_report_md" style="margin-top: 4px; color: #86909c; font-size: 12px">
              送检证据：{{ r.input_log_files?.length || 0 }} 份原始日志{{ r.input_report_md ? ' + 报告全文' : '' }}
            </div>
          </a-timeline-item>
        </a-timeline>
      </div>

      <a-divider>涉及对象 (involved_object)</a-divider>
      <div class="content-block">{{ currentRecord?.involved_object || '暂无' }}</div>

      <a-divider>证据 (evidence)</a-divider>
      <div v-if="currentRecord?.evidence && typeof currentRecord.evidence === 'object'" class="content-block">
        <template v-for="(val, key) in currentRecord.evidence" :key="key">
          <div style="margin-bottom: 8px">
            <strong>{{ key }}：</strong>
            <pre style="white-space: pre-wrap; margin: 4px 0">{{ typeof val === 'string' ? val : JSON.stringify(val, null, 2) }}</pre>
          </div>
        </template>
      </div>
      <div v-else class="content-block">暂无</div>

      <a-divider>影响客户 (customer_names)</a-divider>
      <div v-if="currentRecord?.customer_names && Array.isArray(currentRecord.customer_names)" class="content-block">
        <a-tag v-for="(name, idx) in currentRecord.customer_names" :key="idx" style="margin: 2px">{{ name }}</a-tag>
      </div>
      <div v-else class="content-block">暂无</div>

      <a-divider>影响表单 (form_keys)</a-divider>
      <div v-if="currentRecord?.form_keys && Array.isArray(currentRecord.form_keys)" class="content-block">
        <a-tag v-for="(fk, idx) in currentRecord.form_keys" :key="idx" size="small" style="margin: 2px">{{ fk }}</a-tag>
      </div>
      <div v-else class="content-block">暂无</div>

      <a-divider>样本 Trace IDs</a-divider>
      <div v-if="currentRecord?.sample_trace_ids" class="content-block">
        <div v-for="tid in traceIdList(currentRecord.sample_trace_ids)" :key="tid" style="margin-bottom: 4px">
          <a-typography-paragraph copyable style="margin: 0">{{ tid }}</a-typography-paragraph>
        </div>
      </div>
      <div v-else class="content-block">暂无</div>

      <template #footer>
        <a-space>
          <a-button @click="drawerVisible = false">关闭</a-button>
          <!-- tooltip 必须包在 span 上：Arco 的 disabled 按钮不派发鼠标事件，
               直接把 a-tooltip 套在 a-button 外面时，禁用态下浮动提示不会弹 ——
               而"为什么不能点"恰恰是禁用态最需要说明的。 -->
          <a-tooltip :content="bundleTip(currentRecord)">
            <span style="display: inline-block">
              <a-button
                type="primary"
                status="success"
                :loading="logsDownloading"
                :disabled="!hasBundle(currentRecord)"
                @click="handleLogsDownload()"
              >下载关联文件</a-button>
            </span>
          </a-tooltip>
        </a-space>
      </template>
    </a-drawer>

    <a-modal v-model:visible="linkIssueVisible" title="关联已有问题跟踪" :width="520" @ok="handleLinkIssue">
      <a-alert type="warning" style="margin-bottom: 12px">请输入问题跟踪的内部 ID（不是标题）。后端会校验问题真实存在且未删除。</a-alert>
      <a-input v-model="linkIssueId" placeholder="perf_issue.id" allow-clear />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Message, Modal } from '@arco-design/web-vue'
import { ApiPerfPatternLedger } from '@/api/perfApis'
import { formatTime, useDownload, useGet, usePost, useTableAutoHeight, useAutoHeight } from '@/hooks'
import { MdPreview } from 'md-editor-v3'
// 必须导入样式，否则 MdPreview 渲染出来没有任何格式（表格无边框、标题不分级）
import 'md-editor-v3/lib/style.css'
import IssueScopeTree from '@/views/perf/components/IssueScopeTree.vue'

defineOptions({ name: 'pattern-ledger' })

// 布局行高度实测（左树靠它才能内部滚动，见模板处说明）
const layoutRow = ref<HTMLElement>()
const { height: layoutRowH } = useAutoHeight(layoutRow)

const router = useRouter()
const pageNum = ref(1)
const pageSize = ref(20)
const scopeTreeKey = ref(0)
const searchForm = reactive({
  keyword: '',
  product_line: '',
  dimension_type: '',
  dimension_value: '',
  attribution_tag: '',
  status: '',
  project_group_code: '',
  cloud_number: '',
  business_area: '',
  product_domain: '',
  app_number: '',
  form_id: '',
})
const scopeCountFilters = computed(() => ({
  keyword: searchForm.keyword,
  dimension_type: searchForm.dimension_type,
  dimension_value: searchForm.dimension_value,
  attribution_tag: searchForm.attribution_tag,
  status: searchForm.status,
}))
const drawerVisible = ref(false)
const currentRecord = ref<any>(null)
const detailExporting = ref(false)
const logsDownloading = ref(false)

// 表格高度自适应：滚动条落在表格内，表头固定。容器必须是原生 div。
const tableWrap = ref<HTMLElement>()
// fillParent：容器是定高 flex 列里的 flex:1 子项，高度已确定。
// 从视口反推会与这块空间差出一截，表格就会溢出、把整栏顶出一条外层滚动条（表现为"新发现"那行跟着滚）。
const { tableHeight } = useTableAutoHeight(tableWrap, { fillParent: true })

// ── 映射 ──────────────────────────────────────

const linkIssueVisible = ref(false)
const linkIssueId = ref('')
const linkPattern = ref<any>(null)

const getDefectReport = (record: any) => record?.evidence?.defect_report || null
// 新链路的 evidence 是 md 报告路径数组，如 ["01_task_approve__click/defect_1.md"]。
// 旧链路把整个 DefectReport 结构内联在 evidence.defect_report 里。
// 两种都算「有完整报告」—— 只认旧结构会让所有新台账的「生成问题」都点不了，
// 而且提示「旧台账没有完整缺陷报告」正好把话说反：报告是完整的，只是格式变了。
const getReportFiles = (record: any): string[] => {
  const ev = record?.evidence
  if (!Array.isArray(ev)) return []
  return ev.filter((x: any) => typeof x === 'string' && x.endsWith('.md'))
}
const hasDefectReport = (record: any) => !!getDefectReport(record) || getReportFiles(record).length > 0
const defectStatusText = (status: string) => ({ complete: '完整', evidence_insufficient: '证据不足', pending_retry: '待重试' }[status] || status || '--')
const statusMap: Record<string, string> = {
  new: '新发现', issued: '已提单', scheduled: '已排期', fixing: '修复中',
  fixed: '已修复', verified: '已验证', recurrent: '复发', closed: '已关闭', exempted: '已豁免',
}
const statusText = (s: string | undefined) => (s ? statusMap[s] || s : '--')
const statusColor = (s: string | undefined) => ({
  new: 'orange', issued: 'blue', scheduled: 'purple', fixing: 'purple',
  fixed: 'cyan', verified: 'green', recurrent: 'red', closed: 'gray', exempted: 'gray',
}[s || ''] || 'gray')
function dimensionTypeText(t: string | undefined) {
  const labels: Record<string, string> = {
    product_domain: '产品领域',
    business_area: '业务领域',
    project_group: '项目组',
    application: '应用',
  }
  return labels[t || ''] || t || '--'
}

// 归因标签拆分（一级-二级）
const splitTag = (tag: string): string[] => tag.includes('-') ? tag.split('-', 2) : [tag]

// 周趋势工具
const recentWeeks = (stats: Record<string, number>): Record<string, number> => {
  const keys = Object.keys(stats).sort()
  const recent = keys.slice(-8)
  const result: Record<string, number> = {}
  recent.forEach(k => { result[k] = stats[k] })
  return result
}
const barHeight = (cnt: number): number => Math.min(Math.max(cnt * 4, 2), 28)

// trace id 拆分
const traceIdList = (raw: string): string[] => raw.split(/[,;\s]+/).filter(Boolean)

// ── 数据请求 ──────────────────────────────────────
const queryParams = computed(() => ({ ...searchForm, page_num: pageNum.value, page_size: pageSize.value }))
const { isFetching: loading, data: rawData, execute: fetchData } = useGet<any>(ApiPerfPatternLedger.list, queryParams, { immediate: true })
const tableData = computed(() => rawData.value?.list || [])
const statsData = computed(() => rawData.value?.stats || null)

const { downloadWithTip } = useDownload()

const handleExport = async () => {
  const params = new URLSearchParams()
  Object.entries(searchForm).forEach(([key, value]) => { if (value) params.set(key, String(value)) })
  await downloadWithTip(`${ApiPerfPatternLedger.export}?${params.toString()}`, '问题台账.xlsx', '问题台账导出失败')
}


/**
 * 该台账是否有可打包的内容。
 *
 * zip 里同时装原始日志与缺陷报告 md，**两者都没有**才算无内容。
 * 判据用台账自带字段，不额外发请求：有样本 trace 说明能定位日志；
 * 有 md（详情已拉到）说明至少能给报告。
 */
const hasBundle = (record: any): boolean => {
  if (!record?.id) return false
  const traces = record.sample_trace_ids
  const hasTrace = Array.isArray(traces) ? traces.length > 0 : !!traces
  const isCurrent = record.id === currentRecord.value?.id
  return hasTrace || (isCurrent && !!mdContent.value)
}

const bundleTip = (record: any): string =>
  hasBundle(record)
    ? '打包该问题的原始天梯日志与缺陷报告 md'
    : '该台账没有可打包的日志与缺陷报告（无样本 trace，也没有报告文件）'

// 下载该问题命中的原始天梯日志与缺陷报告 md（同一个 zip）。
const handleLogsDownload = async (target?: any) => {
  // **必须挡掉 MouseEvent**：模板里写 `@click="handleLogsDownload"`（不带括号）时
  // Vue 会把事件对象当第一个参数传进来，于是 target 是 MouseEvent、
  // record.id 为 undefined，函数静默 return —— 表现就是「点了没反应、没有请求」。
  const fromEvent = target && typeof target === 'object' && 'preventDefault' in target
  const record = (fromEvent ? null : target) || currentRecord.value
  if (!record?.id) return
  logsDownloading.value = true
  try {
    await downloadWithTip(
      `${ApiPerfPatternLedger.logs}?id=${encodeURIComponent(record.id)}`,
      `${record.pattern_no || '问题台账'}-关联文件.zip`,
      '打包失败：日志可能已过留存期被清理，或任务工作目录已变更',
    )
  } finally {
    logsDownloading.value = false
  }
}

// 生成问题按钮的禁用原因，直接写在 tooltip 里避免用户猜。
const createIssueTip = (record: any): string => {
  if (record?.issue_id) return `已生成问题 ${record.issue_id}，可从"更多"查看`
  if (!hasDefectReport(record)) return '该台账没有关联缺陷报告，不能自动提单'
  return '从完整缺陷报告生成问题跟踪'
}

// 操作列只保留 详情/生成问题/更多，其余动作收进下拉。
const handleMoreAction = (key: string, record: any) => {
  switch (key) {
    case 'viewIssue':
      if (record.issue_id) gotoIssue(record.issue_id)
      break
    case 'linkIssue':
      openLinkIssue(record)
      break
    case 'logs':
      void handleLogsDownload(record)
      break
    default:
      break
  }
}
const pagination = computed(() => ({ current: pageNum.value, pageSize: pageSize.value, total: rawData.value?.total || 0, showTotal: true, showPageSize: true }))

// ── 操作 ──────────────────────────────────────
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
    keyword: '', product_line: '', dimension_type: '', dimension_value: '', attribution_tag: '', status: '',
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
// 改每页条数必须同时回到第 1 页：原本停在第 5 页、条数改大后该页往往已超出总页数，
// 后端返回空列表，看起来像"数据没了"。
const handlePageSizeChange = (size: number) => { pageSize.value = size; pageNum.value = 1; fetchData() }
// ── 缺陷报告 md 原文 ──────────────────────────────────
// 直接渲染 md 而不是把内容拆成十几个框：md 里的耗时分解表格与代码块是报告
// 最有用的部分，拆框会丢掉；而且归因提示词一改章节，拆框逻辑就得跟着改。
const mdContent = ref('')
const mdReason = ref('')
const mdMeta = ref<any>(null)
const mdLoading = ref(false)
const mdPayload = ref<any>({})
const { execute: fetchPatternMd } = useGet<any>(ApiPerfPatternLedger.reportMd, mdPayload, {
  immediate: false,
  onSuccess(data: any) {
    const d = data || {}
    mdContent.value = d.markdown || ''
    mdReason.value = d.found ? '' : (d.reason || '')
    mdMeta.value = d.found ? d : null
  },
})

// ── 影响面：分数 + 悬停明细 ────────────────────────────────
//
// 单看一个分数没法判断，所以悬停要把六项输入连同它们怎么合成一起给出来。
// 「78 分」看不出什么，「4331 人次 / 3 个客户 / 平均 1.7 秒」才能拿去排期。
const fmtMs = (ms?: number | null) => {
  if (ms === null || ms === undefined) return '--'
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

const impactColor = (level?: string) => {
  switch (level) {
    case 'P0': return 'red'
    case 'P1': return 'orange'
    case 'P2': return 'blue'
    default: return 'gray'
  }
}

const impactRows = (record: any) => {
  const i = record.impact_inputs || {}
  const rows: { k: string, v: string }[] = []
  if (i.affected_users !== undefined) {
    const src = i.slow_total ? `该操作超3秒 ${i.slow_total} 次中的份额` : '按本问题命中数'
    rows.push({ k: '受影响人次', v: `${i.affected_users} 次/30天（${src}）` })
  }
  if (i.customer_count !== undefined) rows.push({ k: '影响客户', v: `${i.customer_count} 个` })
  if (i.avg_ms !== undefined && i.avg_ms !== null) {
    // 达标线 3 秒：低于它说明这个操作整体不慢，慢的是其中一部分请求
    const tail = i.avg_ms >= 3000 ? '（已超达标线）' : '（整体未超线，慢在部分请求）'
    rows.push({ k: '平均响应', v: `${fmtMs(i.avg_ms)}${tail}` })
  }
  if (i.clicks !== undefined) {
    const ratio = i.slow_ratio_pct !== null && i.slow_ratio_pct !== undefined ? `，慢占比 ${i.slow_ratio_pct}%` : ''
    rows.push({ k: '操作点击量', v: `${i.clicks} 次/30天${ratio}` })
  }
  if (record.analysis_dimension) rows.push({ k: '分析维度', v: record.analysis_dimension })
  // 口径必须显示：表单级是估算（含该表单其它操作），那 106 条要让人知道
  if (i.granularity) rows.push({ k: '统计口径', v: `${i.granularity}，${i.window || ''}` })
  if (record.expected_avg_ms !== null && record.expected_avg_ms !== undefined) {
    rows.push({
      k: '治理预期',
      // 措辞必须是「即使…仍」：脚本假设该段降为 0，做不到的部分它判断不了
      v: `当前 ${fmtMs(record.current_avg_ms)}，即使该段完全消除仍有 ${fmtMs(record.expected_avg_ms)}`
        + (record.expected_meet_ratio !== null && record.expected_meet_ratio !== undefined
          // 这个比例决定「这条能不能单独修」：13% 意味着修完大部分请求仍超标
          ? `（按此上限约 ${Math.round(Number(record.expected_meet_ratio))}% 的请求可进 3 秒内）`
          : ''),
    })
  }
  return rows
}

const handleDetail = (record: any) => {
  currentRecord.value = record
  drawerVisible.value = true
  // 每次打开先清空，避免看到上一条台账的报告
  mdContent.value = ''
  mdReason.value = ''
  mdMeta.value = null
  const key = record?.pattern_no || record?.id
  if (!key) return
  mdPayload.value = { pattern: key }
  mdLoading.value = true
  fetchPatternMd().finally(() => { mdLoading.value = false })
  loadReanalysis(record?.id)
}

// ── 追加分析：人工带着方向或质疑要求 AI 重新判一次 ────────────
//
// 归因是一次性的 AI 判断，判错了原来没有回路。实测审计五份报告，其中一份把
// 空档起点看错了一行，然后顺着错起点写出带源码行号和逐行注释的根因 ——
// 那种错只有人核对原始日志才能发现，发现之后需要一条「带着我的质疑重看一遍」的路径。
const reanalysisText = ref('')
const reanalysisSubmitting = ref(false)
const reanalysisList = ref<any[]>([])
const reanalysisPayload = ref<any>({})
let reanalysisTimer: ReturnType<typeof setTimeout> | null = null

const { execute: fetchReanalysis } = useGet<any>(ApiPerfPatternLedger.reanalysisHistory, reanalysisPayload, {
  immediate: false,
  onSuccess(data: any) {
    reanalysisList.value = Array.isArray(data) ? data : []
    // 还在跑就继续轮询。AI 要读 xls、跑脚本、查源码，实测 2 分钟量级，
    // 不轮询的话人要自己刷新页面才知道跑完了。
    stopReanalysisPoll()
    if (reanalysisList.value.some((x) => x.status === 'running')) {
      reanalysisTimer = setTimeout(() => loadReanalysis(currentRecord.value?.id), 15000)
    }
  },
})

const stopReanalysisPoll = () => {
  if (reanalysisTimer) {
    clearTimeout(reanalysisTimer)
    reanalysisTimer = null
  }
}

const loadReanalysis = (patternId?: string) => {
  stopReanalysisPoll()
  reanalysisList.value = []
  if (!patternId) return
  reanalysisPayload.value = { pattern_id: patternId }
  fetchReanalysis()
}

const reanalysisPostPayload = ref<any>({})
const { execute: doReanalysis } = usePost<any>(ApiPerfPatternLedger.reanalysis, reanalysisPostPayload, {
  immediate: false,
  onSuccess() {
    Message.success('已提交，AI 正在复核（约几分钟），结果会出现在下面的记录里')
    reanalysisText.value = ''
    loadReanalysis(currentRecord.value?.id)
  },
})

const submitReanalysis = async () => {
  const text = reanalysisText.value.trim()
  if (!text) {
    Message.warning('请先写明你的方向或质疑 —— 没有输入就没有复核的依据')
    return
  }
  const patternId = currentRecord.value?.id
  if (!patternId) return
  reanalysisPostPayload.value = { pattern_id: patternId, challenge: text }
  reanalysisSubmitting.value = true
  await doReanalysis().finally(() => { reanalysisSubmitting.value = false })
}

const decisionMeta = (d?: string) => {
  switch (d) {
    case 'update':
      return { color: 'orange', text: '已修正原条目' }
    case 'create':
      return { color: 'arcoblue', text: '已拆出新条目' }
    // reject 是正当结论，不是失败 —— 原结论对的时候说它对，比编一个改动有价值
    case 'reject':
      return { color: 'gray', text: '质疑不成立，未改动' }
    default:
      return { color: 'gray', text: d || '--' }
  }
}

// 抽屉关掉就停轮询，不然切到别的页面还在发请求
watch(drawerVisible, (v) => {
  if (!v) stopReanalysisPoll()
})
onUnmounted(stopReanalysisPoll)
const gotoIssue = (issueId: string) => {
  // '/perf/issue' 在生产菜单里不存在（问题追踪目录是 /cloud-perf/issue，且它是
  // 目录节点不能直接访问），真正的页面是 issue-list。按路由名跳转，不受菜单层级变动影响。
  router.push({ name: 'issue-list', query: { keyword: issueId } })
}

const createIssuePayload = ref<any>({})
const { data: createIssueResult, execute: doCreateIssue } = usePost<any>(ApiPerfPatternLedger.createIssue, createIssuePayload, { immediate: false })
const savePatternPayload = ref<any>({})
const { execute: doSavePattern } = usePost<any>(ApiPerfPatternLedger.save, savePatternPayload, { immediate: false })

const performCreateIssue = async (record: any, confirmEvidenceInsufficient: boolean) => {
  createIssuePayload.value = { id: record.id, confirm_evidence_insufficient: confirmEvidenceInsufficient }
  await doCreateIssue()
  const result = createIssueResult.value
  Message.success(result?.created === false ? `已关联问题 ${result?.issue_no || ''}` : `问题 ${result?.issue_no || ''} 创建成功`)
  await fetchData()
}

const handleCreateIssue = (record: any) => {
  const report = getDefectReport(record)
  const files = getReportFiles(record)
  if (!report && files.length === 0) {
    Message.warning('该台账没有关联缺陷报告，不能自动生成问题')
    return
  }
  // 新链路没有 issue_ready / problem_hash 这两个字段（它们属于旧的内联结构），
  // 证据是否充分由归因时的硬性取证要求保证，这里不再让用户二次确认。
  const insufficient = !!report && !report.issue_ready
  Modal.confirm({
    title: insufficient ? '以待补证问题提单？' : '生成问题跟踪？',
    content: insufficient
      ? '当前缺陷报告明确标记为证据不足。继续后将创建真实问题单，并保留缺失证据与待补证说明。'
      : report
        ? `将从问题 ${report.problem_hash} 的完整缺陷报告创建真实问题跟踪，并原子回填台账关联。`
        : `将从缺陷报告 ${files.join('、')} 创建问题跟踪，并原子回填台账关联。`,
    okText: insufficient ? '确认待补证提单' : '确认生成',
    onOk: () => performCreateIssue(record, insufficient),
  })
}

const openLinkIssue = (record: any) => {
  linkPattern.value = record
  linkIssueId.value = ''
  linkIssueVisible.value = true
}

const handleLinkIssue = async () => {
  if (!linkIssueId.value.trim()) { Message.warning('请输入问题 ID'); return false }
  savePatternPayload.value = { id: linkPattern.value.id, issue_id: linkIssueId.value.trim(), status: 'issued' }
  await doSavePattern()
  Message.success('关联成功')
  linkIssueVisible.value = false
  await fetchData()
  return true
}
</script>

<style scoped>
/* 统计标签按内容排布、放不下才换行（原来用 a-col 无 span，每个占满一行） */
.stats-line {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-bottom: 12px;
}

/* 归属查不到时的占位。用弱化色而不是留空：留空看不出是「没查到」还是「渲染漏了」。 */
.muted { color: var(--color-text-4); }

.content-block {
  white-space: pre-wrap;
  background: var(--color-fill-1);
  padding: 12px;
  border-radius: 4px;
}
.weekly-bar {
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
  height: 30px;
}
.bar-item {
  width: 6px;
  background: rgb(var(--arcoblue-5));
  border-radius: 1px;
}
/* height 由模板实测给出；min-height 只作为极小窗口下的兜底 */
.scope-layout { display: flex; gap: 16px; min-height: 420px; }
.scope-panel { width: 280px; flex-shrink: 0; min-height: 0; padding-right: 12px; border-right: 1px solid var(--color-border-2); }
/* overflow-x 显式 hidden：只开 overflow-y 时横向会被计算成 auto，
   而 a-row 的 gutter 用负外边距探出容器，会凭空多一条横向滚动条 */
/*
  右栏做纵向 flex，**自己不滚**。

  之前给它 overflow-y:auto，结果整栏（统计行 + 表格）一起滚 ——
  统计行会跟着滚走，而且表头也一起离开视口。
  正确的分工是：统计行固定、表格吃掉剩余高度、滚动发生在**表格体内部**
  （Arco 的 .arco-table-body 自带 overflow:auto，表头固定不动）。
*/
.scope-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  /* min-height:0 是子项能被压缩到内容以下的前提，缺了它表格撑高整栏 */
  min-height: 0;
}

/* 统计行固定不滚 */
.stats-line {
  flex-shrink: 0;
}

/* 表格容器吃掉剩余高度；配合 fillParent 让表格体高度正好等于这块空间 */
.scope-content > div[ref],
.table-fill {
  flex: 1;
  min-height: 0;
}
</style>
