/**
 * @description: 平台元数据 API（与业务域无关）
 */

// ── API 清单（基础配置 → 元数据管理）────────────────
// 数据来自所选测试环境的 OpenAPI 定义库：tree 给维度树，list 给接口表，sync 同步到平台库
export enum ApiMetadataInventory {
  tree = '/metadata/api-inventory/tree',
  list = '/metadata/api-inventory/list',
  sync = '/metadata/api-inventory/sync',
}
