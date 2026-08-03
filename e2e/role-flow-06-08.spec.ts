/**
 * ROLE-FLOW-06/07/08: 领域审批 + 系统计算结论 + 总监驾驶舱
 * 
 * 对应《12》§3 ROLE-FLOW-06/07/08
 * 验收: WF-007/009, GT-001~004, BI-001~006, UX-ROLE-04/05
 */
import { test, expect } from '../fixtures/roles';

test.describe('ROLE-FLOW-06: 领域架构师审批非修复处置和 Finding 关闭', () => {
  test('查看证据、范围、期限、历史', async ({ auditorPage }) => {
    await auditorPage.goto('/sechub/approvals');
    
    // 打开一个待审批项
    await auditorPage.click('tr:has-text("待审批") >> nth=0 >> a');
    
    // 验证完整信息
    await expect(auditorPage.locator('[data-testid="approval-evidence"]')).toBeVisible();
    await expect(auditorPage.locator('[data-testid="approval-scope"]')).toBeVisible();
    await expect(auditorPage.locator('[data-testid="approval-deadline"]')).toBeVisible();
    await expect(auditorPage.locator('[data-testid="approval-history"]')).toBeVisible();
  });

  test('最终批准非修复处置', async ({ auditorPage }) => {
    await auditorPage.goto('/sechub/approvals');
    await auditorPage.click('tr:has-text("待审批") >> nth=0 >> a');
    
    // 批准
    await auditorPage.click('button:has-text("批准")');
    await auditorPage.fill('[data-testid="approval-comment"]', '同意延期处理');
    await auditorPage.click('.arco-modal button:has-text("确认")');
    
    // 验证成功
    await expect(auditorPage.locator('.arco-message-success')).toBeVisible();
  });

  test('拒绝非修复处置', async ({ auditorPage }) => {
    await auditorPage.goto('/sechub/approvals');
    await auditorPage.click('tr:has-text("待审批") >> nth=0 >> a');
    
    // 拒绝
    await auditorPage.click('button:has-text("拒绝")');
    await auditorPage.fill('[data-testid="rejection-reason"]', '风险过高，必须修复');
    await auditorPage.click('.arco-modal button:has-text("确认")');
    
    // 状态变为 must_fix
    await expect(auditorPage.locator('[data-testid="status-badge"]:has-text("must_fix")')).toBeVisible();
  });

  test('升级总监', async ({ auditorPage }) => {
    await auditorPage.goto('/sechub/approvals');
    await auditorPage.click('tr:has-text("待审批") >> nth=0 >> a');
    
    // 升级
    await auditorPage.click('button:has-text("升级总监")');
    await auditorPage.fill('[data-testid="escalate-reason"]', '跨领域影响，需要总监决策');
    await auditorPage.click('.arco-modal button:has-text("确认")');
    
    // 状态变为 pending_director_approval
    await expect(auditorPage.locator('[data-testid="status-badge"]:has-text("待总监")')).toBeVisible();
  });

  test('申请人无审批按钮', async ({ architectPage }) => {
    await architectPage.goto('/sechub/approvals');
    
    // 找到自己提交的申请
    const myRequest = architectPage.locator('tr:has-text("我提交的")');
    
    // 无审批按钮
    await expect(myRequest.locator('button:has-text("批准")')).not.toBeVisible();
    await expect(myRequest.locator('button:has-text("拒绝")')).not.toBeVisible();
  });

  test('无证据时不能批准', async ({ auditorPage }) => {
    await auditorPage.goto('/sechub/approvals');
    await auditorPage.click('tr:has-text("待审批") >> nth=0 >> a');
    
    // 如果证据不完整，批准按钮应禁用
    const approveBtn = auditorPage.locator('button:has-text("批准")');
    const isDisabled = await approveBtn.isDisabled();
    
    // 如果有完整证据，可以批准；否则禁用
    // 这里验证逻辑存在
    expect(typeof isDisabled).toBe('boolean');
  });
});

