# Sprint 2 Diff 实现与交接说明

本文档以 2026-07-14 的当前仓库代码为准，说明富文本渲染、语义 Diff、
Keep/Restore、Preview Draft、Storage 重建和当前页面写回的真实实现。

需要先明确两点：

1. 比较页和 Preview Draft 使用项目内的手动 Storage renderer，不调用
   Content Body Conversion API，也不使用 `AdfRenderer`。
2. 当前 UI 的 **Preview Draft** 是写回前的预览；最终按钮会更新当前页面，
   并不会创建未发布的 Confluence Draft。后端旧的 `createDraft` resolver
   仍保留，但前端没有调用它。

## 1. 当前行为概览

页面比较方向为：

```text
选择的历史版本  ->  当前版本
```

底层页面级 Diff 结果只使用：

```text
same / removed / added
```

修改内容表示为旧块 `removed` 加新块 `added`。UI 可以把类型和标签相容的
旧、新块组合为同一个选择，但不会改写底层结果顺序。

用户操作粒度为可安全恢复的完整语义块：

- 点击变化块后显示 `Keep current change` 和 `Restore old content`；
- 选择后显示完整选中内容、选择状态和 `Undo`；
- 未明确选择的变化默认使用当前版本；
- Preview Draft 只预览，不会发起写操作；
- `Write to Current Page` 将重建的 Storage 写为当前页面的新版本。

## 2. 关键文件与职责

### `static/hello-world/src/utils.js`

负责 Storage 解析保护、手动渲染与 sanitization、语义块提取、语义签名、
LCS 对齐、分栏渲染、逻辑表格网格匹配和 Diff 结果生成。

关键函数：

| 函数 | 当前职责 |
| --- | --- |
| `normaliseStorageHtmlForParsing` | 在送入浏览器 `DOMParser` 前保护代码 CDATA，并临时展开可能吞掉后续内容的 Confluence 自闭合节点。只影响解析输入，不直接改写原 Storage。 |
| `prepareConfluenceHtml` | 将支持的 Storage/ADF 内容转换为安全预览 HTML，并通过标签、属性、URL、样式和 `data-dh-*` 白名单清理输出。 |
| `normaliseCodeMacroStorageForWriteBack` | 把预览可读但写回不合法的代码正文恢复为有效 CDATA；已经合法的 CDATA 保持不变。 |
| `canonicalDomSignature` | 对标签、嵌套、格式、日期、链接、图片和渲染 metadata 生成稳定语义签名。 |
| `layoutStructureSignature` | 比较 Layout/Section/Cell 的类型、breakout、顺序和栏宽结构，不包含栏内正文。 |
| `extractLayoutDiffBlocks` | 在布局签名相同时生成不可选择的布局边界，并按 Cell 提取正文块。 |
| `extractDiffBlocks` | 页面级语义块提取入口；布局相容时走布局专用路径，否则按完整块安全处理。 |
| `extractTableRows` | 建立考虑 `rowspan`/`colspan` 占位的逻辑表格网格。 |
| `analyseTableCompatibility` | 判断表格能否生成单表、单元格级比较，或是否必须整表回退。 |
| `buildCellLevelTableComparison` | 在一张比较表中渲染修改单元格和末端行列变化。 |
| `buildTableReplacementBlocks` | 保留完整旧/新表格恢复块，同时为 UI 附加可选的单表 comparison HTML。 |
| `buildRichTextDiffHtml` | Diff 主入口：提取旧/新块、执行 LCS、生成 `same/removed/added` 并装饰相邻表格替换。 |

### `static/hello-world/src/components/ComparisonPanel.js`

负责显示、选择、预览和写回流程。

| 函数 | 当前职责 |
| --- | --- |
| `buildChangeRunRows` | 在连续变化区间内按 `nodeType` 和 HTML tag 配对相容的 removed/added 块。 |
| `buildDiffDisplayRows` | 生成显示行、共享 choice key，并重建相容布局的嵌套显示树。 |
| `getGitHubStyleDiffParts` | 普通变化显示红/绿行；带 `cell_level` 数据的旧/新表格对只显示一张 comparison table。 |
| `DiffDisplayRows` | 递归渲染布局 wrapper、未变化内容、未决变化和已选择内容。 |
| `getBlockRenderedPreviewHtml` | 按 current/old 选择返回一个块的安全显示 HTML。 |
| `buildRecoveryPreviewHtml` | 将已选择的渲染块各输出一次，避免 ADF 节点和 fallback 在预览中重复。 |
| `handlePreviewDraft` | 固化当前 choice、预览 HTML、重建 Storage 和预览时的当前版本号。 |
| `handleConfirmWriteBack` | 调用 `writeRecoveredPage`，成功后触发版本列表刷新。 |

