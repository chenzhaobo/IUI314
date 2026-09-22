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
          <!-- 项目组：生产上有 9 个取值，是真正有区分度的维度。
               原来这里是「维度类型 + 维度值」，但台账 364 条的 dimension_type
               全是 product_domain、dimension_value 全是「集团财务」——
               只有一个取值，填对返回全部、填错返回 0，等于没有筛选作用。 -->
          <a-select
            v-model="searchForm.project_group_code"
            placeholder="项目组"
            allow-clear
            allow-search
          >
            <a-option v-for="g in groupOptions" :key="g.value" :value="g.value">
              {{ g.label }}
            </a-option>
          </a-select>
        </a-col>
        <a-col :span="3">
          <a-select
            v-model="searchForm.business_area"
            placeholder="业务领域"
            allow-clear
            allow-search
          >
            <a-option v-for="a in areaOptions" :key="a" :value="a">{{ a }}</a-option>
          </a-select>
        </a-col>
        <a-col :span="3">
          <!-- 归因标签：下拉选字典值，同时允许手动输入（allow-create）。
               字典 perf_attr_tag 有 23 条且带判定说明；手动输入是为了查
               字典外的历史值（生产上有 11 条产生于标签校验上线前）。 -->
          <a-select
            v-model="searchForm.attribution_tag"
            placeholder="归因标签"
            allow-clear
            allow-search
            allow-create
          >
            <a-option v-for="t in tagOptions" :key="t.value" :value="t.value">
              {{ t.label }}
            </a-option>
          </a-select>
        </a-col>
        <a-col :span="3">
          <a-select v-model="searchForm.status" placeholder="状态" allow-clear>
            <a-option value="new">待处置</a-option>
            <a-option value="issued">已提单</a-option>
            <a-option value="wont_fix">不处理</a-option>
            <a-option value="observing">观察</a-option>
          </a-select>
        </a-col>
        <a-col :span="6">
          <!-- 搜索区只留查询/重置：业务按钮与筛选不是一个语义，混在一行里
               按钮一多就把整排挤出画面（按钮还在，但窄窗口下点不到）。 -->
          <a-space>
            <a-button type="primary" @click="handleSearch">查询</a-button>
            <a-button @click="handleReset">重置</a-button>
          </a-space>
        </a-col>
      </a-row>

      <!--
        业务操作工具行（容器样式与 ListPage 的 .lp-toolbar 一致：flex + wrap，
        放不下时换行而不是横向溢出画面）。两个关键点：

        1. 计数与禁用看**可操作行数**，不是勾选数 —— 选中集合里混着已提单的行时，
           按钮上是它真能动的那几条（如「观察 (3)」），点下去也只提交这几条，
           其余在结果里报"跳过 N 条"。原来只看勾选数，一点就是整批被后端拒绝。
        2. 规则表在 ledgerActions.ts，与行内「更多」菜单共用同一份 —— 不再一处按
           状态 v-if、另一处完全不判断。
      -->
      <div class="ledger-toolbar">
        <a-tooltip :content="batchHint('convert')" :disabled="toolbarCount('convert') > 0">
          <span class="toolbar-btn">
            <a-button type="outline" status="success" :loading="converting" :disabled="toolbarCount('convert') === 0" @click="handleCreateIssueBatch">
              转缺陷{{ countSuffix(toolbarCount('convert')) }}
            </a-button>
          </span>
        </a-tooltip>
        <a-tooltip :content="batchHint('edit')" :disabled="toolbarCount('edit') > 0">
          <span class="toolbar-btn">
            <a-button type="outline" :disabled="toolbarCount('edit') === 0" @click="openEditAttribution">
              修改{{ countSuffix(toolbarCount('edit')) }}
            </a-button>
          </span>
        </a-tooltip>
        <!-- 「不处理」与「废弃」分开放，措辞也刻意不同：
             不处理 = 这个问题判断不修（仍进报告与统计）；
             废弃   = 这条分析不该存在（从指纹匹配里移除）。 -->
        <a-tooltip :content="batchHint('wontFix')" :disabled="toolbarCount('wontFix') > 0">
          <span class="toolbar-btn">
            <a-button type="outline" status="warning" :loading="triaging" :disabled="toolbarCount('wontFix') === 0" @click="openTriageBatch">
              不处理{{ countSuffix(toolbarCount('wontFix')) }}
            </a-button>
          </span>
        </a-tooltip>
        <a-tooltip :content="batchHint('observe')" :disabled="toolbarCount('observe') > 0">
          <span class="toolbar-btn">
            <a-button type="outline" :loading="triaging" :disabled="toolbarCount('observe') === 0" @click="handleObserveSelected">
              观察{{ countSuffix(toolbarCount('observe')) }}
            </a-button>
          </span>
        </a-tooltip>
        <!-- 撤回：把「不处理 / 观察」的判断撤掉（连处置人一起清）。
             中性样式 —— 它是撤销，不是又一次判断。 -->
        <a-tooltip :content="batchHint('restore')" :disabled="toolbarCount('restore') > 0">
          <span class="toolbar-btn">
            <a-button :loading="triaging" :disabled="toolbarCount('restore') === 0" @click="handleRestoreSelected">
              撤回待处置{{ countSuffix(toolbarCount('restore')) }}
            </a-button>
          </span>
        </a-tooltip>
        <a-tooltip :content="batchHint('discard')" :disabled="toolbarCount('discard') > 0">
          <span class="toolbar-btn">
            <a-button status="danger" :loading="discarding" :disabled="toolbarCount('discard') === 0" @click="handleDiscardSelected">
              废弃{{ countSuffix(toolbarCount('discard')) }}
            </a-button>
          </span>
        </a-tooltip>
        <a-button status="warning" :loading="impactRecomputing" @click="handleRecomputeImpact">
          重算影响面
        </a-button>
        <a-button status="success" @click="handleExport">导出 Excel</a-button>
      </div>

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
 @page-size-change="handlePageSizeChange" row-key="id" column-resizable :scroll="{ minWidth: 1800, y: tableHeight }"
 v-model:selected-keys="selectedKeys" :row-selection="rowSelection" @sorter-change="handleSorterChange">
            <template #columns>
              <a-table-column title="编号" data-index="pattern_no" :width="100" ellipsis tooltip />
              <a-table-column title="标题" data-index="title" :width="250" ellipsis tooltip />
              <!-- 影响面放在标题后面：排期时先看它。
                   分数本身说明不了什么，所以悬停给出六项输入和它们怎么合成 ——
                   看到「78 分」没用，看到「4331 人次 / 3 个客户 / 平均 1.7 秒」才能判断。 -->
              <!-- 影响面/分析权重用共用单元格（ImpactCell / AnalysisWeightCell）：
                   问题列表也要显示同样两个分数，口径只能有一份。 -->
              <a-table-column title="影响面" :width="110" :sortable="{ sortDirections: ['descend', 'ascend'] }" data-index="impact_score">
                <template #cell="{ record }">
                  <ImpactCell :record="record" />
                </template>
              </a-table-column>
              <!-- 分析层权重与系统层分开显示：口径不同（全量统计 vs 那轮抽样），
                   两者不一致本身是信息 —— 系统层低而这里高说明低频但高度集中。 -->
              <a-table-column title="分析权重" :width="96" data-index="analysis_weight" :sortable="{ sortDirections: ['descend', 'ascend'] }">
                <template #cell="{ record }">
                  <AnalysisWeightCell :record="record" />
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
              <!-- 显示名称、编码放 tooltip：列宽有限，而名称才是人认得的 -->
              <a-table-column title="项目组" data-index="project_group_code" :width="120">
                <template #cell="{ record }">
                  <a-tag v-if="record.project_group_code" color="arcoblue" size="small" :title="record.project_group_code">
                    {{ record.project_group_name || record.project_group_code }}
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
              <!-- 归属三字段。库里一直有值（生产 357 条的项目组 100% 有值），
                   只是页面没展示 —— 而这三个字段决定问题分给哪个团队。
                   项目组显示名称而不是 PM0xx 编码：光看编码认不出是哪个组。 -->
              <a-table-column title="项目组" :width="130" ellipsis tooltip>
                <template #cell="{ record }">
                  {{ record.project_group_name || record.project_group_code || '—' }}
                </template>
              </a-table-column>
              <a-table-column title="应用" data-index="app_number" :width="90" ellipsis tooltip />
              <a-table-column title="业务领域" data-index="business_area" :width="100" ellipsis tooltip />
              <a-table-column title="修改人" :width="110" ellipsis tooltip>
                <template #cell="{ record }">
                  <a-tooltip v-if="record.last_modified_by" :content="`修改时间 ${formatTime(record.last_modified_at)}`">
                    <span>{{ record.last_modified_by }}</span>
                  </a-tooltip>
                  <span v-else style="color: var(--color-text-4)">—</span>
                </template>
              </a-table-column>
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
              <!-- 「豁免」列去掉了：它和状态里的「不处理」是同一件事（is_exempted 由
                   处置动作维护），两列并排显示等于让人自己核对是否一致。
                   换成处置留痕 —— 这两列回答的是「这条有没有人看过、谁看的」，
                   而在此之前那个问题在界面上根本无从回答（生产 61 条全部无人处置）。 -->
              <a-table-column title="处置人" data-index="triaged_by" :width="90">
                <template #cell="{ record }">
                  <a-tag v-if="record.triaged_by" size="small">{{ record.triaged_by }}</a-tag>
                  <a-tooltip v-else content="还没有人对这条下过判断">
                    <span style="color: #f53f3f">待处置</span>
                  </a-tooltip>
                </template>
              </a-table-column>
              <a-table-column title="处置时间" :width="150" ellipsis tooltip>
                <template #cell="{ record }">{{ record.triaged_at ? formatTime(record.triaged_at) : '--' }}</template>
              </a-table-column>
              <!-- 时间列放最后：排查「这条台账是什么时候建的、最近一次命中是什么时候」
                   靠周趋势看不出来，而回填/合并过的台账更需要看 updated_at。 -->
              <!-- 时间统一走 formatTime 转本地时区。直接绑字段会把后端的
                   UTC 字符串原样显示（差 8 小时），看起来像数据错了。 -->
              <a-table-column title="创建时间" :width="150" ellipsis tooltip data-index="created_at" :sortable="{ sortDirections: ['descend', 'ascend'] }">
                <template #cell="{ record }">{{ formatTime(record.created_at) }}</template>
              </a-table-column>
              <a-table-column title="更新时间" :width="150" ellipsis tooltip data-index="updated_at" :sortable="{ sortDirections: ['descend', 'ascend'] }">
                <template #cell="{ record }">{{ formatTime(record.updated_at) }}</template>
              </a-table-column>
              <a-table-column title="操作" :width="150" fixed="right">
                <template #cell="{ record }">
                  <a-space>
                    <a-link @click="handleDetail(record)">详情</a-link>
                    <!--
                      动作全部收进「更多」：入口显隐由 ledgerActions.ts 的规则表决定，
                      与工具栏用同一份判断（此前内联按钮一套 v-if、工具栏另一套）。
                      已提单的行只剩「查看问题 / 下载关联文件」—— 它的生命周期
                      已经交给问题跟踪，台账侧完全只读。
                    -->
                    <a-dropdown @select="(key: any) => handleMoreAction(String(key), record)">
                      <a-link>更多<icon-down /></a-link>
                      <template #content>
                        <a-doption v-if="ledgerStateOf(record) === 'issued'" value="viewIssue">查看问题</a-doption>
                        <a-doption v-if="canLedgerAction('convert', record)" value="createIssue" :disabled="!hasDefectReport(record)">
                          <!-- 提示挂在内部 span 上：禁用的 doption 本身不派发鼠标事件 -->
                          <a-tooltip :content="createIssueTip(record)">
                            <span style="display: inline-block; width: 100%">转缺陷…</span>
                          </a-tooltip>
                        </a-doption>
                        <a-doption v-if="canLedgerAction('link', record)" value="linkIssue">关联已有问题</a-doption>
                        <!-- 处置：看完之后"不修"或"再观察"要有落点，否则「没人看过」与
                             「看过并决定不处理」在数据上完全一样。 -->
                        <a-doption v-if="canLedgerAction('wontFix', record)" value="wontFix">标记不处理…</a-doption>
                        <a-doption v-if="canLedgerAction('observe', record)" value="observing">标记观察</a-doption>
                        <a-doption v-if="canLedgerAction('restore', record)" value="restore">撤回待处置</a-doption>
                        <a-doption value="logs" :disabled="!hasBundle(record)">
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
        <!-- 处置留痕：把"谁在什么时候下了这个判断"和判断本身放在一起。
             原因复用 exempt_reason，不处理时必填。 -->
        <a-descriptions-item label="处置">
          <template v-if="currentRecord?.triaged_by || currentRecord?.triaged_at">
            <a-tag v-if="currentRecord?.triaged_by" size="small">{{ currentRecord.triaged_by }}</a-tag>
            <span style="color: #86909c; font-size: 12px">{{ formatTime(currentRecord?.triaged_at) }}</span>
          </template>
          <span v-else style="color: #f53f3f">还没有人对这条下过判断</span>
        </a-descriptions-item>
        <a-descriptions-item v-if="currentRecord?.exempt_reason" label="不处理原因" :span="2">
          {{ currentRecord.exempt_reason }}
        </a-descriptions-item>
        <a-descriptions-item label="归因标签" :span="2">
          <template v-if="currentRecord?.attribution_tag">
            <a-tag v-for="(tag, idx) in splitTag(currentRecord.attribution_tag)" :key="idx" :color="idx === 0 ? 'arcoblue' : 'cyan'" size="small" style="margin-right: 4px">{{ tag }}</a-tag>
          </template>
          <span v-else>--</span>
        </a-descriptions-item>
        <a-descriptions-item label="影响面">
          <ImpactCell :record="currentRecord || {}" />
        </a-descriptions-item>
        <a-descriptions-item label="分析权重">
          <AnalysisWeightCell :record="currentRecord || {}" />
        </a-descriptions-item>
        <a-descriptions-item label="分析维度">{{ currentRecord?.analysis_dimension || '--' }}</a-descriptions-item>
        <!-- 构成明细按来源分段（见 ImpactBreakdown）：617ms 与 5.2s 不是一个口径的东西，
             平铺成一行行数字时会被读成互相矛盾 -->
        <a-descriptions-item label="影响面构成" :span="2">
          <ImpactBreakdown :record="currentRecord || {}" />
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
           放在前面等于让人先写意见再看内容。
           与问题列表详情共用同一个组件，两处行为必须一致。 -->
      <PatternReanalysis :pattern-id="currentRecord?.id" :active="drawerVisible" />

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

    <a-modal v-model:visible="linkIssueVisible" title="关联已有问题跟踪" :width="560" @ok="handleLinkIssue">
      <!-- 原来要求手填 perf_issue.id（一串 scru128）：人记不住，只能先去问题列表
           复制 id 再回来粘贴。改成按编号/标题远程搜索后选择，id 由选项带过来。 -->
      <a-select
        v-model="linkIssueId"
        placeholder="输入问题编号或标题搜索"
        allow-search
        allow-clear
        :filter-option="false"
        :loading="linkIssueLoading"
        style="width: 100%"
        @search="onLinkIssueSearch"
        @change="onLinkIssueChange"
      >
        <a-option v-for="i in linkIssueSelectOptions" :key="i.id" :value="i.id">
          {{ issueOptionLabel(i) }}
        </a-option>
        <template #empty>
          <div style="padding: 8px; color: var(--color-text-3)">
            {{ linkIssueLoading ? '搜索中…' : '无匹配问题，换个编号或标题片段试试' }}
          </div>
        </template>
      </a-select>
      <div style="margin-top: 8px; color: var(--color-text-3); font-size: 12px">
        关联后台账状态变为「已提单」，后续进度到问题跟踪里看。
      </div>
    </a-modal>
    <a-modal v-model:visible="editVisible" title="修改归属" :width="520" @ok="handleEditSubmit">
      <a-alert type="normal" style="margin-bottom: 12px">
        本次修改 {{ toolbarCount('edit') }} 条{{ editSkipped > 0 ? `（已提单的 ${editSkipped} 条不改）` : '' }}。
        只修改归属，不改标签与分析结论 —— 标签参与指纹计算，改了会让跨天判重失效。
        <br />留空的字段保持原值；要清空某个字段请填一个空格。
      </a-alert>
      <a-form :model="editForm" layout="vertical">
        <a-form-item label="项目组">
          <a-select
            v-model="editForm.project_group_code"
            placeholder="不修改"
            allow-clear
            allow-search
            @change="onEditGroupChange"
          >
            <a-option v-for="g in groupOptions" :key="g.value" :value="g.value">{{ g.label }}</a-option>
          </a-select>
        </a-form-item>
        <a-form-item label="应用">
          <a-select v-model="editForm.app_number" placeholder="不修改" allow-clear allow-search>
            <a-option v-for="a in appOptions" :key="a.value" :value="a.value">{{ a.label }}</a-option>
          </a-select>
        </a-form-item>
        <a-form-item label="业务领域">
          <!-- 选了项目组会自动带出，因为两者是固定关系（库里 314 个组对应 4 个领域）。
               仍可手改：历史数据里有和项目组表不一致的组合。 -->
          <a-select v-model="editForm.business_area" placeholder="选项目组后自动带出" allow-clear allow-search>
            <a-option v-for="a in areaOptions" :key="a" :value="a">{{ a }}</a-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 标记不处理：原因必填。
         这是唯一能回答"当初为什么放过它"的东西 —— 缺了它，下一轮归因判出同一指纹时
         只能重新调研一遍，正是这套治理想省掉的成本。 -->
    <a-modal
      v-model:visible="triageVisible"
      :title="`标记不处理（${triageIds.length} 条）`"
      :width="560"
      :ok-loading="triaging"
      ok-text="确认不处理"
      @ok="submitWontFix"
    >
      <a-alert type="normal" style="margin-bottom: 12px">
        「不处理」表示<strong>这条分析是对的，但这个问题判断不修</strong>；台账仍进报告与统计。
        如果是<strong>分析本身质量差</strong>（结论错、证据不成立），请用「废弃」——
        那会把它从后续指纹匹配里移除。
      </a-alert>
      <a-textarea
        v-model="triageReason"
        :auto-size="{ minRows: 3, maxRows: 6 }"
        placeholder="例：已确认耗时来自客户单据量（单次 12 万成员），当前版本无优化空间，已与业务确认可接受。"
        :max-length="200"
        show-word-limit
      />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import type { LedgerAction } from '@/views/perf/analysis-report/ledgerActions'