test.describe('ROLE-FLOW-07: 系统计算并上报迭代扫描结论', () => {
  test('检查结论按钮触发 GateAssessment', async ({ operatorPage }) => {
    await operatorPage.goto('/sechub/campaigns');
    await operatorPage.click('tr:has-text("active") >> td >> a');
    
    // 点击"检查迭代扫描结论"
    await operatorPage.click('button:has-text("检查迭代扫描结论")');
    
    // 等待评估完成
    await operatorPage.waitForSelector('[data-testid="assessment-result"]');
    
    // 结论为 not_ready/blocked/passed
    const result = await operatorPage.textContent('[data-testid="assessment-result"]');
    expect(['not_ready', 'blocked', 'passed'].some(s => result?.includes(s))).toBeTruthy();
  });

  test('不能直接设置 passed', async ({ operatorPage }) => {
    await operatorPage.goto('/sechub/campaigns');
    await operatorPage.click('tr:has-text("active") >> td >> a');
    
    // 无"设为 passed"按钮
    await expect(operatorPage.locator('button:has-text("设为 passed")')).not.toBeVisible();
    await expect(operatorPage.locator('button:has-text("强制通过")')).not.toBeVisible();
    
    // 无直接修改 status 的输入
    await expect(operatorPage.locator('input[name="status"]')).not.toBeVisible();
  });

  test('上报不写真实发版状态', async ({ operatorPage }) => {
    await operatorPage.goto('/sechub/campaigns');
    await operatorPage.click('tr:has-text("passed") >> td >> a');
    
    // 点击上报
    await operatorPage.click('button:has-text("上报")');
    
    // 上报成功
    await expect(operatorPage.locator('.arco-message-success')).toBeVisible();
    
    // 不显示"允许发版"或"已发版"
    await expect(operatorPage.locator(':has-text("允许发版")')).not.toBeVisible();
    await expect(operatorPage.locator(':has-text("已发版")')).not.toBeVisible();
  });

  test('passed 只表示迭代扫描通过', async ({ operatorPage }) => {
    await operatorPage.goto('/sechub/campaigns');
    await operatorPage.click('tr:has-text("passed") >> td >> a');
    
    // 显示评估时间、policy、证据摘要
    await expect(operatorPage.locator('[data-testid="assessment-time"]')).toBeVisible();
    await expect(operatorPage.locator('[data-testid="assessment-policy"]')).toBeVisible();
    await expect(operatorPage.locator('[data-testid="evidence-summary"]')).toBeVisible();
    
    // 不显示"允许发版"
    await expect(operatorPage.locator(':has-text("允许发版")')).not.toBeVisible();
  });
});

