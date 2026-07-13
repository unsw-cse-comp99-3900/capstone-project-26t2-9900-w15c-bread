# Sprint 2 Diff 实现与交接说明

<<<<<<< Updated upstream
本文档说明 Sprint 2 当前版本的富文本 Diff 实现、布局修复、提及（Mention）解析、恢复选择和 Draft 预览衔接方式，供后续开发、测试和维护使用。

本次功能代码主要位于前端 Diff 模块。后端 Draft API、Confluence 写回、发布流程、`manifest.yml` 权限和 Forge 部署流程没有修改。
=======
本文档说明 Sprint 2 当前版本的富文本 Diff 实现、布局修复、提及（Mention）解析、恢复选择、Draft 创建和当前页面写回方式，供后续开发、测试和维护使用。

当前版本已吸收本地 `feature/write-back` 分支的直接写回功能，同时保留现有细粒度 Diff、布局和 Draft 创建功能。`manifest.yml` 权限和 Forge 部署流程没有修改。
>>>>>>> Stashed changes

## 1. 当前实现目标

当前实现将 Confluence Storage HTML 转换为语义块进行比较，并遵循以下原则：

1. Diff 结果只使用 `same`、`removed`、`added` 三种类型。
2. “修改”由旧块 `removed` 和新块 `added` 表示，不新增 `modified` 或 `changed` 类型。
3. 用户应按最小可安全恢复的语义块进行 Keep/Restore，而不是把整页或整个布局作为一次选择。
4. 布局结构相容时，保留 Layout/Section/Cell 包装结构，并对栏内段落、列表、表格等内容分别 Diff。
5. 布局结构不相容时，回退为整个 Layout 的旧版本和新版本，避免恢复后生成错误 Storage 格式。
6. 显示预览 HTML 与用于创建 Draft 的 Storage HTML 分离：预览只负责安全渲染，Storage 重建必须保留 Confluence 原始标签。
7. 原内容的颜色、高亮、Panel 背景、日期样式、Status 颜色和表格单元格背景继续保留。
8. Diff 使用红色/绿色外边框和 `-/+` gutter，不使用整行红绿背景覆盖原样式。

## 2. 修改文件与主要职责

### `static/hello-world/src/utils.js`

负责 Storage HTML 预处理、语义块提取、稳定签名、LCS 对齐、表格单元格标记、布局结构保护和 Mention ID 提取。

主要函数如下：