Mention 预览会从两个版本提取 account ID，前端最多查询 100 个用户的
`displayName`。查询失败时使用安全 fallback，但比较和写回仍保留原 account ID。

### `static/hello-world/src/recoveryStorage.js`

`buildRecoveryStorageHtml` 根据 choice 选择原始旧/当前 Storage：

- 未选择时默认 current；
- 明确选择 `old` 才恢复历史块；
- Task 与 Decision item 会重新组合为有效组，避免重复 wrapper/fallback；
- 相容布局的 Layout/Section/Cell 开闭边界会被保留；
- self-closing Mention/Emoji 等 Storage 继续保持正确边界；
- code macro 在最终输出时执行 CDATA 规范化；
- unsupported 内容缺少可恢复 raw Storage 时返回错误，不允许把占位卡写回。

### `src/index.js`

当前定义三个 resolver：

| Resolver | 状态与用途 |
| --- | --- |
| `getPageVersions` | 当前 UI 使用。分页读取版本、live current Storage、附件和作者。版本与附件各最多读取 1,000 项。 |
| `writeRecoveredPage` | 当前 UI 使用。用 `asUser()` 重读当前页、检查预览版本号、限制 2 MB Storage，再 PUT 新版本。 |
| `createDraft` | 旧兼容接口。当前 UI 不调用。 |

### `static/hello-world/src/styles.css`

负责：

- 普通 removed/added 行的红绿外边框和 `-/+` gutter；
- 保留正文、Panel、Status 和单元格原背景，不使用整行红绿填充；
- 表格修改单元格的 previous/current 红绿边框；
- 末端新增/删除行列的连续外围框；
- 标准分栏 Grid、自定义栏宽 Flex 比例和移动端单栏布局；
- 手动 renderer 的标题、列表、Panel、Decision、日期、代码、图片等样式。

## 3. Diff 数据流程

```text
old Storage                              current Storage
     |                                         |
     +------ normaliseStorageHtmlForParsing ---+
     |                                         |
     +--------- layoutStructureSignature ------+
                         |
             +-----------+-----------+
             |                       |
       签名完全相同                签名不同
             |                       |
   按 Layout/Section/Cell       完整 Layout 安全块
   边界与栏内语义块提取
             |                       |
             +------ semantic blocks +
                         |
                canonical signature
                         |
                        LCS
                         |
             same / removed / added
                         |
        相邻 table replacement UI decoration
                         |
        +----------------+----------------+
        |                                 |
 comparison rendered HTML          recoverable raw Storage
```

`buildRichTextDiffHtml` 的 LCS 矩阵安全阈值为：

```text
old block count * current block count <= 120000
```

超过阈值时不会分配完整矩阵，而是返回标记为 `limited` 的当前侧安全结果，
比较页会显示提示。这是资源保护，不代表已经执行完整 Diff。

## 4. 语义块与相等规则

当前主要语义单位包括：

```text
paragraph, heading, list, task_item, blockquote, table,
panel, decision, image, code_block, expand, whiteboard_card,
unsupported, layout boundary
```

相等签名保留可见或可恢复的语义，例如：

- 标签和嵌套结构；
- bold、italic、underline、strike、sub/sup、inline code；
- 链接、文字颜色、高亮、alignment、indentation；
- Date、Status、Mention、Emoji metadata；
- 图片身份、尺寸、位置、边框和 caption；
- 表格 cell、span、背景和内容；
- renderer 生成的持久化 `data-dh-*` 属性；
- 相容布局内 block 的 `layoutPath`。

签名忽略属性顺序、CSS declaration 顺序、普通序列化空白以及
`<b>/<strong>`、`<i>/<em>` 等等价表达。

可见换行规则仍为：双方都至少有一个连续 `<br>` 时视为等价；从无换行变为
有换行仍产生 Diff。

## 5. 内容类型处理

| 类型 | 比较粒度与现状 |
| --- | --- |
| Paragraph / Heading | 完整段落或标题。文本、格式或 inline metadata 改动产生 removed/added，不做字词级 staging。 |
| Ordered / Unordered list | 完整列表，包括嵌套结构。普通列表不按 item 恢复。 |
| Task | item 级比较；写回时重新组合 Task Storage。 |
| Decision | item 级比较；决定状态和文本参与签名，写回时重建完整 extension/fallback。 |
| Blockquote | 完整引用块。 |
| Panel | 一个 Panel 一个块；类型来自 Storage metadata，不根据正文词语猜测。 |
| Code / Expand | 完整块；代码保留空白和语言 metadata，Expand 比较 summary 与正文。 |
| Date / Status / Mention / Emoji | 作为 containing block 的 inline 语义参与比较。 |
| Image | 独立块；附件/URL、尺寸、alignment/layout、边框、alt/title、rotation 和内嵌 caption 参与比较。 |
| Whiteboard / smart card | 完整 card；显示安全卡片，保留目标 metadata 和 raw Storage。 |
| Unsupported | 完整 raw-preserved 块；正常视图显示安全 fallback，恢复继续使用原 Storage。 |