import { ref, reactive, computed, watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Message, Modal } from '@arco-design/web-vue'
import { useDebounceFn } from '@vueuse/core'
import { ApiPerfApp, ApiPerfIssue, ApiPerfPatternLedger } from '@/api/perfApis'
import { ApiSecProjectGroup } from '@/api/sechubApis'
import { formatTime, isRequestFailed, useAutoHeight, useDicts, useDownload, useGet, usePost, useTableAutoHeight } from '@/hooks'
import { batchActionHint, canLedgerAction, filterActionable, ledgerStateOf } from '@/views/perf/analysis-report/ledgerActions'
import { MdPreview } from 'md-editor-v3'
// 必须导入样式，否则 MdPreview 渲染出来没有任何格式（表格无边框、标题不分级）
import 'md-editor-v3/lib/style.css'
import { splitTag } from '@/views/perf/components/analysisFields'
import AnalysisWeightCell from '@/views/perf/components/AnalysisWeightCell.vue'
import ImpactBreakdown from '@/views/perf/components/ImpactBreakdown.vue'
import ImpactCell from '@/views/perf/components/ImpactCell.vue'
import IssueScopeTree from '@/views/perf/components/IssueScopeTree.vue'
import PatternReanalysis from '@/views/perf/components/PatternReanalysis.vue'

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
  // 默认只看待处置：这个页面的用途是"决定这些问题要不要修"，而生产实测 61 条里
  // 60 条从来没人下过判断。默认列全部等于把待办埋在已处置的行里 ——
  // 筛选框会显示「待处置」，想看全部清掉它即可。
  status: 'new',
  project_group_code: '',
  cloud_number: '',
  business_area: '',
  product_domain: '',
  app_number: '',
  form_id: '',
  // 排序在后端做：影响面与分析权重要按**全量**排序，
  // 表格自带的 sortable 只排当页 20 条，排出的第一名不是真正的第一名。
  sort_by: '',
  sort_order: '',
})