| 函数 | 用途 | 重要参数或变量 |
| --- | --- | --- |
| `prepareConfluenceHtml` | 将 Storage HTML 转换为可分析和安全显示的 HTML。 | `html` 为原始 Storage；`options` 可提供用户映射等渲染信息。 |
| `canonicalDomSignature` | 生成 DOM 语义签名，比较文本、结构、格式和持久化属性。 | `node` 为目标 DOM；会忽略属性顺序、仅显示 class 等无意义差异。 |
| `stableHtmlSignature` | 对无法细分的内容生成稳定签名。 | 用于 unsupported/raw-preserved 内容。 |
| `imageRawSignature` | 提取图片的附件、尺寸、布局、边框、caption 等持久化信息。 | 避免只比较图片可见占位内容。 |
| `getComparableNodeType` | 判断节点应按 paragraph、heading、table、panel 等哪一种类型比较。 | 返回值参与配对和 LCS key 生成。 |
| `extractBlockMeta` | 从节点提取 `nodeType`、tag、Storage HTML、渲染 HTML 和签名信息。 | 结果是后续 Diff block 的基础数据。 |
| `extractComparableBlocksFromPreparedNode` | 递归提取普通语义块。 | `context` 中保存布局路径，防止不同栏中的相同内容错误匹配。 |
| `extractDiffBlocks` | 页面级语义块提取入口。 | 在布局相容时调用布局专用提取；否则按普通规则或整体布局回退。 |
| `makeSameBlock` | 创建 `same` block。 | 保留可显示 HTML 和可恢复 Storage。 |
| `makeRemovedBlock` | 创建旧版本 `removed` block。 | 用于删除或修改前内容。 |
| `makeAddedBlock` | 创建新版本 `added` block。 | 用于新增或修改后内容。 |
| `buildRichTextDiffHtml` | Diff 主入口：提取两侧 blocks、执行 LCS、输出三类结果。 | `oldHtml`、`currentHtml` 为两个版本；`options` 可携带用户信息。 |
| `buildTableReplacementBlocks` | 建立旧表格和新表格的替换块。 | 仅在相邻表格可作为一组变化时使用。 |
| `decorateTableReplacementBlocks` | 对结构相容表格的变化单元格添加红/绿 inset border。 | 不改变原单元格背景和 Storage。 |
| `normaliseLayoutType` | 统一 Layout 类型别名。 | 支持 camelCase、连字符和下划线写法。 |
| `layoutTypeColumnWeights` | 返回标准布局的栏宽权重。 | 支持 `1:1`、`1:2`、`2:1`、`1:1:1`、`1:2:1` 等比例。 |
| `normaliseGridTemplateColumns` | 只接受安全的 CSS Grid 列定义。 | 防止任意 style 注入预览。 |
| `expandConfluenceLayouts` | 将 Layout 的每个 Cell 独立转换为渲染结构。 | 避免跨 Cell 的正则/解析吞掉后续栏内容。 |
| `layoutStructureSignature` | 只比较 Layout、Section、Cell 的结构和持久化属性，不比较栏内正文。 | 用于判断能否进行布局内细粒度 Diff。 |
| `createLayoutBoundaryBlock` | 创建不可选择的布局开始/结束边界块。 | 保存原始 Storage 开闭标签，并保存安全渲染 wrapper。 |
| `extractLayoutDiffBlocks` | 在相容 Layout 中插入结构边界，并逐 Cell 提取正文语义块。 | `layoutPath` 参与 block key，保证栏之间不会串配。 |
| `extractMentionAccountIds` | 从 Storage 和 ADF Mention 中提取账号 ID。 | 支持 `ri:account-id`、ADF `id`/`accountId`。 |
<<<<<<< Updated upstream
=======
| `getStorageNodeOuterHtml` | 按 Confluence Storage 规则序列化 DOM。 | 保持 Emoji、Mention、Date 等空元素为自闭合标签。 |
| `normaliseStorageHtmlForParsing` | 在送入浏览器 HTML 解析器前临时展开 Confluence 自闭合空元素，并保护 CDATA。 | 防止 `<ri:user />` 吞入后续整页内容，也防止 HTML 代码正文被解析为空；不改变实际写回 Storage。 |
| `normaliseCodeMacroStorageForWriteBack` | 将预览可读但写回无效的实体/注释式代码正文转换成标准 CDATA。 | 合法 CDATA 保持逐字不变，防止 `Write to Current Page` 后代码块变空。 |
>>>>>>> Stashed changes

布局处理中的关键变量：

- `splitCompatibleLayouts`：旧、新页面的布局骨架完全相容时为 `true`，允许栏内细粒度 Diff。
- `layoutPath`：记录 block 所在 Layout/Section/Cell 路径，阻止 LCS 将不同栏的相同文本互相匹配。
- `storageHtml`：恢复和创建 Draft 时使用的原始 Confluence Storage 片段。
- `renderedHtml`：仅用于界面预览的安全 HTML。
- `structuralBoundary`：标记 Layout/Section/Cell 开始或结束的不可选择 block。

### `static/hello-world/src/components/ComparisonPanel.js`

负责加载 Mention 用户信息、组织 Diff 行、生成 Keep/Restore 选择，以及分别构建显示预览和 Draft Storage。

主要函数如下：

