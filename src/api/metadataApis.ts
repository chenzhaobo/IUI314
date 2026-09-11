/**
 * @description: 平台元数据 API（与业务域无关）
 */

// ── API 清单（基础配置 → 元数据管理）────────────────
// 数据来自所选测试环境的 OpenAPI 定义库：tree 给维度树，list 给接口表，sync 同步到平台库
// tree 支持 `depth=api&source=cases|results`：在应用节点下多一层 API 叶子
// （source 决定 API 叶子的计数口径：用例数 / 结果数）
export enum ApiMetadataInventory {
  tree = '/metadata/api-inventory/tree',
  list = '/metadata/api-inventory/list',
  sync = '/metadata/api-inventory/sync',
  syncRuns = '/metadata/api-inventory/sync-runs',
  // API 背景需求（人工录入的设计态业务上下文，AI 复核结果时作为上下文）
  context = '/metadata/api-inventory/context',
}

// ── 实体元数据（基础配置 → 元数据管理）────────────────
// 数据来自平台库 perf_entity_meta（同步自 meta 库）+ 菜单挂载：
// tree 给「云/维度值 → 应用 → 菜单」左树（应用下有「未归类」，顶层有「未分类」），
// list 给实体表（产品线 + 编码/名称 + 树 scope 过滤，行上带表统计的行数/空间）
export enum ApiMetadataEntityMeta {
  tree = '/metadata/entity-meta/tree',
  list = '/metadata/entity-meta/list',
}