// ── 多选与批量操作 ──────────────────────────────────────
const selectedKeys = ref<string[]>([])
const rowSelection = { type: 'checkbox' as const, showCheckedAll: true }

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

// ── 关联已有问题：编号/标题远程搜索 ──────────────────
//
// 这里绝不能"拉前 N 条前端过滤"：perf_issue 是几万条量级，靠后的问题永远搜不到。
// 关键字交给后端（`/perf/issue/list` 的 keyword 对 title / issue_no / form_name
// 做 contains），前端只负责展示与回填 id。
interface LinkIssueOption {
  id: string
  issue_no: string
  title: string
}

const linkIssueLoading = ref(false)
const linkIssueOptions = ref<LinkIssueOption[]>([])
// 已选项单独留存：远程搜索会整体替换 options，不留的话选中项的回显文本会变成 id
const linkIssuePicked = ref<LinkIssueOption | null>(null)

const linkIssueSelectOptions = computed<LinkIssueOption[]>(() => {
  const picked = linkIssuePicked.value
  if (picked && !linkIssueOptions.value.some(i => i.id === picked.id))
    return [picked, ...linkIssueOptions.value]
  return linkIssueOptions.value
})

/** 编号在前、标题在后：编号是点名用的，标题用来确认是不是同一个问题。 */
function issueOptionLabel(i: LinkIssueOption) {
  return i.issue_no ? `${i.issue_no} · ${i.title}` : i.title
}