| 函数 | 用途 | 重要参数或变量 |
| --- | --- | --- |
| `canShareChoice` | 判断一个 removed block 和 added block 能否共享一次 Keep/Restore。 | 要求语义类型和实际 HTML tag 相容。 |
| `createChangeDisplayRow` | 创建单个变化行或一对变化行。 | `choiceKey` 是用户选择的稳定键。 |
| `buildChangeRunRows` | 扫描连续变化区间，并按顺序配对相容的旧、新 blocks。 | 未匹配块继续保持独立选择。 |
| `nestStructuralDisplayRows` | 根据布局边界块重建嵌套的 Layout/Section/Cell 显示树。 | 边界本身不产生 Keep/Restore。 |
| `collectSelectableDisplayRows` | 从嵌套树递归收集真正可选择的变化行。 | 避免结构 wrapper 被当作内容选择。 |
| `getLayoutWrapperProps` | 从安全渲染 wrapper 中读取布局类型、宽度和 grid 属性。 | 只透传允许的 `data-*` 和已校验样式。 |
| `DiffDisplayRows` | 递归渲染布局结构及其中的 Diff 行。 | 使 2/3 栏结构在预览中保持嵌套关系。 |
| `buildDiffDisplayRows` | 创建最终显示树并准备可选择行。 | 输入为底层 `same/removed/added` blocks。 |
| `getBlockRenderedPreviewHtml` | 获取单个 block 的预览 HTML。 | 不使用 Storage 标签直接渲染。 |
<<<<<<< Updated upstream
| `buildRenderedDraftPreviewHtml` | 按用户选择生成 Draft 模态框中的安全预览。 | 只用于视觉预览。 |
| `buildDraftPreviewHtml` | 按用户选择重建 Confluence Storage HTML。 | 输出作为创建 Draft 的 `storageHtml`。 |

Mention 加载流程会动态调用 `requestConfluence`，通过 `/wiki/rest/api/user?accountId=...` 获取 `displayName`。账号会去重并限制最多 100 个；接口失败时显示安全 fallback，但原 Mention Storage 不会被改写或丢失。

=======
| `prepareConfluenceHtml` 恢复预览调用 | 从最终重建的 Storage 生成 Draft 模态框预览。 | 确保预览结构与实际 Draft/写回内容一致。 |
| `handleConfirmWriteBack` | 将同一份 Storage 发送给 `writeRecoveredPage`。 | 同时提交预览时的当前版本号。 |

Mention 加载流程会动态调用 `requestConfluence`，通过 `/wiki/rest/api/user?accountId=...` 获取 `displayName`。账号会去重并限制最多 100 个；接口失败时显示安全 fallback，但原 Mention Storage 不会被改写或丢失。

### `static/hello-world/src/recoveryStorage.js`

负责根据用户选择重建可写回的 Storage HTML。它默认保留当前版本，只有明确选择 `old` 才恢复历史块；同时会跨中断合并 Task/Decision 单项、保留列表 wrapper 属性、去重 raw Storage group、保留布局边界，并在原始 Storage 缺失或仅剩 unsupported 占位内容时禁止写回。

### `src/index.js`

后端仍保留未被当前 UI 调用的 `createDraft` 兼容 resolver，并新增 `writeRecoveredPage` resolver。后者使用 `api.asUser()` 重新读取当前页面，校验预览时版本号，限制请求体不超过 2 MB，然后使用 Confluence v2 Page API 写入新版本。若期间页面已被其他人更新，请求会被拒绝，避免覆盖新内容。

>>>>>>> Stashed changes
### `static/hello-world/src/styles.css`

负责 Diff 边框、表格 cell 标记和 Layout Grid：

- removed 为红色外边框，added 为绿色外边框；
- diff 行背景透明，保留原内容背景；
- 相容表格的变化 cell 使用红/绿 inset border；
- 标准布局使用 CSS Grid 显示对应栏宽；
- 自定义三栏根据 `data-width` 生成比例，例如 `25:50:25`；
- 小于等于 `760px` 时降为单栏，保证移动端可阅读。

<<<<<<< Updated upstream
### `static/hello-world/src/utils.test.js`

当前 focused tests 共 66 个，覆盖基础分类、富文本格式、布局、Mention、列表、引用、表格、Panel、Decision、日期、图片、Storage 重建和 Diff CSS。
=======
### `static/hello-world/src/utils.test.js` 与 `recoveryStorage.test.js`

