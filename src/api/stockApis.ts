/**
 * @description: 库存分析 - GigaB2B Api
 */
export enum ApiStockGiga {
  sync = '/stock/giga/sync',
  getList = '/stock/giga/list',
}

/**
 * @description: 库存分析 - Amazon 报表 Api
 */
export enum ApiStockAmazon {
  upload = '/stock/amazon/upload',
  autoFetch = '/stock/amazon/auto_fetch',
  getReportList = '/stock/amazon/report/list',
}

/**
 * @description: 库存分析 - 差异分析 Api
 */
export enum ApiStockAnalysis {
  run = '/stock/analysis/run',
  getResult = '/stock/analysis/result',
  export = '/stock/analysis/export',
}