async function loadLinkIssueOptions(keyword = '') {
  linkIssueLoading.value = true
  try {
    const { data, execute } = useGet<any>(
      ApiPerfIssue.getList,
      { page_num: 1, page_size: 20, keyword },
      { immediate: false },
    )
    await execute()
    const list = data.value?.list ?? []
    linkIssueOptions.value = Array.isArray(list)
      ? list.map((i: any) => ({ id: String(i.id ?? ''), issue_no: i.issue_no ?? '', title: i.title ?? '' }))
      : []
  }
  finally {
    linkIssueLoading.value = false
  }
}

const onLinkIssueSearch = useDebounceFn((keyword: string) => {
  void loadLinkIssueOptions(keyword)
}, 300)

function onLinkIssueChange(value: unknown) {
  const id = value == null ? '' : String(value)
  linkIssuePicked.value = linkIssueOptions.value.find(i => i.id === id) ?? linkIssuePicked.value
  if (!id)
    linkIssuePicked.value = null
}

const getDefectReport = (record: any) => record?.evidence?.defect_report || null
// 新链路的 evidence 是 md 报告路径数组，如 ["01_task_approve__click/defect_1.md"]。
// 旧链路把整个 DefectReport 结构内联在 evidence.defect_report 里。
// 两种都算「有完整报告」—— 只认旧结构会让所有新台账的「转缺陷」都点不了，
// 而且提示「旧台账没有完整缺陷报告」正好把话说反：报告是完整的，只是格式变了。
const getReportFiles = (record: any): string[] => {
  const ev = record?.evidence
  if (!Array.isArray(ev)) return []
  return ev.filter((x: any) => typeof x === 'string' && x.endsWith('.md'))
}
const hasDefectReport = (record: any) => !!getDefectReport(record) || getReportFiles(record).length > 0
const defectStatusText = (status: string) => ({ complete: '完整', evidence_insufficient: '证据不足', pending_retry: '待重试' }[status] || status || '--')
// 处置状态。人工能选的只有三个（见操作列的处置项）：
//   待处置 = 系统产出的初始态，没人下过判断
//   已提单 = 走「转缺陷」建了问题单，后续看问题跟踪
//   不处理 = 看过了判断不修（必填原因）
//   观察   = 看过了，等下一轮再看
const statusMap: Record<string, string> = {
  new: '待处置',
  issued: '已提单',
  wont_fix: '不处理',
  observing: '观察',
  // ── 以下为遗留取值，生产一条都没有，保留只为历史数据能正常显示 ──
  scheduled: '已排期',
  fixing: '修复中',
  fixed: '已修复',
  verified: '已验证',
  recurrent: '复发',
  closed: '已关闭',
  exempted: '已豁免',
}
const statusText = (s: string | undefined) => (s ? statusMap[s] || s : '--')
const statusColorMap: Record<string, string> = {
  // 待处置用 orange 不是 gray：它是"欠一个判断"，不是终态
  new: 'orange',
  issued: 'blue',
  wont_fix: 'gray',
  observing: 'purple',
  scheduled: 'purple',
  fixing: 'purple',
  fixed: 'cyan',
  verified: 'green',
  recurrent: 'red',
  closed: 'gray',
  exempted: 'gray',
}
const statusColor = (s: string | undefined) => statusColorMap[s || ''] || 'gray'
function dimensionTypeText(t: string | undefined) {
  const labels: Record<string, string> = {
    product_domain: '产品领域',
    business_area: '业务领域',
    project_group: '项目组',
    application: '应用',
  }
  return labels[t || ''] || t || '--'
}

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