当前 focused tests 共 87 个，覆盖基础分类、富文本格式、布局、Mention、列表、引用、表格、Panel、Decision、日期、图片、Storage 重建、Task 混合恢复、ADF Task、raw macro 分组、写回后的内部 ID 规范化、自闭合元素解析保护、代码 CDATA 规范化与无损写回和 Diff CSS。
>>>>>>> Stashed changes

## 3. Diff 整体流程

```text
旧 Storage HTML                         新 Storage HTML
       |                                      |
       +---- 提取 Mention account IDs --------+
       |              |                       |
       |       请求 displayName               |
       v                                      v
prepareConfluenceHtml                prepareConfluenceHtml
       |                                      |
       +------ layoutStructureSignature ------+
                       |
          +------------+-------------+
          |                          |
     布局结构相容                 布局结构不相容
          |                          |
 插入结构边界并逐 Cell 提取       整个 Layout 安全回退
          |                          |
          +---------- semantic blocks --------+
                             |
                            LCS
                             |
                  same / removed / added
                             |
               表格 cell diff decoration
                             |
            嵌套 Layout 显示 + Keep/Restore
                             |
          +------------------+------------------+
          |                                     |
  rendered preview HTML                 reconstructed Storage HTML
```

### 3.1 语义块提取

页面不会作为一个完整字符串直接比较。当前可提取的顶层或独立语义块包括：

```text
paragraph, heading, list, task_item, blockquote, table,
panel, decision, image, code_block, expand, whiteboard_card,
unsupported，以及 layout structural boundary
```

普通容器可以透明展开。Confluence Layout 不能简单丢弃 wrapper，而是通过开始/结束边界保留结构，再提取每个 Cell 内的语义内容。

### 3.2 语义签名

`canonicalDomSignature` 比较完整 DOM 语义，而不是只比较 `textContent`。签名保留：

- DOM 标签和嵌套结构；
- bold、italic、link、颜色和高亮；
- 日期、Status、Mention、Emoji 等 inline 语义；
- 图片、表格和 renderer 生成的持久化 `data-dh-*` 信息；
- block 所在布局路径。

签名忽略属性顺序、CSS declaration 顺序、仅显示 class、普通序列化空白，以及 `<b>/<strong>`、`<i>/<em>` 等等价表示。

### 3.3 LCS 对齐与分类

| 情况 | 输出 |
| --- | --- |
| 旧、新 block 的语义 key 相同 | `same` |
| 旧 block 无法对齐 | `removed` |
| 新 block 无法对齐 | `added` |
| 同一位置内容改变 | 旧 `removed` + 新 `added` |

`summary.modifiedBlocks` 仅为兼容旧数据结构而保留，当前主流程不输出 `modified` block，因此应为 `0`。

## 4. 当前内容类型及处理方式

### 4.1 段落与标题

段落以完整 `<p>` 为单位，标题以完整 H1-H6 为单位。文本、格式、颜色、高亮、链接或 inline 语义变化会输出旧块和新块，不做词级或字符级高亮。不同 heading level 不强制配成同一选择。

### 4.2 换行与缩进

连续一个或多个 `<br>` 视为等价可见换行；从无换行变为有换行仍产生 Diff。段落缩进信息参与签名，原 Storage 会被保留；预览中的缩进距离由 renderer/CSS 表示，不应用于改写 Storage。

### 4.3 普通列表、Task 与 Decision

普通 `<ol>/<ul>` 以整个列表为单位，只区分完全相同和存在差异。Task 和 Decision 则按 item 独立比较，单个 item 的文本或状态变化不会使整个列表都变化。

### 4.4 Blockquote、Panel、Code 与 Expand

这些内容均以完整 block 为单位比较。Panel 类型和背景、Code 空白与行结构、Expand 标题与内容都参与签名；Diff 外边框不会覆盖其原样式。

### 4.5 Date、Status、Mention、Emoji 与 Smart Content