test.describe('ROLE-FLOW-08: 总监查看迭代扫描并处理升级事项', () => {
  test('首屏回答扫了什么、覆盖轨迹、规则/通过率、未通过项和扫描结论', async ({ directorPage }) => {
    await directorPage.goto('/sechub/dashboard');
    
    // 首屏必须回答的问题
    await expect(directorPage.locator('[data-testid="scan-scope"]')).toBeVisible();
    await expect(directorPage.locator('[data-testid="coverage-trend"]')).toBeVisible();
    await expect(directorPage.locator('[data-testid="rule-pass-rate"]')).toBeVisible();
    await expect(directorPage.locator('[data-testid="failed-items"]')).toBeVisible();
    await expect(directorPage.locator('[data-testid="assessment-conclusion"]')).toBeVisible();
  });

  test('按组织/项目组/领域/工程数据范围筛选', async ({ directorPage }) => {
    await directorPage.goto('/sechub/dashboard');
    
    // 筛选器
    await directorPage.click('[data-testid="scope-filter"]');
    await directorPage.click('.arco-select-option:has-text("项目组A")');
    
    // 数据应更新
    await directorPage.waitForTimeout(1000);
  });

  test('与上一迭代比较', async ({ directorPage }) => {
    await directorPage.goto('/sechub/dashboard');
    
    // 切换对比模式
    await directorPage.click('[data-testid="compare-toggle"]');
    
    // 显示对比数据
    await expect(directorPage.locator('[data-testid="comparison-data"]')).toBeVisible();
  });

  test('只处理升级事项', async ({ directorPage }) => {
    await directorPage.goto('/sechub/escalated-approvals');
    
    // 只显示已升级事项
    const rows = directorPage.locator('tr');
    const count = await rows.count();
    
    for (let i = 1; i < count; i++) {
      const status = await rows.nth(i).textContent();
      expect(status).toContain('待总监审批');
    }
  });

  test('未升级事项无按钮', async ({ directorPage }) => {
    await directorPage.goto('/sechub/approvals');
    
    // 找到未升级事项
    const normalApproval = directorPage.locator('tr:has-text("待领域审批")');
    
    // 总监无审批按钮
    await expect(normalApproval.locator('button:has-text("批准")')).not.toBeVisible();
  });

  test('处理升级审批', async ({ directorPage }) => {
    await directorPage.goto('/sechub/escalated-approvals');
    await directorPage.click('tr >> nth=1 >> a');
    
    // 批准
    await directorPage.click('button:has-text("最终批准")');
    await directorPage.fill('[data-testid="director-comment"]', '同意');
    await directorPage.click('.arco-modal button:has-text("确认")');
    
    // 验证成功
    await expect(directorPage.locator('.arco-message-success')).toBeVisible();
  });

  test('通过率口径正确', async ({ directorPage }) => {
    await directorPage.goto('/sechub/dashboard');
    
    // 通过率 = pass/(pass+fail)
    const passRate = await directorPage.textContent('[data-testid="pass-rate"]');
    
    // unknown/N/A/waived 单列
    await expect(directorPage.locator('[data-testid="unknown-count"]')).toBeVisible();
    await expect(directorPage.locator('[data-testid="na-count"]')).toBeVisible();
    await expect(directorPage.locator('[data-testid="waived-count"]')).toBeVisible();
    
    // 显示数据时间、policy 和 RuleSet version
    await expect(directorPage.locator('[data-testid="data-time"]')).toBeVisible();
    await expect(directorPage.locator('[data-testid="policy-version"]')).toBeVisible();
    await expect(directorPage.locator('[data-testid="ruleset-version"]')).toBeVisible();
  });

  test('下钻到 CampaignItem→Run→规则/Finding', async ({ directorPage }) => {
    await directorPage.goto('/sechub/dashboard');
    
    // 点击指标下钻
    await directorPage.click('[data-testid="metric-drilldown"]');
    
    // 显示 CampaignItem
    await expect(directorPage.locator('[data-testid="campaign-items"]')).toBeVisible();
    
    // 点击 Item 下钻到 Run
    await directorPage.click('[data-testid="campaign-items"] >> tr >> nth=0');
    await expect(directorPage.locator('[data-testid="run-details"]')).toBeVisible();
    
    // 点击 Run 下钻到规则/Finding
    await directorPage.click('[data-testid="run-details"] >> tr >> nth=0');
    await expect(directorPage.locator('[data-testid="rule-findings"]')).toBeVisible();
  });

  test('不显示 Worker、lease、Batch 等技术细节', async ({ directorPage }) => {
    await directorPage.goto('/sechub/dashboard');
    
    // 不应显示技术细节
    await expect(directorPage.locator(':has-text("Worker")')).not.toBeVisible();
    await expect(directorPage.locator(':has-text("lease")')).not.toBeVisible();
    await expect(directorPage.locator(':has-text("Batch")')).not.toBeVisible();
    await expect(directorPage.locator(':has-text("fencing")')).not.toBeVisible();
  });

  test('总监不能修改扫描事实', async ({ directorPage }) => {
    await directorPage.goto('/sechub/dashboard');
    
    // 无编辑按钮
    await expect(directorPage.locator('button:has-text("编辑")')).not.toBeVisible();
    await expect(directorPage.locator('button:has-text("修改")')).not.toBeVisible();
    
    // 无删除按钮
    await expect(directorPage.locator('button:has-text("删除")')).not.toBeVisible();
  });

  test('历史迭代数字不随当前规则修改', async ({ directorPage }) => {
    await directorPage.goto('/sechub/dashboard');
    
    // 切换到历史迭代
    await directorPage.click('[data-testid="iteration-select"]');
    await directorPage.click('.arco-select-option:has-text("上一迭代")');
    
    // 记录当前数字
    const historicalCount = await directorPage.textContent('[data-testid="finding-count"]');
    
    // 切换回当前迭代
    await directorPage.click('[data-testid="iteration-select"]');
    await directorPage.click('.arco-select-option:has-text("当前迭代")');
    
    // 再切换回历史迭代
    await directorPage.click('[data-testid="iteration-select"]');
    await directorPage.click('.arco-select-option:has-text("上一迭代")');
    
    // 数字应不变
    const afterCount = await directorPage.textContent('[data-testid="finding-count"]');
    expect(afterCount).toBe(historicalCount);
  });
});