// ── 勾选行快照 ──────────────────────────────────────
//
// Arco 的 selectedKeys **跨页累积**（翻页、换筛选都不清空），而 tableData 只有当前页，
// 直接"按当前页过滤"会静默丢掉翻页前勾的行：按钮显示 3 条、实际一条都提交不了。
// 这里按 id 累积行数据，计数与提交都从它出发；fetchData 之后行数据会跟着刷新。
const selectedRowsById = ref(new Map<string, any>())
watch([selectedKeys, tableData], () => {
  const keys = new Set(selectedKeys.value.map(String))
  const next = new Map(selectedRowsById.value)
  for (const row of tableData.value as any[]) {
    if (keys.has(String(row.id)))
      next.set(String(row.id), row)
  }
  for (const id of [...next.keys()]) {
    if (!keys.has(id))
      next.delete(id)
  }
  selectedRowsById.value = next
}, { immediate: true })

/** 已勾选的行（按勾选顺序）。缓存里没有的行不参与计数与提交。 */
const selectedRows = computed<any[]>(() => selectedKeys.value.map(id => selectedRowsById.value.get(String(id))).filter(Boolean))
/** 这个动作实际能作用到的行 —— 工具栏计数与提交集合都用它，两者必须同源。 */
const actionableRows = (action: LedgerAction) => filterActionable(selectedRows.value, action)
const toolbarCount = (action: LedgerAction) => actionableRows(action).length
const batchHint = (action: LedgerAction) => batchActionHint(action, selectedRows.value)
const countSuffix = (n: number) => (n > 0 ? ` (${n})` : '')
/** 结果提示里的跳过说明：不可操作的行不是失败，但必须让用户知道它们没被动过。 */
const skippedNote = (n: number) => (n > 0 ? `，跳过 ${n} 条（已提单或状态不支持）` : '')


// 全量影响面重算是后台任务：接口只负责启动并返回尚未计算的数量。
const impactRecomputing = ref(false)
const impactRecomputePayload = ref<Record<string, never>>({})
const { data: impactRecomputeRes, execute: doRecomputeImpact } = usePost<any>(
  ApiPerfPatternLedger.recomputeImpact,
  impactRecomputePayload,
  { immediate: false },
)
let impactRefreshTimer: ReturnType<typeof setTimeout> | null = null
const stopImpactRefresh = () => {
  if (impactRefreshTimer) {
    clearTimeout(impactRefreshTimer)
    impactRefreshTimer = null
  }
}
const handleRecomputeImpact = async () => {
  impactRecomputing.value = true
  try {
    await doRecomputeImpact()
    if (isRequestFailed(impactRecomputeRes.value)) return
    const pending = Number(impactRecomputeRes.value?.pending || 0)
    Message.success(pending > 0 ? `已开始后台重算，待计算 ${pending} 条` : '没有待计算的台账，已启动全量校准')
    stopImpactRefresh()
    impactRefreshTimer = setTimeout(() => { void fetchData() }, 3000)
  } finally {
    impactRecomputing.value = false
  }
}
onUnmounted(stopImpactRefresh)
/** 表头点击排序 → 转成后端参数重新查询。
 *
 * 必须走后端：表格自带的 sortable 只排当前页 20 条，
 * 影响面「第一名」按那样排出来的不是全量第一名。 */
const handleSorterChange = (dataIndex: string, direction: string) => {
  if (!direction) {
    searchForm.sort_by = ''
    searchForm.sort_order = ''
  } else {
    searchForm.sort_by = dataIndex
    searchForm.sort_order = direction === 'ascend' ? 'asc' : 'desc'
  }
  pageNum.value = 1
  fetchData()
}
const statsData = computed(() => rawData.value?.stats || null)

const { downloadWithTip } = useDownload()

// ── 筛选选项 ──────────────────────────────────────
//
// 归因标签从数据字典 perf_attr_tag 取（23 条，每条带判定说明）。
// 不用 SELECT DISTINCT：库里有 11 条产生于标签校验上线前的不规范值
// （`外部依赖-外部接口超时` 这类把一级分类拼进标签的写法），
// 放进下拉会让人以为那是正式标签。筛选框允许手动输入，要查历史值仍然查得到。
const dicts = useDicts('perf_attr_tag')
const tagOptions = computed(() => {
  const raw: unknown = dicts.value.perf_attr_tag
  if (!Array.isArray(raw)) return []
  return raw.map((d: any) => ({ value: d.value ?? d.dict_value, label: d.label ?? d.dict_label }))
})

// 项目组、应用、业务领域都从**基础数据表**取，不从当前列表数据归集。
//
// 原来按当前页 20 条归集，结果下拉里只有 2 个项目组 —— 库里有 314 个。
// 归集的做法对「筛选已有数据」勉强够用，对「修改归属」是错的：
// 要把问题改到一个当前页没出现过的项目组就选不到。
const { data: allGroupsRes } = useGet<any>(ApiSecProjectGroup.getAll, {}, { immediate: true })
const groupOptions = computed(() => {
  const list = allGroupsRes.value
  if (!Array.isArray(list)) return []
  return list
    .filter((g: any) => g.status === '1' || g.status === 1 || g.status === undefined)
    .map((g: any) => ({ value: g.code, label: g.name ? `${g.name}（${g.code}）` : g.code, area: g.business_area }))
})

// 业务领域由项目组带出，不让人单独填 ——
// 项目组与业务领域是一对多的固定关系（库里 314 个组对应 4 个领域），
// 两边分别填会出现「PM013 + 预算」这种项目组表里不存在的组合。
const areaOptions = computed(() => {
  const s = new Set<string>()
  for (const g of groupOptions.value) if (g.area) s.add(g.area)
  return [...s]
})