这些节点作为 containing block 的 inline 语义参与比较：

- Date 会统一 Storage、ADF、date link 和 `<time>` 的日期语义；
- Status 的 label 和颜色参与比较；
- Mention 使用 account ID 比较，并尝试通过 Confluence API 显示 `@displayName`；
- Mention API 失败时保留账号 fallback 和原 Storage；
- Emoji 的语义信息参与 Diff，原 Storage 可完整重建；部分 ADF Emoji 的手工预览仍依赖 renderer，不能据此认定 Storage 丢失；
- Inline Smart Content 的持久化 metadata 变化会使 containing block 变化。

### 4.6 Image

图片独立比较附件 ID、content ID、文件名、src、宽高、alignment、layout、custom width、border、alt、title、rotation 和 caption。图片下方手工输入的普通段落仍是独立 paragraph。

### 4.7 Table

结构相容要求 row 数、有效 column 数、cell 数、`td/th`、有效位置、`rowspan` 和 `colspan` 一致。相容时仍输出完整旧表和新表，但只给变化 cell 加红/绿 inset border；结构不相容时回退为整表替换，不强行配对 cell。

多个表格不会合并成一个选择。例如同一布局 Cell 内依次存在表格 1、2、3，只有表格 2 改动时，结果为：

```text
表格 1: same
表格 2 旧版: removed
表格 2 新版: added
表格 3: same
```

因此用户只需要选择是否保留/恢复表格 2。

### 4.8 Confluence Layout

当前支持以下标准布局：

| 布局 | 栏宽 |
| --- | --- |
| 单栏 | `1` |
| 两栏等宽 | `1:1` |
| 左窄右宽 | `1:2` |
| 左宽右窄 | `2:1` |
| 三栏等宽 | `1:1:1` |
| 左右侧栏 + 中间主栏 | `1:2:1` |
| 自定义三栏 | 按安全的 `data-width`，例如 `25:50:25` |

Layout type 的语义优先于可能过期的 `data-width`。布局骨架相容时，Layout/Section/Cell 只作为不可选择的结构边界，栏内每个语义块独立 Diff。布局类型、栏数、Cell 顺序或宽度结构改变时，整体 Layout 回退为 removed/added，以保证恢复后的标签嵌套和栏宽不会损坏。

### 4.9 Whiteboard、Block Smart Link 与 Unsupported

Whiteboard/Smart Link card 以完整 card 比较并保留目标 metadata。Unsupported macro 或 extension 使用原始 Storage 稳定签名比较；预览只显示安全 fallback，但恢复时继续使用原 Storage，不渲染或泄漏内部实现字段。

## 5. Keep/Restore 与 Storage 重建

连续变化区间可能为：

```text
removed A, removed B, added A', added B'
```

显示层按旧 block 顺序，为每个 removed block 寻找第一个尚未使用且类型/tag 相容的 added block。成功配对后共享一次 Keep/Restore；多余、类型不相容或被 `same` 分隔的 block 维持独立选择。

布局结构边界永远不可选择。它们只负责在最终 Storage 中重新打开和关闭 Layout/Section/Cell，因此用户选择栏内某个表格或段落时，不会丢失外层分栏结构。

<<<<<<< Updated upstream
Draft 模态框使用 `buildRenderedDraftPreviewHtml` 展示安全渲染结果；实际创建 Draft 时使用 `buildDraftPreviewHtml` 产生的 `storageHtml`。两者不能混用，否则可能出现预览正常但写回格式损坏，或 Storage 标签被直接展示的问题。
=======
`buildRecoveryStorageHtml` 先产生并验证最终 `storageHtml`，Draft 模态框再使用 `prepareConfluenceHtml` 渲染这份完整 Storage。写回当前页面使用同一份 Storage，因此 Task/raw group/Layout 在预览与实际结果中保持一致。

Draft 预览只保留“Back to changes”和“Write to Current Page”两个操作，不再提供“Create Confluence Draft”。直接写回会携带 `expectedVersionNumber`，后端在更新前重新读取页面；版本不一致时必须刷新并重新比较。
>>>>>>> Stashed changes

