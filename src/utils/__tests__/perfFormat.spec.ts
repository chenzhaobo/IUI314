/**
 * perfFormat 的单测（纯函数，无 Vue 依赖）。
 *
 * 仓库没有 vitest 配置（package.json 无测试框架、无 vitest.config），因此本文件只用
 * Node 内置的 node:test + node:assert，不引入任何新依赖。运行方式见交付清单：
 * 先用 tsc 把这两个文件编译到临时目录，再交给 node 的测试运行器执行（Node 22 不支持
 * 直接跑 .ts，tsc 是仓库已有的 devDependency）。
 */
/* eslint-disable test/no-import-node-test -- 仓库无 vitest 配置（不改 package.json、不引入新依赖），单测只用 Node 内置 test runner */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EMPTY_TEXT, formatMetric, formatNumber, formatPercent } from '../perfFormat'

test('空值统一返回占位符', () => {
  for (const empty of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(formatMetric(empty, 'byte'), EMPTY_TEXT)
    assert.equal(formatNumber(empty), EMPTY_TEXT)
    assert.equal(formatPercent(empty), EMPTY_TEXT)
  }
})

test('byte：1024 进制自动换算，1 位小数', () => {
  assert.equal(formatMetric(6712859927.2727, 'byte'), '6.3 GiB')
  assert.equal(formatMetric(0, 'byte'), '0 B')
  assert.equal(formatMetric(512, 'byte'), '512 B')
  assert.equal(formatMetric(1536, 'byte'), '1.5 KiB')
  assert.equal(formatMetric(2147483648, 'byte'), '2.0 GiB')
})

test('ratio：×100 转百分比，1 位小数', () => {
  assert.equal(formatMetric(0.19734567, 'ratio'), '19.7%')
  assert.equal(formatMetric(0, 'ratio'), '0.0%')
  assert.equal(formatMetric(1, 'ratio'), '100.0%')
})

test('core：2 位小数 + 核', () => {
  assert.equal(formatMetric(0.19734567, 'core'), '0.20 核')
  assert.equal(formatMetric(12, 'core'), '12.00 核')
})

test('ms：<1000 取整毫秒，≥1000 换算秒', () => {
  assert.equal(formatMetric(999.4, 'ms'), '999 ms')
  assert.equal(formatMetric(1639.7499999, 'ms'), '1.64 s')
  assert.equal(formatMetric(18840, 'ms'), '18.84 s')
})

test('count：取整 + 千分位', () => {
  assert.equal(formatMetric(1234.4, 'count'), '1,234')
  assert.equal(formatMetric(1234567, 'count'), '1,234,567')
  assert.equal(formatMetric(0, 'count'), '0')
})

test('tps / rps：2 位小数', () => {
  assert.equal(formatMetric(2.1111, 'tps'), '2.11')
  assert.equal(formatMetric(2.1111, 'rps'), '2.11')
})

test('未知单位：最多 2 位小数并去掉尾随 0', () => {
  assert.equal(formatMetric(3.5), '3.5')
  assert.equal(formatMetric(3.14159), '3.14')
  assert.equal(formatMetric(2, 'flag'), '2')
  assert.equal(formatMetric(1234.5, 'score'), '1,234.5')
  assert.equal(formatMetric(-0.001), '0')
})

test('formatNumber：固定位数 + 千分位', () => {
  assert.equal(formatNumber(1234567.891, 2), '1,234,567.89')
  assert.equal(formatNumber(1234567.891, 0), '1,234,568')
  assert.equal(formatNumber(-1234.5, 1), '-1,234.5')
})

test('formatPercent：默认 1 位小数，可指定位数', () => {
  assert.equal(formatPercent(0.19734567), '19.7%')
  assert.equal(formatPercent(0.19734567, 2), '19.73%')
})