// 应用取自基础配置的应用表（菜单「应用管理」那张），不是台账里出现过的值
// 应用目录接口按产品线查询；页面首次刷新时范围树尚未 emit，必须显式带默认值，
// 否则请求会在 Axum Query 反序列化阶段因缺少 product_line 直接失败。
const appQuery = ref({ product_line: '星瀚' })
const { data: allAppsRes, execute: fetchApps } = useGet<any>(ApiPerfApp.getList, appQuery, { immediate: true })
const appOptions = computed(() => {
  const list = allAppsRes.value?.list || allAppsRes.value || []
  if (!Array.isArray(list)) return []
  return list.map((a: any) => ({
    value: a.app_number,
    label: a.app_name ? `${a.app_number} ${a.app_name}` : a.app_number,
  }))
})

// ── 批量修改归属 ──────────────────────────────────────
const editVisible = ref(false)
const editForm = reactive({ project_group_code: '', app_number: '', business_area: '' })
/** 本次会跳过几条（勾选集合里已提单的行）—— 提交后一并报给用户 */
const editSkipped = ref(0)

/** 选了项目组就自动带出业务领域 —— 两者是项目组表里的固定关系，
 *  分别填会造出「PM013 + 预算」这种表里不存在的组合。 */
const onEditGroupChange = (code: unknown) => {
  const g = groupOptions.value.find(x => x.value === code)
  if (g?.area) editForm.business_area = g.area
}

const openEditAttribution = () => {
  const rows = actionableRows('edit')
  // 单选时用当前值预填，批量时留空（避免把不同的值统一覆盖成第一条的值）
  if (rows.length === 1) {
    editForm.project_group_code = rows[0].project_group_code || ''
    editForm.app_number = rows[0].app_number || ''
    editForm.business_area = rows[0].business_area || ''
  } else {
    editForm.project_group_code = ''
    editForm.app_number = ''
    editForm.business_area = ''
  }
  editSkipped.value = selectedRows.value.length - rows.length
  editVisible.value = true
}

const editPayload = computed(() => {
  // 只把填了的字段发出去：后端按 null=不动 / 空串=清空 区分，
  // 批量改项目组时不该把应用和业务领域一起清掉。
  // ids 只取可操作的行：已提单的不在台账侧改归属（规则表见 ledgerActions.ts）。
  const body: Record<string, unknown> = { ids: actionableRows('edit').map((r: any) => r.id) }
  if (editForm.project_group_code.trim()) body.project_group_code = editForm.project_group_code.trim()
  if (editForm.app_number.trim()) body.app_number = editForm.app_number.trim()
  if (editForm.business_area.trim()) body.business_area = editForm.business_area.trim()
  return body
})
const { data: editRes, execute: doEdit } = usePost<any>(
  ApiPerfPatternLedger.editAttribution,
  editPayload,
  { immediate: false },
)

const handleEditSubmit = async () => {
  if (!editForm.project_group_code.trim() && !editForm.app_number.trim() && !editForm.business_area.trim()) {
    Message.warning('请至少填写一个要修改的字段')
    return
  }
  await doEdit()
  // usePost 不支持 onSuccess（只有 useGet 经 withOnSuccess 包过），
  // 所以在这里手动判结果 —— 写在 onSuccess 上会静默失效。
  if (isRequestFailed(editRes.value)) return
  Message.success(`${editRes.value?.message || '修改成功'}${skippedNote(editSkipped.value)}`)
  editVisible.value = false
  selectedKeys.value = []
  await fetchData()
}

// ── 人工处置 ──────────────────────────────────────
//
// 为什么必须有这个动作：台账页原来对人只开放「生成问题」一个出口，看完之后判断
// "不该提单"或"再观察一轮"都没有落点。生产实测 61 条台账里 60 条停在待处置，
// 而 last_modified_by 全为空 —— "没人看过"和"看过并决定不处理"在数据上完全一样，
// 影响面早就排出 19 个 P0，其中 18 个未提单，却无从判断是哪一种。
//
// 与「废弃」的边界：废弃说的是「这条分析不该存在」（不再参与指纹匹配），
// 处置说的是「这个问题不修」（仍进报告与统计）。混用会让下一轮把它当新问题重做。
const triaging = ref(false)
const triagePayload = ref<{ ids: string[], status: string, reason?: string }>({ ids: [], status: 'new' })
const { data: triageRes, execute: doTriage } = usePost<any>(
  ApiPerfPatternLedger.triage,
  triagePayload,
  { immediate: false },
)

const triageVisible = ref(false)
const triageReason = ref('')
const triageIds = ref<string[]>([])
/** 本次会跳过几条（勾选集合里不可操作的行）—— 提交后一并报给用户 */
const triageSkipped = ref(0)

/** 打开「不处理」弹窗 —— 只有它需要填原因，观察与撤回直接提交。 */
function openTriage(record: any) {
  triageIds.value = [record.id]
  triageSkipped.value = 0
  triageReason.value = ''
  triageVisible.value = true
}

/** 批量「不处理」：只把**可操作的行**带进弹窗，其余在提交结果里报跳过。 */
function openTriageBatch() {
  const rows = actionableRows('wontFix')
  if (!rows.length) {
    Message.warning(batchHint('wontFix'))
    return
  }
  triageIds.value = rows.map((r: any) => r.id)
  triageSkipped.value = selectedRows.value.length - rows.length
  triageReason.value = ''
  triageVisible.value = true
}

async function submitTriage(ids: string[], status: string, reason?: string, skipped = 0) {
  if (!ids.length)
    return
  triagePayload.value = { ids, status, reason }
  triaging.value = true
  try {
    await doTriage()
    // usePost 不支持 onSuccess，必须在这里判结果
    if (isRequestFailed(triageRes.value))
      return
    Message.success(`${triageRes.value?.message || '处置已记录'}${skippedNote(skipped)}`)
    triageVisible.value = false
    selectedKeys.value = []
    await fetchData()
  }
  finally {
    triaging.value = false
  }
}

async function submitWontFix() {
  const reason = triageReason.value.trim()
  if (!reason) {
    Message.warning('请写明不处理的原因 —— 否则下一轮判出同一问题时没人知道当初为什么放过它')
    return
  }
  await submitTriage(triageIds.value, 'wont_fix', reason, triageSkipped.value)
}