## 6. 手动渲染器现状

### 6.1 Sanitizer

`prepareConfluenceHtml` 不会直接把原始 Storage 交给页面。它只允许已知安全的
HTML 标签和属性，并对 URL scheme、CSS property/value 和 app metadata 做限制。
原始 unsupported 数据只能作为转义文本出现在 raw inspector 中。

### 6.2 Panel

ADF Panel 使用 `panel-type` 等属性；structured macro 使用 `ac:name`。可见正文
即使以 “Info” 或 “Warning” 开头，也不会改变类型。

目标站点的 legacy structured macro 映射为：

```text
info -> info
tip -> success
note -> warning
warning -> error
panel -> custom/panel
success -> success
error -> error
```

Panel 图标当前被隐藏，开头使用粗体类型文字；原正文不因与类型文字重复而删除。
Custom Panel 可以继续使用 Storage 中已清理的背景色。

### 6.3 Code

预览会移除 `<![CDATA[...]]>` 外壳，保留内部代码、换行和行号，不执行代码。
对测试页中出现过的异常 HTML CDATA 开闭标签有定向修复。写回使用原始或规范化
CDATA，而不是预览 DOM。

### 6.4 Image

图片宽高从显示尺寸属性读取，不误用 `original-width`/`original-height`。
renderer 支持 attachment/URL、水平位置、wrap、caption 和
`<ac:adf-mark key="border">`。caption 作为 figure 内标题显示；图片下方手工输入
的普通段落仍单独比较。

### 6.5 Layout 显示

标准类型使用：

| Storage type | 显示比例 |
| --- | --- |
| `single` | 1 栏 |
| `two_equal` | `1:1` |
| `two_left_sidebar` | `1:2` |
| `two_right_sidebar` | `2:1` |
| `three_equal` | `1:1:1` |
| `three_with_sidebars` | `1:2:1` |

若每个 Cell 都有合法的 `data-width`/`ac:width`/`width`，实际栏宽优先于 type。
宽度会四舍五入为 1..100 的安全 `data-dh-layout-weight`，由 CSS Flex 按相对比例
显示。例如 33.33/66.67 约等于 33/67，25/50/25 保持 1:2:1。

视口宽度不超过 760 px 时，所有分栏按设计改为纵向单栏。

## 7. Table Diff 当前规则

### 7.1 逻辑网格

`extractTableRows` 记录每个 cell 的：

```text
rowIndex, cellIndex, logical colIndex, td/th,
rowspan, colspan, sectionTag, content signature, backgroundColor
```

合并单元格会占用其覆盖的每个逻辑坐标，因此后续 cell 不会仅因 DOM index
相同而错配。

### 7.2 单表、单元格级显示

以下情况可使用 `cell_level`：

- 行列和 cell 几何完全对应；
- 匹配的 `rowspan`/`colspan` 完全一致；
- 只在最下方追加/删除完整行；
- 只在最右侧追加/删除完整列；
- 上述末端行列变化同时发生，包括一个方向增加、另一个方向删除；
- 公共逻辑区域没有出现会表明中间插入的稳定轴位移。

UI 此时只显示一张表：

- unchanged cell 只出现一次；
- modified cell 内上下显示 old/current，各自保留自己的 cell background，并由
  红框/绿框贴合该区域；
- 末端新增/删除行列只画整个变化区域的外围框，不为每格显示加减号；
- 同时变化行列形成 L 形外围框，右下交叉不会重复画框；
- 一个方向增、另一个方向减时，比较用合成表会加入一个中性空角，该角不属于
  old/current 任一版本，也不会标红或标绿。

### 7.3 整表 fallback

以下情况不做启发式映射：

- 中间插入或删除行/列；
- `rowspan` 或 `colspan` 改变；
- 重复起始逻辑坐标；
- 合并单元格跨越新旧边界；
- 其他无法可靠确定 cell 对应关系的结构。

fallback 继续显示完整旧表 removed 和完整新表 added。

无论 UI 使用哪种显示，恢复粒度仍是整张表。单表 comparison HTML 只是
`tableDiff.comparisonHtml`，底层仍保存完整 removed/added 表格 Storage。

## 8. Layout Diff 与已知限制

只有旧、新 `layoutStructureSignature` 完全相同，才会设置
`splitCompatibleLayouts=true`。签名包含：

- Layout/Section/Cell wrapper 顺序；
- Section type；
- breakout mode；
- Cell 的已存栏宽。

