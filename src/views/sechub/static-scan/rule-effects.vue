<script setup lang="ts">
/**
 * 规则效果页（只读）：规则版本 × 扫描点 × 仓库 × 模型维度的效果指标。
 *
 * 两组口径（与后端 list_rule_effects 一致，别自行换算）：
 *   · AI 侧来自 run 级物化快照：检出/确认/排除/复核/错误/待确认，
 *     AI 采信率 = 确认 ÷（确认 + 排除 + 复核），分母为 0（尚无已判定候选）时后端给 null；
 *   · 开发侧是对缺陷表的实时聚合（issue 跨 run，故不按 run/模型拆）：
 *     误报/修复/复测通过/不处理/豁免，开发认可率 = 1 − 误报 ÷ 已处置确认数，分母为 0 时 null；
 *   · 比率后端给 0~1 小数，本页按百分比 1 位小数展示，null 显示「—」（不是 0%）。
 *
 * 默认按 AI 采信率升序（最差在前）。排序键只看三个：AI 采信率 / 开发误报率 / 检出数，
 * 方向随键的语义固定 —— 契约里的 sort 只表达键，没有方向参数，所以不做表头升降序切换。
 */
import { onMounted } from 'vue'
import ListPage from '@/components/common/ListPage.vue'
import {
  RULE_EFFECT_COLUMNS,
  RULE_EFFECT_DOMAIN_OPTIONS,
  RULE_EFFECT_RUN_SCOPE_OPTIONS,
  RULE_EFFECT_SORT_OPTIONS,
  RULE_EFFECT_TABLE_MIN_WIDTH,
} from './rule-effects/types'
import { useRuleEffects } from './rule-effects/useRuleEffects'

// 组件名必须与路由 name（= sys_menu.path 'rule-effects'）逐字一致，keep-alive :include 才能缓存本页
// （见 components/layout/app-main.vue 注释）。lint 的 PascalCase 提示只是警告，改名却会让页签缓存失效。
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'rule-effects' })

const {
  rows,
  loading,
  failed,
  query,
  pagination,
  onPageChange,
  onPageSizeChange,
  search,
  reset,
  load,
  repositoryOptions,
  loadRepositoryOptions,
  repositoryLabel,
} = useRuleEffects()

// 本页不轮询：AI 侧是快照、开发侧实时聚合，需要新数据时点「刷新」（见工具栏）
onMounted(() => {
  void loadRepositoryOptions()
  void load()
})
</script>

<template>
  <div>
    <ListPage>
      <!-- 筛选区：每项都放在包裹 div 里给宽度（Arco 的 Input / Select 是 inheritAttrs: false，class 落不到根节点） -->
      <template #filter>
        <div class="filter-bar">
          <div class="f-repo">
            <a-select v-model="query.repository_id" placeholder="仓库" allow-clear allow-search @change="search">
              <a-option v-for="opt in repositoryOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </a-option>
            </a-select>
          </div>
          <div class="f-sm">
            <a-select v-model="query.domain" placeholder="域" allow-clear @change="search">
              <a-option v-for="opt in RULE_EFFECT_DOMAIN_OPTIONS" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </a-option>
            </a-select>
          </div>
          <div class="f-mid">
            <a-input
              v-model="query.ai_model"
              placeholder="模型（精确匹配）"
              allow-clear
              @press-enter="search"
              @clear="search"
            />
          </div>
          <div class="f-scope">
            <a-select v-model="query.run_scope" @change="search">
              <a-option v-for="opt in RULE_EFFECT_RUN_SCOPE_OPTIONS" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </a-option>
            </a-select>
          </div>
          <div class="f-sort">
            <a-select v-model="query.sort" @change="search">
              <a-option v-for="opt in RULE_EFFECT_SORT_OPTIONS" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </a-option>
            </a-select>
          </div>
          <div class="f-wide">
            <a-input
              v-model="query.keyword"
              placeholder="关键字（规则编号 / 名称）"
              allow-clear
              @press-enter="search"
              @clear="search"
            />
          </div>
          <a-button type="primary" @click="search">
            查询
          </a-button>
          <a-button @click="reset">
            重置
          </a-button>
        </div>
      </template>

      <template #toolbar>
        <a-button :loading="loading" @click="load()">
          <template #icon>
            <icon-refresh />
          </template>
          刷新
        </a-button>
        <span class="rate-hint">
          AI 采信率 = 确认 ÷（确认+排除+复核）· 开发认可率 = 1 − 误报 ÷ 已处置确认 · 「—」= 分母为 0，比率不可计算
        </span>
      </template>

      <template #default="{ tableHeight }">
        <a-table
          :data="rows"
          :columns="RULE_EFFECT_COLUMNS"
          :loading="loading"
          :pagination="pagination"
          :scroll="{ minWidth: RULE_EFFECT_TABLE_MIN_WIDTH, y: tableHeight }"
          row-key="row_key"
          size="small"
          @page-change="onPageChange"
          @page-size-change="onPageSizeChange"
        >
          <!-- 规则列两行：编号（等宽）+ 名称 -->
          <template #rule="{ record }">
            <div class="rule-key">
              {{ record.rule_key }}
            </div>
            <div class="rule-name">
              {{ record.rule_name || '—' }}
            </div>
          </template>

          <!-- 仓库列：下拉里能解析出「模块（仓库名）」，解析不到退回 id -->
          <template #repository="{ record }">
            {{ repositoryLabel(record.repository_id) }}
          </template>

          <template #empty>
            <a-result
              v-if="failed"
              status="error"
              title="规则效果加载失败"
              subtitle="后端未返回数据，请重试或检查网络与权限"
            >
              <template #extra>
                <a-button size="small" type="primary" @click="load()">
                  重试
                </a-button>
              </template>
            </a-result>
            <a-empty
              v-else
              description="暂无规则效果数据：需要先有已完成 AI 确认的扫描轮次（快照在收口/确认后写入）"
            />
          </template>
        </a-table>
      </template>
    </ListPage>
  </div>
</template>

<style scoped>
/* 筛选区：按需宽度 + 放不下自动换行 */
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

/* 宽度必须落在包裹 div 上：Arco 的 Input / Select 是 inheritAttrs: false，直接给组件写 class 不生效 */
.f-wide {
  width: 220px;
}
.f-mid {
  width: 150px;
}
.f-sm {
  width: 90px;
}
.f-repo {
  width: 240px;
}
.f-scope {
  width: 220px;
}
.f-sort {
  width: 220px;
}

.filter-bar > div :deep(.arco-select),
.filter-bar > div :deep(.arco-input-wrapper) {
  width: 100%;
}

.rate-hint {
  color: var(--color-text-3);
  font-size: 12px;
}

/* 规则编号等宽，名称压暗一行 —— 一行里先看编号后看名称。
   两行各自省略：列的 ellipsis 只作用于单元格这一层，内容是两个块级 div 时
   文字会被直接裁断而不出「…」（列的 tooltip 仍能看全，见 AutoTooltip）。 */
.rule-key {
  overflow: hidden;
  font-family: monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rule-name {
  overflow: hidden;
  color: var(--color-text-3);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