/** 批量观察：不需要原因，直接提交（与行内「标记观察」同一个动作）。 */
function handleObserveSelected() {
  const rows = actionableRows('observe')
  if (!rows.length) {
    Message.warning(batchHint('observe'))
    return
  }
  void submitTriage(rows.map((r: any) => r.id), 'observing', undefined, selectedRows.value.length - rows.length)
}

/** 批量撤回待处置：回到待处置队列，处置人与原因一并清掉（见后端 triage）。 */
function handleRestoreSelected() {
  const rows = actionableRows('restore')
  if (!rows.length) {
    Message.warning(batchHint('restore'))
    return
  }
  void submitTriage(rows.map((r: any) => r.id), 'new', undefined, selectedRows.value.length - rows.length)
}

// ── 批量废弃 ──────────────────────────────────────
const discarding = ref(false)
const discardPayload = ref<{ ids: string[] }>({ ids: [] })
const { data: discardRes, execute: doDiscard } = usePost<any>(
  ApiPerfPatternLedger.discard,
  discardPayload,
  { immediate: false },
)

const handleDiscardSelected = () => {
  const rows = actionableRows('discard')
  if (!rows.length) {
    Message.warning(batchHint('discard'))
    return
  }
  const ids = rows.map((r: any) => r.id)
  const skipped = selectedRows.value.length - rows.length
  Modal.warning({
    title: `确认废弃 ${ids.length} 条问题台账？`,
    content: [
      '废弃后这些台账将从列表、统计、报告和影响面计算中排除，后续归因也不会再匹配它们；同一根因再次出现时会重新创建台账。',
      '已生成的问题单不会随台账删除。',
      '页面不提供恢复入口，请确认选中的确是低质量历史台账。',
      skippedNote(skipped).replace('，', ''),
    ].filter(Boolean).join('\n'),
    okText: '确认废弃',
    cancelText: '取消',
    okButtonProps: { status: 'danger' },
    onOk: async () => {
      discarding.value = true
      try {
        discardPayload.value = { ids }
        await doDiscard()
        if (isRequestFailed(discardRes.value)) return false
        Message.success(`${discardRes.value?.message || `已废弃 ${discardRes.value?.discarded ?? ids.length} 条台账`}${skippedNote(skipped)}`)
        selectedKeys.value = []
        await fetchData()
        return true
      } finally {
        discarding.value = false
      }
    },
  })
}

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

// 「转缺陷」菜单项的禁用原因，直接写在 tooltip 里避免用户猜。
const createIssueTip = (record: any): string => {
  if (ledgerStateOf(record) === 'issued')
    return '已转缺陷，可从「更多 → 查看问题」跟进'
  if (isReportPendingRetry(record))
    return '缺陷报告仍待重试，暂不能转缺陷'
  if (!hasDefectReport(record))
    return '该台账没有关联缺陷报告，不能转缺陷'
  return '从完整缺陷报告创建真实问题跟踪'
}

