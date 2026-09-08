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
            <!-- 生产侧复现状态：回答「生产上现在还复现不复现」。
                 与「处理」（内部进度）是两条线，会同时存在 ——
                 内部标了已发版而生产上还在复现，那时必须还能继续追踪。 -->
            <a-select v-model="searchForm.status" placeholder="生产状态" allow-clear>
              <a-option value="recurring">仍复现</a-option>
              <a-option value="observing">观察中</a-option>
              <a-option value="resolved">已消失</a-option>
              <a-option value="excluded">不适用</a-option>
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
        左树右表骨架交给 ListPage：确定高度、min-height:0 链、overflow-x、
        左栏内部滚动、工具行固定、表格体高度这些细节都在组件里。
        IssueScopeTree 内部是 `flex:1; min-height:0; overflow:auto`（自己滚），
        需要父级高度确定，ListPage 的左栏正好提供这一点。
      -->
      <ListPage :aside-width="280">
        <template #aside>
          <IssueScopeTree :key="scopeTreeKey" :filters="scopeCountFilters" source="issue" @change="handleScopeChange" />
        </template>

        <!--
          对表格记录的操作按钮放在**表格正上方**、与选中提示同一行。
          这样按钮紧邻它作用的对象；也不再和筛选字段抢同一行的宽度。
          工具行的 flex 布局由 ListPage 的 `.lp-toolbar` 负责 ——
          此前这里自己写 `class="table-toolbar"` 而样式里只有 `.toolbar`，
          类名对不上，工具行根本没有 flex（按钮紧贴、导出/新增没被推到右端）。
        -->
        <template #toolbar>
          <!-- 内部处理流程：勾选行后点。与「状态」列（生产复现状态）是两个维度，不会互相覆盖 -->
          <!-- 「转交」而不是「认领」：责任人会反复变更（转给 A、A 再转给 B），
               认领只说得通第一次。转交时可以一并改项目组。 -->
          <a-button type="primary" :disabled="!selectedIds.length" @click="openClaim">转交</a-button>
          <!-- 选到「不处理」时不能直接提交：必须先要一个字典内的类型和原因，
               否则误报率这类统计算不出来。所以走 onProcessSelect 分流到弹窗。 -->
          <a-dropdown :disabled="!selectedIds.length" @select="onProcessSelect">
            <a-button :disabled="!selectedIds.length" :loading="transitionLoading">
              处理
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
          <!-- 把导出/新增推到右端：它们是全局动作，与左侧的选中行操作分组 -->
          <div class="toolbar-spacer" />
          <a-button status="success" @click="handleExport">导出 Excel</a-button>
          <a-button type="primary" status="success" @click="handleAdd">新增</a-button>
        </template>

        <template #default="{ tableHeight }">
          <!--
            操作列是 fixed="right"，所以必须给 scroll 一个横向尺寸 ——
            Arco 只有在有横向滚动容器时才能正确定位固定列，缺了它操作列会
            溢出到表格右边界之外。
            用 minWidth 而非 x：x 会被当成固定 width，容器更宽时表格停在那个宽度、
            右边留白。16 个列宽合计 1965px。
          -->
            <a-table
              :data="tableData"
              :loading="loading"
              :pagination="pagination"
              :row-selection="{ type: 'checkbox', showCheckedAll: true }"
              :selected-keys="selectedIds"
              :scroll="{ minWidth: 1965, y: tableHeight }"
              row-key="id"
              @selection-change="onSelectionChange"
              @page-change="handlePageChange"
              @page-size-change="handlePageSizeChange"
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
                    <span v-else class="dmp-empty">未转交</span>
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
                <!-- 时间统一走 formatTime 转本地时区。直接绑字段会把后端的
                     UTC 字符串原样显示（差 8 小时），看起来像数据错了。
                     found_date 是纯日期，用 date 精度避免补出个 00:00:00。 -->
                <a-table-column title="发现日期" :width="100">
                  <template #cell="{ record }">{{ formatTime(record.found_date, { precision: 'date' }) }}</template>
                </a-table-column>
                <a-table-column title="创建时间" :width="150" ellipsis tooltip>
                  <template #cell="{ record }">{{ formatTime(record.created_at) }}</template>
                </a-table-column>
                <a-table-column title="更新时间" :width="150" ellipsis tooltip>
                  <template #cell="{ record }">{{ formatTime(record.updated_at) }}</template>
                </a-table-column>
                <a-table-column title="操作" :width="180" fixed="right">
                  <template #cell="{ record }">
                    <a-space>
                      <a-link @click="handleDetail(record)">详情</a-link>
                      <!-- 状态下拉已移除：生产侧状态主要由归因数据驱动
                           （发版后进观察、同指纹又出现自动打回仍复现），
                           逐行手点容易和自动判定打架。要改在详情里改。 -->
                      <!-- 删除按钮已移除：问题不支持删除。归因产生的问题是分析结论的
                           载体，删掉后下轮归因判出同一指纹会当成新问题重做源码调研。
                           不需要处理的用「标记不处理」，理由会留在流转记录里。 -->
                      <a-link @click="openLogs(record)">流转记录</a-link>
                    </a-space>
                  </template>
                </a-table-column>
              </template>
            </a-table>
        </template>
      </ListPage>
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
          <a-descriptions-item label="发现日期">{{ formatTime(currentRecord?.found_date, { precision: 'date' }) }}</a-descriptions-item>
          <a-descriptions-item label="修复日期">{{ formatTime(currentRecord?.fixed_date, { precision: 'date' }) }}</a-descriptions-item>
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

      <!-- 转交：必须有处理人 —— 转交的全部意义就是把责任落到人头上。
           项目组默认取所选问题的当前项目组，改了会一起进流转记录。 -->
      <a-modal v-model:visible="claimVisible" :title="`转交（${selectedIds.length} 条）`" :ok-loading="claimLoading" @ok="submitClaim">
        <a-form :model="{ claimOwner }" layout="vertical">
          <a-form-item label="处理人" required>
            <a-select v-model="claimOwner" placeholder="从系统人员中选择" allow-search allow-create>
              <a-option v-for="u in userOptions" :key="u.value" :value="u.value">{{ u.label }}</a-option>
            </a-select>
          </a-form-item>
          <a-form-item label="项目组">
            <a-select v-model="claimGroup" placeholder="不变更" allow-clear allow-search>
              <a-option v-for="g in groupOptions" :key="g.value" :value="g.value">{{ g.label }}</a-option>
            </a-select>
          </a-form-item>
          <a-form-item label="说明">
            <a-input v-model="claimRemark" placeholder="为什么转交（会记入流转记录）" allow-clear />
          </a-form-item>
        </a-form>
      </a-modal>

      <!-- 标记不处理：类型必须从字典选，自由文本会让「误报占比」算不出来，
           而那个数字是衡量归因质量的直接指标。误报会进待复核。 -->
      <a-modal v-model:visible="wontFixVisible" :title="`标记不处理（${selectedIds.length} 条）`" :ok-loading="claimLoading" @ok="submitWontFix">
        <a-alert type="warning" style="margin-bottom: 12px">
          标为「误报」的问题会进入待复核清单 —— 那是对分析质量的判断，
          需要第二个人确认，否则我们会失去发现归因错误的信号。
        </a-alert>
        <a-form :model="{ wontFixType }" layout="vertical">
          <a-form-item label="不处理类型" required>
            <a-select v-model="wontFixType" placeholder="请选择">
              <a-option v-for="t in wontFixOptions" :key="t.value" :value="t.value">{{ t.label }}</a-option>
            </a-select>
          </a-form-item>
          <a-form-item label="原因" required>
            <a-textarea v-model="wontFixReason" placeholder="为什么不处理" :auto-size="{ minRows: 2 }" />
          </a-form-item>
        </a-form>
      </a-modal>

      <!-- 流转记录：追加写，看得出经手链条。
           原来只有 process_prev_status 存上一步，转交反复发生时看不出谁转给了谁。 -->
      <a-drawer v-model:visible="logsVisible" :width="560" title="流转记录">
        <a-timeline v-if="logsData.length">
          <a-timeline-item v-for="(l, i) in logsData" :key="i" :label="formatTime(l.created_at)">
            <div>
              <a-tag size="small" :color="processColor(l.to_status)">{{ processLabel(l.to_status) || l.to_status }}</a-tag>
              <span v-if="l.from_status" style="color: var(--color-text-3)">
                ← {{ processLabel(l.from_status) || l.from_status }}
              </span>
            </div>
            <div v-if="l.to_owner" style="font-size: 12px; color: var(--color-text-2)">
              责任人：{{ l.from_owner ? `${l.from_owner} → ` : '' }}{{ l.to_owner }}
            </div>
            <div v-if="l.to_project_group" style="font-size: 12px; color: var(--color-text-2)">
              项目组：{{ l.from_project_group ? `${l.from_project_group} → ` : '' }}{{ l.to_project_group }}
            </div>
            <div v-if="l.wontfix_type" style="font-size: 12px; color: var(--color-text-2)">
              不处理类型：{{ l.wontfix_type }}
            </div>
            <div v-if="l.remark" style="font-size: 12px">{{ l.remark }}</div>
            <div style="font-size: 12px; color: var(--color-text-3)">操作人：{{ l.operator_name || '—' }}</div>
          </a-timeline-item>
        </a-timeline>
        <a-empty v-else description="暂无流转记录（这条问题还没有人工流转过）" />
      </a-drawer>

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
import ListPage from '@/components/common/ListPage.vue'
import { ApiSysUser } from '@/api/sysApis'
import { ApiSecProjectGroup } from '@/api/sechubApis'
import { formatTime, useDelete, useDicts, useDownload, useGet, usePost, usePut } from '@/hooks'
import IssueScopeTree from '@/views/perf/components/IssueScopeTree.vue'
import { useUserStore } from '@/stores'

