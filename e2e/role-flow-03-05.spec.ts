/**
 * ROLE-FLOW-03/04/05: 项目组架构师分诊 + 开发修复 + 验证回归
 * 
 * 对应《12》§3 ROLE-FLOW-03/04/05
 * 验收: WF-001~006, IT-DISP, IT-FIX, IT-VF, UX-ROLE-02/03
 */
import { test, expect } from '../fixtures/roles';

test.describe('ROLE-FLOW-03: 项目组架构师进行问题分诊', () => {
  test('查看规则、代码证据、commit、影响模块和历史', async ({ architectPage }) => {
    await architectPage.goto('/sechub/findings');
    
    // 打开一个 Finding
    await architectPage.click('tr >> nth=1 >> a');
    
    // 验证证据面板
    await expect(architectPage.locator('[data-testid="finding-evidence"]')).toBeVisible();
    await expect(architectPage.locator('[data-testid="code-location"]')).toBeVisible();
    await expect(architectPage.locator('[data-testid="commit-info"]')).toBeVisible();
    await expect(architectPage.locator('[data-testid="affected-modules"]')).toBeVisible();
    await expect(architectPage.locator('[data-testid="finding-history"]')).toBeVisible();
  });

  test('must_fix 指派开发、设置期限和目标迭代', async ({ architectPage }) => {
    await architectPage.goto('/sechub/findings');
    await architectPage.click('tr >> nth=1 >> a');
    
    // 选择 must_fix
    await architectPage.click('[data-testid="disposition-select"]');
    await architectPage.click('.arco-select-option:has-text("must_fix")');
    
    // 指派开发
    await architectPage.click('[data-testid="assignee-select"]');
    await architectPage.click('.arco-select-option >> nth=0');
    
    // 设置期限
    await architectPage.fill('[data-testid="due-date"]', '2026-08-01');
    
    // 设置目标迭代
    await architectPage.click('[data-testid="target-iteration"]');
    await architectPage.click('.arco-select-option >> nth=0');
    
    // 提交
    await architectPage.click('button:has-text("提交")');
    
    // 验证成功
    await expect(architectPage.locator('.arco-message-success')).toBeVisible();
  });

  test('must_fix 缺责任人或期限不能提交', async ({ architectPage }) => {
    await architectPage.goto('/sechub/findings');
    await architectPage.click('tr >> nth=1 >> a');
    
    // 选择 must_fix 但不填责任人
    await architectPage.click('[data-testid="disposition-select"]');
    await architectPage.click('.arco-select-option:has-text("must_fix")');
    
    // 尝试提交
    await architectPage.click('button:has-text("提交")');
    
    // 应显示校验错误
    await expect(architectPage.locator('.arco-form-item-error')).toBeVisible();
  });

  test('非修复申请填写业务影响、技术理由、有效期', async ({ architectPage }) => {
    await architectPage.goto('/sechub/findings');
    await architectPage.click('tr >> nth=1 >> a');
    
    // 选择"不处理申请"
    await architectPage.click('[data-testid="disposition-select"]');
    await architectPage.click('.arco-select-option:has-text("不处理")');
    
    // 填写业务影响
    await architectPage.fill('[data-testid="business-impact"]', '影响范围有限');
    
    // 填写技术理由
    await architectPage.fill('[data-testid="technical-reason"]', '历史代码，重构成本高');
    
    // 设置有效期
    await architectPage.fill('[data-testid="valid-until"]', '2026-12-31');
    
    // 提交领域审批
    await architectPage.click('button:has-text("提交审批")');
    
    // 非修复只进入待审批，不直接关闭
    await expect(architectPage.locator('[data-testid="status-badge"]:has-text("待审批")')).toBeVisible();
  });

  test('项目组架构师不能审批本人申请', async ({ architectPage }) => {
    await architectPage.goto('/sechub/waivers');
    
    // 找到自己提交的申请
    const myRequest = architectPage.locator('tr:has-text("我提交的")');
    
    // 审批按钮应禁用或不存在
    await expect(myRequest.locator('button:has-text("审批")')).not.toBeVisible();
  });

  test('批量分诊同规则/同模块问题', async ({ architectPage }) => {
    await architectPage.goto('/sechub/findings');
    
    // 选择多个同规则 Finding
    await architectPage.check('.arco-table-checkbox >> nth=1');
    await architectPage.check('.arco-table-checkbox >> nth=2');
    
    // 批量指派
    await architectPage.click('button:has-text("批量指派")');
    await architectPage.click('[data-testid="batch-assignee"]');
    await architectPage.click('.arco-select-option >> nth=0');
    await architectPage.click('button:has-text("确认")');
    
    // 每个 Finding 保留独立决定和审计
    await expect(architectPage.locator('.arco-message-success')).toBeVisible();
  });
});