// 操作列只保留 详情/更多，动作全部收进下拉。
const handleMoreAction = (key: string, record: any) => {
  switch (key) {
    case 'viewIssue':
      if (record.issue_id) gotoIssue(record.issue_id)
      break
    case 'createIssue':
      handleCreateIssue(record)
      break
    case 'linkIssue':
      openLinkIssue(record)
      break
    case 'logs':
      void handleLogsDownload(record)
      break
    case 'wontFix':
      openTriage(record)
      break
    case 'observing':
      void submitTriage([record.id], 'observing')
      break
    case 'restore':
      void submitTriage([record.id], 'new')
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
  // 左侧范围树可切换星瀚/星空；应用下拉必须跟着产品线重取，不能一直显示首次加载的数据。
  if (scope.product_line && appQuery.value.product_line !== scope.product_line) {
    appQuery.value = { product_line: scope.product_line }
    void fetchApps()
  }
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
const handleSearch = () => {
  pageNum.value = 1
  // 刷新查询条件后，旧勾选可能已不在结果集里，直接清空 ——
  // 否则批量操作会把看不见的旧行也带上（工具栏计数与实际提交集合同源）。
  selectedKeys.value = []
  selectedRowsById.value = new Map()
  fetchData()
}
const handleReset = () => {
  Object.assign(searchForm, {
    // status 回到 'new' 而不是空：与初始状态一致，否则"重置"会变成"看全部"
    keyword: '', product_line: '', dimension_type: '', dimension_value: '', attribution_tag: '', status: 'new',
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
  // 追加分析由 PatternReanalysis 组件按 pattern-id / active 自己加载，这里不再触发
}

// 追加分析（再次分析）的状态与请求都在 PatternReanalysis 组件里，
// 见 views/perf/composables/usePatternReanalysis.ts —— 问题列表详情共用同一份逻辑。

const gotoIssue = (issueId: string) => {
  // '/perf/issue' 在生产菜单里不存在（问题追踪目录是 /cloud-perf/issue，且它是
  // 目录节点不能直接访问），真正的页面是 issue-list。按路由名跳转，不受菜单层级变动影响。
  router.push({ name: 'issue-list', query: { keyword: issueId } })
}

const createIssuePayload = ref<any>({})
const { data: createIssueResult, execute: doCreateIssue } = usePost<any>(ApiPerfPatternLedger.createIssue, createIssuePayload, { immediate: false })
const savePatternPayload = ref<any>({})
const { data: saveRes, execute: doSavePattern } = usePost<any>(ApiPerfPatternLedger.save, savePatternPayload, { immediate: false })

/** 单次批量上限，与后端 MAX_BATCH 对齐（后端会拒，前端先把话说在前面） */
const CREATE_ISSUE_BATCH_MAX = 50
const converting = ref(false)

/** 报告"待重试"后端必拒 —— 前端也按不可转算，否则确认框里的条数是假的。 */
function isReportPendingRetry(record: any): boolean {
  return getDefectReport(record)?.report_status === 'pending_retry'
}

/** 旧链路（内联 DefectReport）里 evidence_sufficient=false 的报告提单要用户二次确认。 */
function isEvidenceInsufficient(record: any): boolean {
  const report = getDefectReport(record)
  return !!report && report.issue_ready === false
}

/** 把可转缺陷的行按"能转 / 无报告 / 待重试"分开 —— 确认框与提交集合共用这一份。 */
function splitConvertible(rows: any[]) {
  const convertible: any[] = []
  const noReport: any[] = []
  const pendingRetry: any[] = []
  for (const row of rows) {
    if (isReportPendingRetry(row))
      pendingRetry.push(row)
    else if (hasDefectReport(row))
      convertible.push(row)
    else
      noReport.push(row)
  }
  return { convertible, noReport, pendingRetry }
}

/** 批量结果提示：成功的报条数，失败的指名道姓（后端逐行返回，别把它压成一个数字）。 */
function reportCreateIssueResult(data: any) {
  const results: any[] = Array.isArray(data?.results) ? data.results : []
  const failed = results.filter(r => !r.ok)
  const created = Number(data?.created || 0)
  const linked = Number(data?.linked || 0)
  const okParts = [
    created > 0 ? `已转缺陷 ${created} 条` : '',
    linked > 0 ? `${linked} 条已有关联问题` : '',
  ].filter(Boolean)
  const okText = okParts.join('，')
  if (failed.length) {
    const detail = failed.map(r => `${r.pattern_no || r.id}（${r.error || '失败'}）`).join('；')
    Message.warning(`${okText ? `${okText}；` : ''}${failed.length} 条失败：${detail}`)
    return
  }
  Message.success(okText || '转缺陷完成')
}

async function performCreateIssue(ids: string[], confirmEvidenceInsufficient: boolean) {
  converting.value = true
  try {
    createIssuePayload.value = { ids, confirm_evidence_insufficient: confirmEvidenceInsufficient }
    await doCreateIssue()
    // usePost 不支持 onSuccess，必须在这里判结果
    if (isRequestFailed(createIssueResult.value))
      return false
    reportCreateIssueResult(createIssueResult.value)
    selectedKeys.value = []
    await fetchData()
    return true
  }
  finally {
    converting.value = false
  }
}

/** 行内「转缺陷…」：单条，走同一个批量接口（ids 只有一条）。 */
function handleCreateIssue(record: any) {
  if (isReportPendingRetry(record)) {
    Message.warning('该台账的缺陷报告仍待重试，暂不能转缺陷')
    return
  }
  if (!hasDefectReport(record)) {
    Message.warning('该台账没有关联缺陷报告，不能转缺陷')
    return
  }
  const insufficient = isEvidenceInsufficient(record)
  Modal.confirm({
    title: insufficient ? '以待补证问题转缺陷？' : '转缺陷？',
    content: insufficient
      ? '当前缺陷报告明确标记为证据不足。继续后将创建真实问题单，并保留缺失证据与待补证说明。'
      : '将从完整缺陷报告创建真实问题跟踪，并回填台账关联（台账状态变为「已提单」）。',
    okText: insufficient ? '确认待补证转缺陷' : '确认转缺陷',
    onOk: () => performCreateIssue([record.id], insufficient),
  })
}

/** 工具栏「转缺陷」：批量入口。确认框先讲清楚会发生什么，再一次性提交。 */
function handleCreateIssueBatch() {
  const rows = actionableRows('convert')
  if (!rows.length) {
    Message.warning(batchHint('convert'))
    return
  }
  const { convertible, noReport, pendingRetry } = splitConvertible(rows)
  const overflow = Math.max(0, convertible.length - CREATE_ISSUE_BATCH_MAX)
  const targets = convertible.slice(0, CREATE_ISSUE_BATCH_MAX)
  if (!targets.length) {
    Message.warning(`所选台账都不能转缺陷（无缺陷报告 ${noReport.length} 条、报告待重试 ${pendingRetry.length} 条）`)
    return
  }
  const insufficient = targets.filter(isEvidenceInsufficient).length
  const skipped = selectedRows.value.length - rows.length
  const content = [
    `将转缺陷 ${targets.length} 条（创建真实问题单并回填台账关联）`,
    insufficient > 0 ? `其中 ${insufficient} 条缺陷证据不足，将按「待补证」方式提单` : '',
    noReport.length > 0 ? `跳过 ${noReport.length} 条：没有关联缺陷报告` : '',
    pendingRetry.length > 0 ? `跳过 ${pendingRetry.length} 条：缺陷报告仍待重试` : '',
    skipped > 0 ? `跳过 ${skipped} 条：已提单或状态不支持` : '',
    overflow > 0 ? `另有 ${overflow} 条超出单次上限（${CREATE_ISSUE_BATCH_MAX} 条），本次不提交，请分批操作` : '',
  ].filter(Boolean).join('\n')
  Modal.confirm({
    title: `确认转缺陷 ${targets.length} 条？`,
    content,
    okText: '确认转缺陷',
    onOk: () => performCreateIssue(targets.map((r: any) => r.id), insufficient > 0),
  })
}

const openLinkIssue = (record: any) => {
  linkPattern.value = record
  linkIssueId.value = ''
  linkIssuePicked.value = null
  linkIssueOptions.value = []
  linkIssueVisible.value = true
  // 先拉一页最新问题：多数情况下要关联的就是刚提的那条，省一次输入
  void loadLinkIssueOptions()
}

const handleLinkIssue = async () => {
  if (!linkIssueId.value.trim()) { Message.warning('请先搜索并选择要关联的问题'); return false }
  savePatternPayload.value = { id: linkPattern.value.id, issue_id: linkIssueId.value.trim(), status: 'issued' }
  await doSavePattern()
  // usePost 不支持 onSuccess，必须在这里判结果 —— 否则选中的问题若已被删除，
  // 后端拒绝而界面照样弹「关联成功」，台账看起来已提单、实际没有
  if (isRequestFailed(saveRes.value))
    return false
  Message.success('关联成功')
  linkIssueVisible.value = false
  await fetchData()
  return true
}
</script>

<style scoped>
/* 业务操作工具行。flex + wrap 是关键：按钮数量还在长（处置动作只会更多），
   放不下时换行而不是横向溢出到画面外。 */
.ledger-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

/* tooltip 要挂在按钮外面：Arco 的禁用按钮不派发鼠标事件，
   不包一层的话"按钮为什么不能点"的提示根本弹不出来。 */
.toolbar-btn {
  display: inline-block;
}

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