defineOptions({ name: 'issue-list' })

// 高度测量、min-height:0 链、overflow-x 全部由 ListPage 负责，页面不再维护 ref。

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

// 生产侧复现状态。原来七个值（待确认/已确认/处理中/已修复/已验证/已关闭/不修复）
// 全是处理流程且与「处理」那套撞车，反而说不出「仍复现」——
// 而那正是最需要表达的：内部发版了但生产上问题还在。
const statusMap: Record<string, string> = { recurring: '仍复现', observing: '观察中', resolved: '已消失', excluded: '不适用' }
const severityMap: Record<string, string> = { critical: '严重', major: '重要', minor: '一般' }
const issueTypeMap: Record<string, string> = { slow_sql: '慢SQL', index_loop: '索引循环', rpc_slow: 'RPC慢调用', accumulated: '累积耗时', other: '其他' }

const statusText = (s: string) => statusMap[s] || s
const severityText = (s: string) => severityMap[s] || s
const issueTypeText = (s: string) => issueTypeMap[s] || s
const statusColor = (s: string) => ({ recurring: 'red', observing: 'orange', resolved: 'green', excluded: 'gray' }[s] || 'gray')
const severityColor = (s: string) => ({ critical: 'red', major: 'orange', minor: 'blue' }[s] || 'gray')
// 来源。`periodic_defect` 是最主要的一种（周期归因判出问题后从台账建单，
// 见 issue_pattern.rs:760），原来映射表里没有它，界面直接显示了
// 「periodic_defect」这个内部值。
const sourceText = (s: string) => ({
  manual: '手动创建',
  periodic_defect: '归因建单',
  auto_recommend: '自动推荐',
  diagnosis: 'Agent 诊断',
  trace_ai: 'AI 分析',
}[s] || s || '手动创建')
const sourceColor = (s: string) => ({
  manual: 'gray',
  periodic_defect: 'arcoblue',
  auto_recommend: 'cyan',
  diagnosis: 'blue',
  trace_ai: 'purple',
}[s] || 'gray')