test.describe('ROLE-FLOW-04: 开发修复代码并提交验证', () => {
  test('查看 Finding 规则、路径/符号、证据、责任说明和期限', async ({ developerPage }) => {
    await developerPage.goto('/sechub/my-findings');
    
    // 打开一个 Finding
    await developerPage.click('tr >> nth=1 >> a');
    
    // 验证显示内容
    await expect(developerPage.locator('[data-testid="rule-info"]')).toBeVisible();
    await expect(developerPage.locator('[data-testid="code-path"]')).toBeVisible();
    await expect(developerPage.locator('[data-testid="evidence"]')).toBeVisible();
    await expect(developerPage.locator('[data-testid="responsibility-note"]')).toBeVisible();
    await expect(developerPage.locator('[data-testid="due-date"]')).toBeVisible();
  });

  test('提交修复 commit 并发起验证', async ({ developerPage }) => {
    await developerPage.goto('/sechub/my-findings');
    await developerPage.click('tr >> nth=1 >> a');
    
    // 填写 commit SHA（完整 40 位）
    await developerPage.fill('[data-testid="commit-sha"]', 'a'.repeat(40));
    
    // 填写修改说明
    await developerPage.fill('[data-testid="fix-message"]', '修复 SQL 注入漏洞');
    
    // 填写影响范围
    await developerPage.fill('[data-testid="impact-scope"]', 'UserDao.java');
    
    // 提交并发起验证
    await developerPage.click('button:has-text("提交并验证")');
    
    // 提交后为 pending_verification，不是 fixed
    await expect(developerPage.locator('[data-testid="status-badge"]:has-text("待验证")')).toBeVisible();
    
    // 开发不能直接关闭问题 — 无 fixed/closed 按钮
    await expect(developerPage.locator('button:has-text("标记已修复")')).not.toBeVisible();
    await expect(developerPage.locator('button:has-text("关闭")')).not.toBeVisible();
  });

  test('commit 必须存在于授权仓库/ref', async ({ developerPage }) => {
    await developerPage.goto('/sechub/my-findings');
    await developerPage.click('tr >> nth=1 >> a');
    
    // 填写无效 commit
    await developerPage.fill('[data-testid="commit-sha"]', 'invalid-commit');
    await developerPage.click('button:has-text("提交并验证")');
    
    // 应显示校验错误
    await expect(developerPage.locator('.arco-form-item-error')).toBeVisible();
  });

  test('从问题到提交验证≤3个业务操作', async ({ developerPage }) => {
    await developerPage.goto('/sechub/my-findings');
    
    // 操作 1: 打开问题
    await developerPage.click('tr >> nth=1 >> a');
    
    // 操作 2: 填写 commit
    await developerPage.fill('[data-testid="commit-sha"]', 'a'.repeat(40));
    
    // 操作 3: 提交
    await developerPage.click('button:has-text("提交并验证")');
    
    // 验证成功 — 3 步内完成
    await expect(developerPage.locator('.arco-message-success')).toBeVisible();
  });
});

test.describe('ROLE-FLOW-05: 验证修复并完整回归', () => {
  test('查看验证结果', async ({ operatorPage }) => {
    await operatorPage.goto('/sechub/campaigns');
    await operatorPage.click('tr:has-text("active") >> td >> a');
    
    // 查看验证状态
    await expect(operatorPage.locator('[data-testid="verification-status"]')).toBeVisible();
  });

  test('完整回归后领域批准', async ({ auditorPage }) => {
    await auditorPage.goto('/sechub/approvals');
    
    // 打开一个待审批项
    await auditorPage.click('tr:has-text("待审批") >> nth=0 >> a');
    
    // 查看证据
    await expect(auditorPage.locator('[data-testid="approval-evidence"]')).toBeVisible();
    
    // 批准
    await auditorPage.click('button:has-text("批准")');
    await auditorPage.click('.arco-modal button:has-text("确认")');
    
    // 验证成功
    await expect(auditorPage.locator('.arco-message-success')).toBeVisible();
  });

  test('领域升级总监', async ({ auditorPage }) => {
    await auditorPage.goto('/sechub/approvals');
    await auditorPage.click('tr:has-text("待审批") >> nth=0 >> a');
    
    // 升级总监
    await auditorPage.click('button:has-text("升级总监")');
    await auditorPage.fill('[data-testid="escalate-reason"]', '需要更高层级决策');
    await auditorPage.click('.arco-modal button:has-text("确认")');
    
    // 状态变为 pending_director_approval
    await expect(auditorPage.locator('[data-testid="status-badge"]:has-text("待总监审批")')).toBeVisible();
  });
});
