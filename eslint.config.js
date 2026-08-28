import antfu from '@antfu/eslint-config'

export default antfu(
  {
    vue: true,
  },
  // ── 时间处理约定（硬拦截，不依赖任何 agent / hook 配置）──
  //
  // 背景：改造前 20 个页面各自写了私有 formatTime，多数是
  // `replace('T', ' ').substring(0, 19)` 字符串截取，完全不处理时区；
  // 另有 toLocaleString 用的是浏览器时区而不是用户设置的时区。
  // 统一入口是 src/hooks/util/useTime.ts，这几条规则防止它再长回来。
  //
  // 放 eslint 而不是只放 check-conventions.sh：编辑器里就会红，`pnpm lint`
  // 直接失败，不依赖 agent 是否加载了 postToolUse hook。
  {
    files: ['src/views/**/*.vue', 'src/views/**/*.ts', 'src/components/**/*.vue', 'src/components/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'FunctionDeclaration[id.name=/^(formatTime|fmtTime|formatDate|fmtDate|formatDateTime|formatMinute)$/]',
          message: '不要在页面里自建时间格式化函数，用 import { formatTime } from \'@/hooks\'（按用户设置的时区渲染）',
        },
        {
          selector: 'VariableDeclarator[id.name=/^(formatTime|fmtTime|formatDate|fmtDate|formatDateTime|formatMinute)$/][init.type=/^(ArrowFunctionExpression|FunctionExpression)$/]',
          message: '不要在页面里自建时间格式化函数，用 import { formatTime } from \'@/hooks\'',
        },
        {
          selector: 'CallExpression[callee.property.name=/^toLocale(Date|Time)?String$/][callee.object.callee.name=\'Date\']',
          message: 'toLocaleString 用的是浏览器时区，不是用户设置的时区，用 formatTime()',
        },
        {
          selector: 'CallExpression[callee.property.name=\'replace\'][arguments.0.value=\'T\']',
          message: '不要靠字符串截取格式化时间（无法处理时区），用 formatTime()',
        },
      ],
    },
  },
)