const getNextStatuses = (current: string) => {
  // 与后端 is_valid_transition 保持一致（service/src/perf/plan/issue.rs）
  const transitions: Record<string, string[]> = {
    recurring: ['observing', 'excluded'],
    observing: ['recurring', 'resolved', 'excluded'],
    resolved: ['recurring'],
    excluded: ['recurring'],
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
  // verified 是闭环：原来只跟到「已发版」就把问题移出看板，但没有任何机制
  // 核对发版后是否真的不复现 —— 下轮归因判出同一指纹会当成新问题重做调研。
  { value: 'verified', label: '已验证', color: 'green' },
  // wont_fix 是状态而不是独立开关：正交设计会产生「已修复且不处理」这种矛盾组合
  { value: 'wont_fix', label: '不处理', color: 'gray' },
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

const claimGroup = ref('')
const claimRemark = ref('')

// 不处理：类型走数据字典 perf_issue_wontfix_type（低频问题/客户版本低/误报）
const wontFixVisible = ref(false)
const wontFixType = ref('')
const wontFixReason = ref('')
const wontFixDicts = useDicts('perf_issue_wontfix_type')
const wontFixOptions = computed(() => {
  const raw: unknown = wontFixDicts.value.perf_issue_wontfix_type
  return Array.isArray(raw) ? raw.map((d: any) => ({ value: d.value, label: d.label })) : []
})

// 人员下拉：从系统用户表联查，不让人手输名字 ——
// 手输会出现「张三」「张三 」「zhangsan」三种写法指向同一个人
const userQuery = ref({ page_num: 1, page_size: 200 })
const { data: userRes } = useGet<any>(ApiSysUser.getList, userQuery, { immediate: true })
const userOptions = computed(() => {
  const list = userRes.value?.list || userRes.value?.data || []
  return (Array.isArray(list) ? list : []).map((u: any) => ({
    value: u.user_nickname || u.user_name,
    label: u.user_nickname ? `${u.user_nickname}（${u.user_name}）` : u.user_name,
  }))
})

// 项目组下拉取自基础配置的项目组表（314 个），不从当前页数据归集 ——
// 归集只能拿到当页出现过的两三个组，要转交给别的组就选不到
const { data: allGroupsRes } = useGet<any>(ApiSecProjectGroup.getAll, {}, { immediate: true })
const groupOptions = computed(() => {
  const list = allGroupsRes.value
  if (!Array.isArray(list)) return []
  return list.map((g: any) => ({
    value: g.code,
    label: g.name ? `${g.name}（${g.code}）` : g.code,
  }))
})

// 流转记录
const logsVisible = ref(false)
const logsIssueId = ref('')
const logsQuery = computed(() => ({ issue_id: logsIssueId.value }))
const { data: logsRes, execute: fetchLogs } = useGet<any>(ApiPerfIssue.processLogs, logsQuery, { immediate: false })
const logsData = computed(() => (Array.isArray(logsRes.value) ? logsRes.value : []))

async function openLogs(record: any) {
  logsIssueId.value = record.id
  logsVisible.value = true
  await fetchLogs()
}

// ── SLA 展示 ──────────────────────────────────────
// 到期日在建单时定死，不随配置变动 —— 否则调宽时限能让超期记录集体消失
function slaDaysLeft(record: any): number | null {
  if (!record?.sla_due_date) return null
  const due = new Date(record.sla_due_date).getTime()
  return Math.ceil((due - Date.now()) / 86400000)
}
function slaText(record: any) {
  const d = slaDaysLeft(record)
  if (d === null) return ''
  return d < 0 ? `超期 ${-d} 天` : `剩 ${d} 天`
}
function slaColor(record: any) {
  const d = slaDaysLeft(record)
  if (d === null) return 'gray'
  return d < 0 ? 'red' : d <= 2 ? 'orange' : 'blue'
}
function slaHint(record: any) {
  return `${record.sla_level || '未评级'} 档，期限 ${record.sla_due_date}`
}

function openClaim() {
  if (!selectedIds.value.length)
    return
  // 默认填当前登录人 —— 绝大多数情况是「我接手」
  claimOwner.value = userStore.user?.nickname || userStore.user?.name || ''
  // 项目组默认取所选问题的当前项目组：转交多数情况不改组，
  // 默认空会让人以为不填就是清空
  const first = (tableData.value as any[]).find(r => r.id === selectedIds.value[0])
  claimGroup.value = first?.project_group_code || ''
  claimRemark.value = ''
  claimVisible.value = true
}

/** 处理下拉的分流：不处理要走弹窗，其余直接提交。
 *
 *  不处理必须带字典内的类型和原因 —— 直接提交会被后端拒绝
 *  （wont_fix 缺类型时 bail），而且「误报占比」这个衡量归因质量的
 *  指标要靠类型才算得出来。 */
function onProcessSelect(v: string | number | Record<string, any> | undefined) {
  const target = String(v)
  if (target === 'wont_fix') {
    openWontFix()
    return
  }
  transition(target)
}

function openWontFix() {
  if (!selectedIds.value.length)
    return
  wontFixType.value = ''
  wontFixReason.value = ''
  wontFixVisible.value = true
}

async function submitWontFix() {
  if (!wontFixType.value) {
    Message.warning('请选择不处理类型')
    return
  }
  if (!wontFixReason.value.trim()) {
    Message.warning('请填写不处理原因')
    return
  }
  claimLoading.value = true
  try {
    await transition('wont_fix', undefined, {
      wontfix_type: wontFixType.value,
      remark: wontFixReason.value.trim(),
    })
    wontFixVisible.value = false
  }
  finally {
    claimLoading.value = false
  }
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
async function transition(target: string, owner?: string, extra?: Record<string, unknown>) {
  if (!selectedIds.value.length)
    return
  transitionLoading.value = true
  try {
    const { data, execute } = usePost<{ updated: number, message: string }>(
      ApiPerfIssue.processTransition,
      {
        ids: selectedIds.value,
        process_status: target,
        process_owner: owner,
        // 项目组只在转交时带：后端按 null=不动处理，
        // 传空串会把原项目组清掉
        project_group_code: target === 'claimed' && claimGroup.value ? claimGroup.value : undefined,
        remark: target === 'claimed' && claimRemark.value.trim() ? claimRemark.value.trim() : undefined,
        ...(extra || {}),
      },
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
const pagination = computed(() => ({ current: pageNum.value, pageSize: pageSize.value, total: rawData.value?.total || 0, showTotal: true, showPageSize: true }))

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
// 改每页条数必须同时回到第 1 页：原本停在第 5 页、条数改大后该页往往已超出总页数，
// 后端返回空列表，看起来像"数据没了"。
const handlePageSizeChange = (size: number) => { pageSize.value = size; pageNum.value = 1; fetchData() }
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
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

/*
  字段宽度必须落在**包裹 div** 上，不能直接写给 Arco 组件。

  Arco 的 Input / Select 都是 `inheritAttrs: false`（`es/input/input.js`、
  `es/select/select.js`），传给组件的 class 不会落到根节点 ——
  早先直接给 `<a-select class="f-mid">` 写宽度，那些类从未生效，
  控件保持 Arco 自带的 `width: 100%`，在 flex 容器里就变成每个占满一行。
*/
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

/* 控件填满它的包裹 div。用 :deep —— 这些是子组件根节点，
   `inheritAttrs: false` 时不该依赖 scope id 一定落在上面。 */
.filter-bar > div :deep(.arco-select),
.filter-bar > div :deep(.arco-input-wrapper),
.filter-bar > div :deep(.arco-input-group) {
  width: 100%;
}
.f-dmp :deep(.arco-input-wrapper) {
  flex: 1;
}

/* 把导出/新增推到工具行右端（工具行本身的 flex 由 ListPage 提供） */
.toolbar-spacer {
  flex: 1;
}

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