签名不包含栏内正文，所以相同结构中的段落、列表、Panel、表格等可以独立 Diff。
每个块的 `layoutPath` 防止不同栏中相同文本被 LCS 错配。结构边界只负责显示和
Storage 重建，不可单独选择。

当前明确限制：

- 只改栏宽会改变结构签名；
- 增删栏或调整栏顺序也会改变结构签名；
- 上述情况会回退为完整 Layout removed/added，并共享一次完整 Layout 的
  Keep/Restore；
- 当前没有栏级结构 staging，不能只恢复一栏的宽度、位置或存在状态。

这与“普通相容布局中的栏内内容细粒度 Diff”是两个不同问题。后续若要支持栏级
结构恢复，必须先定义稳定 Cell identity、移动与增删的匹配规则，并确保重建的
Layout Storage 标签仍合法，不能只在 UI 上拆红绿框。

## 9. Keep/Restore、Preview 与写回

### 9.1 显示配对

连续变化可能是：

```text
removed A, removed B, added A', added B'
```

`buildChangeRunRows` 依次为 removed 块查找尚未使用、且 `nodeType` 与 tag
相同的 added 块。成功配对的块共享 choice；无法可靠配对的块保持独立。

### 9.2 Preview

`buildRecoveryPreviewHtml` 使用每个 Diff block 已经生成的安全显示 HTML，按 choice
各输出一次。它不会再次渲染完整重建 Storage，因此不会把 Decision 的 ADF 节点和
fallback 重复显示。

同时，`buildRecoveryStorageHtml` 独立生成用于写回的 Storage。预览 HTML 与
Storage HTML 不能互相替代。

### 9.3 写回

`writeRecoveredPage`：

1. 接收 `pageId`、`bodyValue`、`expectedVersionNumber`；
2. 用 `asUser()` 重读 live current page；
3. 若版本号已变化则拒绝；
4. 使用 live title、parent、space 和下一版本号执行 PUT；
5. 返回新版本号，前端刷新 timeline。

这个并发检查不能删除，否则用户可能覆盖 Preview 之后出现的新编辑。

## 10. 测试与构建

前端 `package.json` 当前没有 `test` script，使用已安装的 React Scripts：

```powershell
cd static/hello-world
node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand
```

生产构建：

```powershell
cd static/hello-world
npm.cmd run build
```

2026-07-14 实际验证结果：

```text
PASS src/utils.test.js
PASS src/recoveryStorage.test.js

Test Suites: 2 passed, 2 total
Tests:       106 passed, 106 total
Production build: compiled successfully
```

已知非阻断输出：

- Jest 报告进程一秒后仍存在 open handle；
- Create React App/Babel 报告未显式声明的 private-property plugin；
- build 报告 Browserslist 数据较旧和 Node `fs.F_OK` deprecation。

这些警告目前不会使测试或 build 失败，但依赖升级时应单独处理，不能误写为本次
renderer/Diff 的功能错误。

## 11. 维护约束

1. 不要在页面级结果中引入新的 `modified/changed` 类型，除非同步修改 UI、统计、
   recovery 和全部测试。
2. 不要把 renderer HTML 当作可写回 Storage。
3. 不要用可见文字推测 Panel 类型；必须使用 Storage metadata。
4. 不要把 Mention display name 写回代替 account ID。
5. 不要丢弃 unsupported raw Storage，即使视觉 fallback 不完整。
6. 普通列表保持 whole-list Diff；Task/Decision item 恢复必须经过组重建。
7. 表格匹配必须继续使用逻辑坐标，并验证 span/几何；不可靠时必须整表回退。
8. table cell-level 只改变显示粒度，不能暗中变成 cell-level recovery。
9. `layoutPath` 和结构边界不能从相容布局的提取/重建流程中删除。
10. Layout 结构不相容时，在没有完整栏级恢复设计前继续保守回退。
11. 保留写回的 `expectedVersionNumber` 校验、2 MB 限制和 `asUser()`。
12. 修改 renderer、Diff 或 recovery 后运行 106 项 focused tests 和 production build；
    测试数变化时同时更新本说明和 README。

## 12. 安装与部署提示

根目录和 `static/hello-world` 是两个 npm 项目。只有新 clone、`node_modules` 缺失，
或对应 dependency 文件变化时才需要重新安装：

```powershell
# repo root
npm.cmd install --legacy-peer-deps

cd static/hello-world
npm.cmd install --legacy-peer-deps
```

Forge deploy 前先在 `static/hello-world` build，再回到 Forge app 根目录。根据项目
规范，运行 Forge 命令前先执行 `pwd` 确认目录，并先运行 `forge lint`。代码改动
不要求 reinstall；只有 scope/permission 变化才需要 deploy 后 upgrade install。