## 6. 测试与构建结果

Focused tests：

```powershell
cd static/hello-world
<<<<<<< Updated upstream
npx.cmd react-scripts test src/utils.test.js --watchAll=false --runInBand
=======
npx.cmd react-scripts test src/utils.test.js src/recoveryStorage.test.js --watchAll=false --runInBand
>>>>>>> Stashed changes
```

当前结果：

```text
<<<<<<< Updated upstream
Test Suites: 1 passed
Tests:       66 passed
=======
Test Suites: 2 passed
Tests:       87 passed
>>>>>>> Stashed changes
```

Production build：

```powershell
cd static/hello-world
npm.cmd run build
```

<<<<<<< Updated upstream
当前构建已通过。测试仍会出现 CRA/Babel 警告和 Jest open-handle 提示，但不影响 66 个 focused tests 的通过结果。本轮最新代码没有执行 Forge deploy。
=======
当前构建已通过。测试仍可能出现 CRA/Babel 警告和 Jest open-handle 提示，但不影响 87 个 focused tests 的通过结果。本轮最新代码没有执行 Forge deploy。
>>>>>>> Stashed changes

## 7. 后续维护注意事项

1. 不要新增 `modified`/`changed` Diff 类型。
2. 不要把普通列表改为 item 级 Diff；当前只有 Task 和 Decision 按 item 提取。
3. 不要为了修复布局显示而删除 Layout Storage wrapper；应继续使用结构边界。
4. 修改布局签名时，必须区分“结构属性”和“Cell 内正文”，否则会重新退化为整个布局一次选择。
5. block key 必须保留 `layoutPath`，否则不同栏的相同文本可能被 LCS 错配。
6. 布局结构不相容时必须安全回退，不能强行复用旧 wrapper 包装新栏内容。
7. UI 配对只能影响显示行和 choice key，不能改变底层 `same/removed/added` blocks。
8. 必须继续分离 `renderedHtml` 和 `storageHtml`。
9. 修改表格兼容规则时继续保护 `rowspan`、`colspan` 和有效 cell position。
10. 修改 Mention 预览时不能用 display name 替换原账号 Storage。
<<<<<<< Updated upstream
11. 后续 Diff 修改应运行 66 个 focused tests 和 production build。
=======
11. 后续 Diff 或写回修改应运行 87 个 focused tests 和 production build。
12. 直接写回必须继续传递并校验 `expectedVersionNumber`，不得移除并发保护。
13. Task/Decision 单项恢复必须经过 Storage group 重组，不能直接拼接多个单项 wrapper。
14. Confluence 自闭合空元素只能在 DOMParser 输入中临时展开，写回 Storage 必须继续保留自闭合格式。
15. 代码宏 CDATA 只能在 DOMParser 输入中临时编码保护，写回时必须恢复原始 `<![CDATA[...]]>`，不能写入解析令牌或 HTML 注释。
>>>>>>> Stashed changes

## 8. 本轮未修改的范围

本轮没有修改：

<<<<<<< Updated upstream
- 后端 Draft resolver/API；
- Confluence 写回和发布流程；
=======
- 后端 `createDraft` resolver/API；
- Confluence 发布流程；
>>>>>>> Stashed changes
- `manifest.yml` scopes；
- Forge permissions；
- Forge deployment。

<<<<<<< Updated upstream
需要特别区分：前端的 Draft Storage 重建选择和 Draft 模态框预览已经为细粒度 Layout Diff 做了调整，但最终调用的后端 Draft 创建接口没有改变。本功能实现也不需要新增运行时依赖。
=======
需要特别区分：原有 Draft 创建接口没有改变，但当前前端不再调用它；独立的 `writeRecoveredPage` resolver 使用 `recoveryStorage.js` 产生的 Storage 写回当前页面。本功能实现不需要新增权限或运行时依赖。
>>>>>>> Stashed changes
