/**
 * ROLE-FLOW-01/02: 测试角色 — 设计迭代扫描计划 + 执行扫描并检查结论
 * 
 * 对应《12》§3 ROLE-FLOW-01/02
 * 验收: CP-001~004, GT-001~004, IT-CAMP, IT-GATE, UX-ROLE-01
 */
import { test, expect } from '../fixtures/roles';

test.describe('ROLE-FLOW-01: 测试设计迭代扫描计划', () => {
  test('创建 Campaign 并选择现有迭代', async ({ operatorPage }) => {
    // 进入迭代扫描计划页面
    await operatorPage.goto('/sechub/campaigns');
    
    // 点击新建
    await operatorPage.click('button:has-text("新建")');
    
    // 选择现有迭代（不填写内部 ID）
    await operatorPage.click('[data-testid="iteration-select"]');
    await operatorPage.click('.arco-select-option >> nth=0');
    
    // 验证迭代名称和起止时间显示
    await expect(operatorPage.locator('[data-testid="iteration-info"]')).toBeVisible();
    
    // 不填写内部 ID — 验证无内部 ID 输入框
    await expect(operatorPage.locator('input[name="internal_id"]')).not.toBeVisible();
  });

  test('批量选择必扫工程/仓库/动态分支', async ({ operatorPage }) => {
    await operatorPage.goto('/sechub/campaigns/new');
    
    // 批量选择工程
    await operatorPage.click('[data-testid="select-projects"]');
    await operatorPage.check('.arco-checkbox >> nth=0');
    await operatorPage.check('.arco-checkbox >> nth=1');
    
    // 动态分支选择（不固化枚举）
    await operatorPage.click('[data-testid="branch-select"]');
    // 分支列表应从仓库动态获取
    const branchOptions = operatorPage.locator('.arco-select-option');
    await expect(branchOptions).toHaveCount({ minimum: 1 });
  });

  test('预检仓库/规则/Worker 能力', async ({ operatorPage }) => {
    await operatorPage.goto('/sechub/campaigns/new');
    
    // 触发预检
    await operatorPage.click('button:has-text("预检")');
    
    // 等待预检结果
    await operatorPage.waitForSelector('[data-testid="precheck-result"]');
    
    // 显示缺口（如有）
    const gaps = operatorPage.locator('[data-testid="precheck-gaps"]');
    // 预检应显示规则策略缺口、不可执行项
  });

  test('激活计划版本', async ({ operatorPage }) => {
    await operatorPage.goto('/sechub/campaigns');
    
    // 选择一个 draft campaign
    await operatorPage.click('tr:has-text("draft") >> td >> button');
    
    // 激活
    await operatorPage.click('button:has-text("激活")');
    await operatorPage.click('.arco-modal button:has-text("确认")');
    
    // 激活后编辑/删除 Item 消失
    await expect(operatorPage.locator('button:has-text("删除 Item")')).not.toBeVisible();
    
    // 显示"创建新版本"
    await expect(operatorPage.locator('button:has-text("创建新版本")')).toBeVisible();
  });

  test('一个迭代只有一份有效 Campaign', async ({ operatorPage }) => {
    await operatorPage.goto('/sechub/campaigns');
    
    // 尝试为同一迭代创建第二个 Campaign
    await operatorPage.click('button:has-text("新建")');
    await operatorPage.click('[data-testid="iteration-select"]');
    await operatorPage.click('.arco-select-option:has-text("已有Campaign的迭代")');
    
    // 应提示已存在或阻止
    await expect(operatorPage.locator('.arco-message-warning, .arco-alert-warning')).toBeVisible();
  });
});

test.describe('ROLE-FLOW-02: 测试执行扫描并检查结论', () => {
  test('批量执行 Item', async ({ operatorPage }) => {
    await operatorPage.goto('/sechub/campaigns');
    await operatorPage.click('tr:has-text("active") >> td >> a');
    
    // 批量执行
    await operatorPage.check('.arco-table-checkbox >> nth=1');
    await operatorPage.check('.arco-table-checkbox >> nth=2');
    await operatorPage.click('button:has-text("执行")');
    
    // 跟踪 Source/Run/Publication
    await expect(operatorPage.locator('[data-testid="run-progress"]')).toBeVisible();
  });

  test('检查迭代扫描结论', async ({ operatorPage }) => {
    await operatorPage.goto('/sechub/campaigns');
    await operatorPage.click('tr:has-text("active") >> td >> a');
    
    // 点击"检查迭代扫描结论"
    await operatorPage.click('button:has-text("检查迭代扫描结论")');
    
    // 结论应为 not_ready/blocked/passed
    const assessment = operatorPage.locator('[data-testid="assessment-result"]');
    await expect(assessment).toBeVisible();
    
    // 不能直接通过 — 无"强制通过"按钮
    await expect(operatorPage.locator('button:has-text("强制通过")')).not.toBeVisible();
    await expect(operatorPage.locator('button:has-text("设为 passed")')).not.toBeVisible();
  });

  test('blocked 显示未通过项和责任角色', async ({ operatorPage }) => {
    await operatorPage.goto('/sechub/campaigns');
    await operatorPage.click('tr:has-text("blocked") >> td >> a');
    
    // 显示未通过项
    await expect(operatorPage.locator('[data-testid="blocked-reasons"]')).toBeVisible();
    
    // 显示责任角色和期限
    await expect(operatorPage.locator('[data-testid="responsible-role"]')).toBeVisible();
  });

  test('60 秒 HTTP 轮询（非 SSE）', async ({ operatorPage }) => {
    await operatorPage.goto('/sechub/campaigns');
    await operatorPage.click('tr:has-text("running") >> td >> a');
    
    // 监听网络请求
    const requests: string[] = [];
    operatorPage.on('request', (req) => {
      if (req.url().includes('/progress')) {
        requests.push(req.url());
      }
    });
    
    // 等待至少一次轮询
    await operatorPage.waitForTimeout(65000);
    
    // 应有 HTTP GET 请求，不是 SSE
    expect(requests.length).toBeGreaterThan(0);
    
    // 不应有 EventSource 连接
    const sseRequests = requests.filter(url => url.includes('event-stream'));
    expect(sseRequests).toHaveLength(0);
  });
});
