# `fix/draft-preview-rebuild` 分支改动说明

本文档说明 `fix/draft-preview-rebuild` 相对 `origin/main` 新增的功能和修复的
问题，方便代码审查、测试和后续合并。

## 比较基线

- Main 基线：`460345c`
- Fix 分支功能提交：`2fa8ccf`
- 改动规模：14 个源码/测试文件，新增 2,193 行，删除 111 行
- `manifest.yml` 和 Forge scopes 没有变化

本文档生成时，Fix 分支包含以下功能提交：

```text
388ae7e Fix draft preview spacing and add version difference notes
3fda3a3 Fix unknown Confluence attachment rendering
482e68f Restore version comment functionality
82ac55b Handle ordered list line-break changes
6124e0d Show list context for blank-line changes
2fa8ccf Fix table recovery controls and panel write-back
```

## 新增功能

### 1. Version Comment

每个历史版本现在可以保存一条评论：

- Timeline 的版本卡片提供 **Add comment** 或 **Edit comment**；
- 每个版本最多保留一条评论，重新评论会覆盖该版本原有评论；
- 评论弹窗支持版本选择、Diff Summary、评论预览和 2,000 字符限制；
- 评论保存在当前 Confluence 页面的 content property 中；
- 后端读取和更新均使用 `api.asUser()`；
- 写入前重新读取 property，降低并发更新覆盖其他评论的风险；
- 旧数据如果同一版本存在多条评论，会保留最后一条并迁移到单评论模型；
- 版本没有 edit summary 时，不再显示 `No edit summary` 占位文字。

后端增加了 `addVersionComment` resolver，并在 `getPageVersions` 的返回值中加入
`commentsByVersion` 和当前用户信息。

### 2. Draft Preview 中的 Version Difference Notes

Draft Preview 弹窗右上角新增 **Version Difference Notes** 按钮。点击后打开独立
弹窗，对比：

```text
Current version -> 当前选择组合生成的 Draft
```

弹窗会显示增加、删除及相关上下文，而不会把测试内容或说明文字写进 Confluence
页面。超大页面无法安全生成详细差异时会明确显示 limited 状态，不会错误显示为
`No changes`。

### 3. 更清晰的差异选择界面

- GitHub 风格展示删除和增加内容；
- 被删除的列表换行会保留原列表作为中性上下文，只高亮实际删除的 blank lines；
- 大型表格的 **Keep current table** 和 **Restore old table** 按钮固定显示在表格上方，
  不需要滚动到表格底部才能操作；
- 普通内容的 Keep/Restore 按钮仍只在选中对应 change 后显示。

## Bug 修复

### 1. Draft Preview 和写回新增多余换行

旧版本内容和 Current 内容配对时，现在会把紧邻的空白段落与可见文本变化组合成
同一个恢复选择。选择旧内容时不会遗留 Current-only 空行；选择 Current 时仍会保留
其准确空行数量。

### 2. 删除列表中间换行导致整段列表被识别为替换

新增 ordered/unordered list 连续性识别：

- 识别删除或增加的列表间 blank lines；
- 保留有序列表的有效编号，包括 `start` 和 `value`；
- 将同一列表因为换行产生的多个 Storage 片段视为一个原子变化；
- 写回时可以准确重建旧版或 Current 版，不再将整个列表显示成红色删除和绿色新增。

### 3. `UNKNOWN_ATTACHMENT` 重复显示

附件解析不再只依赖 `ri:filename`。当 Confluence 返回
`UNKNOWN_ATTACHMENT` 时，会继续使用 ADF media ID、attachment ID 或 file ID 查找
真实附件 URL，从而避免将有效图片渲染成重复的
`Image attachment: UNKNOWN_ATTACHMENT` 文本。

### 4. 表格内容只有 Diff、缺少可发现的写回操作

Cell-level table diff 仍保留整表级原子恢复，新增的表格顶部操作按钮让用户可以明确
选择写回完整旧表或完整 Current 表。这样既展示具体单元格变化，又避免只恢复部分
单元格而破坏 Confluence 表格结构。

### 5. Error Panel 写回后正文与面板分离

写回提交 Storage 前新增 panel 完整性校验。遇到以下历史错误结构时：

```text
空 Error Panel + 紧邻的 “Error Panel: ...” 普通段落
```

会把段落重新放回 panel 的 `ac:rich-text-body`。该修复是保守的：只有 panel 正文
为空且下一段明确以对应 panel 名称开头时才执行，不会把普通相邻段落错误放进 panel。

### 6. 自闭合 Confluence/ADF 节点吞掉后续内容

HTML `DOMParser` 不理解部分 Confluence XML 自闭合标签。解析前现在会给命名空间
节点添加临时标记并展开，恢复 Storage 时再按原来的自闭合形式序列化，避免空 ADF
配置或宏参数把页面后续内容错误变成自己的子节点。

## 主要代码改动

| 文件 | 改动 |
| --- | --- |
| `src/index.js` | 评论 property 读写、`addVersionComment` resolver、附件 ID 映射 |
| `static/hello-world/src/App.js` | 评论状态、保存流程、Diff Summary 数据连接 |
| `static/hello-world/src/components/VersionCommentModal.js` | 新增评论弹窗 |
| `static/hello-world/src/components/VersionCard.js` | Add/Edit comment 和移除空 edit summary |
| `static/hello-world/src/components/ComparisonPanel.js` | Version Difference Notes、变化配对、列表上下文、表格操作按钮 |
| `static/hello-world/src/utils.js` | 附件解析、自闭合 Storage、列表换行识别、Panel 写回规范化 |
| `static/hello-world/src/recoveryStorage.js` | 写回前修复分离的 Panel 正文 |
| `static/hello-world/src/styles.css` | 评论弹窗、Version Notes、Diff、表格操作等样式 |

## 测试与验证

分支新增了 `ComparisonPanel.test.js`、`VersionCard.test.js`，并扩展
`utils.test.js` 和 `recoveryStorage.test.js`，覆盖：

- Version Difference Notes 的比较方向和 limited 状态；
- Draft Preview 空行恢复；
- 有序列表换行的 Diff 和精确写回；
- 大型表格写回按钮的可见性；
- 单版本单评论和空 edit summary；
- `UNKNOWN_ATTACHMENT` 的 ID 回退；
- 自闭合 ADF/宏节点；
- Error Panel 正文重新嵌套及误吸收保护。

最终验证结果：

```text
Test Suites: 4 passed, 4 total
Tests:       131 passed, 131 total
Production build: Compiled successfully
```

## 合并和部署注意事项

- 此分支没有修改 `manifest.yml` 或 scopes，部署后通常不需要执行 Forge install
  upgrade；
- 评论使用 Confluence content property，目标站点用户仍需具备对应页面权限；
- 合并前建议在 Ryan Dev 环境手动测试评论覆盖、Draft Preview、Version Difference
  Notes、列表空行、复杂表格、图片和全部 Panel 类型；
- 本文档描述的是上述 Main 基线与 Fix 提交之间的差异，Main 后续更新后应重新检查
  `git diff origin/main...fix/draft-preview-rebuild`。
