export const DEFAULT_GUIDE_LANGUAGE = 'en';

export const GUIDE_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
];

export function guideImageUrl(filename) {
  return `${process.env.PUBLIC_URL || ''}/user-guide/${filename}`;
}

export const USER_GUIDE_COPY = {
  en: {
    title: 'Dynamic History User Guide',
    intro:
      'Review earlier versions of a Confluence page, compare them with the current version, and safely restore only the content you need.',
    closeLabel: 'Close user guide',
    imageBadge: 'Example using anonymized mock data',
    sections: [
      {
        id: 'open',
        title: '1. Open Dynamic History',
        blocks: [
          {
            type: 'ordered-list',
            items: [
              'Open the Confluence page you want to review.',
              "Open the page's content actions and select Dynamic History.",
              'Wait for the version history to load.',
            ],
          },
          {
            type: 'paragraph',
            text: 'The latest version is marked Current. Dynamic History initially displays the current version, so select an earlier version from the timeline to see meaningful differences.',
          },
          {
            type: 'image',
            filename: '01-overview-current.png',
            alt: 'Dynamic History overview with the anonymized version timeline and current-page preview',
            caption: 'The timeline uses anonymized sample users and a mock page.',
          },
        ],
      },
      {
        id: 'select',
        title: '2. Select a version',
        blocks: [
          {
            type: 'paragraph',
            text: 'Use the timeline on the left to choose the historical version you want to compare.',
          },
          { type: 'paragraph', text: 'Each version card can show:' },
          {
            type: 'list',
            items: [
              'the version number;',
              'the author and edit time;',
              'Current or Minor edit status;',
              'the Confluence version message; and',
              'a saved Dynamic History comment.',
            ],
          },
          {
            type: 'paragraph',
            text: 'Use the arrow beside the timeline to hide or show the version history when you need more comparison space.',
          },
        ],
      },
      {
        id: 'views',
        title: '3. Choose a comparison view',
        blocks: [
          { type: 'paragraph', text: 'Use the view switcher at the top of the workspace:' },
          {
            type: 'list',
            items: [
              'Inline shows changes in the flow of the page. Select a changed block or changed table cell to reveal its recovery actions.',
              'Side-by-side places Historical content on the left and Current content on the right. Use the arrows between the panes to choose which side should appear in the reconstructed page.',
            ],
          },
          {
            type: 'paragraph',
            text: 'You can switch views at any time. Your choices are shared between both views for the same pair of versions.',
          },
          {
            type: 'image',
            filename: '02-inline-comparison.png',
            alt: 'Inline comparison between anonymized sample versions v5 and v6',
            caption: 'Inline view keeps changes in the natural reading flow of the page.',
          },
        ],
      },
      {
        id: 'differences',
        title: '4. Understand the differences',
        blocks: [
          {
            type: 'list',
            items: [
              'Green identifies content added in the current version.',
              'Red identifies historical content that was removed or replaced in the current version.',
              'Yellow identifies formatting-only changes, such as bold, italic, link, or text-style changes.',
              'Neutral gray identifies a modified block whose historical and current versions are both available for review.',
            ],
          },
          {
            type: 'paragraph',
            text: 'The summary above the comparison reports additions, removals, modifications, and total changes. For very large or complex content, Dynamic History may show a safer limited comparison and display a warning.',
          },
        ],
      },
      {
        id: 'choose',
        title: '5. Choose what to keep',
        blocks: [
          {
            type: 'paragraph',
            text: 'For each changed item, choose one of the available actions:',
          },
          {
            type: 'list',
            items: [
              'Keep current change keeps the content from the current page.',
              'Restore old content uses the content from the selected historical version.',
              'Table-level changes may use Keep current table and Restore old table.',
              'Undo clears the decision for that item.',
            ],
          },
          {
            type: 'paragraph',
            text: 'In Side-by-side view, the selected pane receives a blue frame and the label Selected for draft.',
          },
          {
            type: 'paragraph',
            text: 'The toolbar shows how many changes have been decided. You can also use:',
          },
          {
            type: 'list',
            items: [
              'Restore Historical for All to select the historical version for every recoverable change; or',
              'Reset choices to clear all decisions.',
            ],
          },
          {
            type: 'paragraph',
            text: 'Important: an undecided change defaults to the current version. Historical content is restored only when you explicitly select it.',
          },
          {
            type: 'image',
            filename: '03-inline-choice-actions.png',
            alt: 'Inline recovery actions for keeping current content or restoring historical content',
            caption: 'Select a changed block to reveal its recovery actions.',
          },
          {
            type: 'image',
            filename: '05-side-by-side-selection.png',
            alt: 'Side-by-side comparison with a historical pane selected for the reconstructed page',
            caption: 'A blue frame identifies the pane selected for the reconstructed page.',
          },
        ],
      },
      {
        id: 'review',
        title: '6. Review the reconstructed page',
        blocks: [
          {
            type: 'ordered-list',
            items: [
              'Select Review & Publish.',
              'Inspect the complete reconstructed page in Review Draft.',
              'Select Version Difference Notes if you want to compare the current page with the reconstructed result. In this view, red is removed from Current and green is added by Draft.',
              'Select Back to changes if anything needs adjustment.',
            ],
          },
          {
            type: 'paragraph',
            text: 'Opening Review Draft is read-only. It does not update the Confluence page and does not create a separate unpublished page.',
          },
          {
            type: 'image',
            filename: '06-review-draft.png',
            alt: 'Review Draft modal showing the complete reconstructed page',
            caption: 'Review the complete result before using the final publish action.',
          },
          {
            type: 'image',
            filename: '07-version-difference-notes.png',
            alt: 'Version Difference Notes comparing the current page with the reconstructed draft',
            caption: 'Version Difference Notes explains exactly what the reconstructed page changes.',
          },
        ],
      },
      {
        id: 'publish',
        title: '7. Publish safely',
        blocks: [
          {
            type: 'paragraph',
            text: 'When the preview is correct, select Publish to Current Page.',
          },
          {
            type: 'paragraph',
            text: 'Dynamic History writes the reconstructed content as a new version of the same Confluence page. It does not overwrite the page silently: the update happens only after you press the final publish button.',
          },
          {
            type: 'paragraph',
            text: 'If someone edits the page after your preview was prepared, Dynamic History may reject the publish to protect the newer work. Close the preview, reload the latest history, review your choices again, and then publish.',
          },
          {
            type: 'paragraph',
            text: 'You need permission to edit the Confluence page.',
          },
        ],
      },
      {
        id: 'comments',
        title: '8. Add a version comment',
        blocks: [
          {
            type: 'paragraph',
            text: 'Select Add comment on a timeline card to record why a version matters.',
          },
          { type: 'paragraph', text: 'In the comment window you can:' },
          {
            type: 'list',
            items: [
              'choose a version;',
              'write up to 2,000 characters;',
              'attach the additions, removals, and modifications summary; and',
              'preview the comment before saving.',
            ],
          },
          {
            type: 'paragraph',
            text: 'Each page version has one Dynamic History comment. Select Edit comment to replace the existing comment for that version.',
          },
          {
            type: 'image',
            filename: '08-version-comment.png',
            alt: 'Anonymized Add Version Comment window with a sample comment and diff summary',
            caption: 'The example comment, users, version details, and page content are mock data.',
          },
        ],
      },
      {
        id: 'troubleshooting',
        title: 'Tips and troubleshooting',
        blocks: [
          {
            type: 'list',
            items: [
              'No differences to display: confirm that you selected an older version rather than the version marked Current.',
              'Limited comparison warning: review the displayed current content and use extra care before publishing; some detailed highlighting may be unavailable.',
              'Publish failed: confirm that you still have edit permission and that the page has not received a newer edit. Reload the history before trying again.',
              'Content cannot be rendered safely: do not publish from that comparison. Return to the page and ask the app administrator or project team for help.',
              'Use Close to leave Dynamic History without publishing.',
            ],
          },
        ],
      },
    ],
  },
  zh: {
    title: 'Dynamic History 用户指南',
    intro: '查看 Confluence 页面的历史版本，将其与当前版本比较，并只恢复真正需要的内容。',
    closeLabel: '关闭用户指南',
    imageBadge: '使用脱敏 mock 数据的示例',
    sections: [
      {
        id: 'open',
        title: '1. 打开 Dynamic History',
        blocks: [
          {
            type: 'ordered-list',
            items: [
              '打开需要查看的 Confluence 页面。',
              '打开页面的内容操作菜单，选择 Dynamic History。',
              '等待版本历史加载完成。',
            ],
          },
          {
            type: 'paragraph',
            text: '最新版本带有 Current 标记。Dynamic History 初始会显示当前版本，因此需要从时间线中选择一个更早的版本，才能查看有意义的差异。',
          },
          {
            type: 'image',
            filename: '01-overview-current.png',
            alt: '包含脱敏版本时间线和当前页面预览的 Dynamic History 总览',
            caption: '时间线仅使用脱敏的示例用户和 mock 页面。',
          },
        ],
      },
      {
        id: 'select',
        title: '2. 选择历史版本',
        blocks: [
          {
            type: 'paragraph',
            text: '使用左侧时间线选择需要与当前页面比较的历史版本。',
          },
          { type: 'paragraph', text: '每张版本卡片可能显示：' },
          {
            type: 'list',
            items: [
              '版本号；',
              '编辑者和编辑时间；',
              'Current 或 Minor edit 状态；',
              'Confluence 版本说明；',
              '已保存的 Dynamic History 评论。',
            ],
          },
          {
            type: 'paragraph',
            text: '需要更大的比较区域时，可以使用时间线旁的箭头隐藏或重新显示版本历史。',
          },
        ],
      },
      {
        id: 'views',
        title: '3. 选择比较视图',
        blocks: [
          { type: 'paragraph', text: '使用工作区顶部的视图切换按钮：' },
          {
            type: 'list',
            items: [
              'Inline 按页面原有顺序显示差异。选择发生变化的内容块或表格单元格，即可显示恢复操作。',
              'Side-by-side 在左侧显示 Historical 历史内容，在右侧显示 Current 当前内容。使用两栏之间的箭头，选择重建页面时采用哪一侧。',
            ],
          },
          {
            type: 'paragraph',
            text: '你可以随时切换视图。对于同一组版本，两个视图会共享已经做出的选择。',
          },
          {
            type: 'image',
            filename: '02-inline-comparison.png',
            alt: '脱敏示例版本 v5 与 v6 的 Inline 比较',
            caption: 'Inline 视图按照页面原有阅读顺序展示变化。',
          },
        ],
      },
      {
        id: 'differences',
        title: '4. 理解差异标记',
        blocks: [
          {
            type: 'list',
            items: [
              '绿色表示当前版本新增的内容。',
              '红色表示历史版本中存在、但在当前版本中被删除或替换的内容。',
              '黄色表示仅格式发生变化，例如粗体、斜体、链接或文字样式变化。',
              '中性灰色表示内容块已修改，历史版本和当前版本都可供检查。',
            ],
          },
          {
            type: 'paragraph',
            text: '比较区域上方会显示新增、删除、修改和总变更数量。对于特别大或结构复杂的内容，Dynamic History 可能使用更安全的受限比较方式，并显示提示信息。',
          },
        ],
      },
      {
        id: 'choose',
        title: '5. 选择需要保留的内容',
        blocks: [
          { type: 'paragraph', text: '针对每一项变化选择相应操作：' },
          {
            type: 'list',
            items: [
              'Keep current change：保留当前页面中的内容。',
              'Restore old content：使用所选历史版本中的内容。',
              '表格整体变化可能显示 Keep current table 和 Restore old table。',
              'Undo：清除该项选择。',
            ],
          },
          {
            type: 'paragraph',
            text: '在 Side-by-side 视图中，被选中的一栏会出现蓝色边框和 Selected for draft 标记。',
          },
          {
            type: 'paragraph',
            text: '顶部工具栏会显示已经决定的变更数量，还可以使用：',
          },
          {
            type: 'list',
            items: [
              'Restore Historical for All：为所有可恢复变化选择历史版本；',
              'Reset choices：清除全部选择。',
            ],
          },
          {
            type: 'paragraph',
            text: '重要：尚未决定的变化默认使用当前版本。只有明确选择历史内容后，旧内容才会被恢复。',
          },
          {
            type: 'image',
            filename: '03-inline-choice-actions.png',
            alt: '用于保留当前内容或恢复历史内容的 Inline 操作按钮',
            caption: '选择发生变化的内容块，即可显示恢复操作。',
          },
          {
            type: 'image',
            filename: '05-side-by-side-selection.png',
            alt: '已选择历史内容栏的 Side-by-side 比较',
            caption: '蓝色边框表示重建页面将采用的内容栏。',
          },
        ],
      },
      {
        id: 'review',
        title: '6. 检查重建后的页面',
        blocks: [
          {
            type: 'ordered-list',
            items: [
              '选择 Review & Publish。',
              '在 Review Draft 中检查完整的重建结果。',
              '如需比较当前页面与重建结果，选择 Version Difference Notes。在这个视图中，红色表示从 Current 中删除的内容，绿色表示 Draft 新增的内容。',
              '如需调整，选择 Back to changes 返回比较页面。',
            ],
          },
          {
            type: 'paragraph',
            text: '打开 Review Draft 只是预览，不会更新 Confluence 页面，也不会创建一个独立的未发布页面。',
          },
          {
            type: 'image',
            filename: '06-review-draft.png',
            alt: '显示完整重建页面的 Review Draft 弹窗',
            caption: '执行最终发布操作前，请检查完整的重建结果。',
          },
          {
            type: 'image',
            filename: '07-version-difference-notes.png',
            alt: '比较当前页面和重建结果的 Version Difference Notes',
            caption: 'Version Difference Notes 会明确说明重建页面带来的变化。',
          },
        ],
      },
      {
        id: 'publish',
        title: '7. 安全发布',
        blocks: [
          {
            type: 'paragraph',
            text: '确认预览正确后，选择 Publish to Current Page。',
          },
          {
            type: 'paragraph',
            text: 'Dynamic History 会将重建内容写入同一个 Confluence 页面，并生成一个新版本。只有点击最终发布按钮后，页面才会更新。',
          },
          {
            type: 'paragraph',
            text: '如果在预览生成后其他人编辑了页面，Dynamic History 可能会拒绝发布，以保护更新的内容。此时请关闭预览，重新加载最新版本历史，重新检查选择后再发布。',
          },
          {
            type: 'paragraph',
            text: '你需要拥有该 Confluence 页面的编辑权限。',
          },
        ],
      },
      {
        id: 'comments',
        title: '8. 添加版本评论',
        blocks: [
          {
            type: 'paragraph',
            text: '选择时间线卡片上的 Add comment，记录该版本的重要背景或用途。',
          },
          { type: 'paragraph', text: '在评论窗口中可以：' },
          {
            type: 'list',
            items: [
              '选择版本；',
              '输入最多 2,000 个字符；',
              '附加新增、删除和修改数量摘要；',
              '保存前预览评论。',
            ],
          },
          {
            type: 'paragraph',
            text: '每个页面版本只保存一条 Dynamic History 评论。选择 Edit comment 可以替换该版本已有的评论。',
          },
          {
            type: 'image',
            filename: '08-version-comment.png',
            alt: '包含示例评论和差异摘要的脱敏版本评论窗口',
            caption: '示例评论、用户、版本信息和页面内容均为 mock 数据。',
          },
        ],
      },
      {
        id: 'troubleshooting',
        title: '使用技巧与问题处理',
        blocks: [
          {
            type: 'list',
            items: [
              'No differences to display：确认选择的是较早的历史版本，而不是带有 Current 标记的版本。',
              '出现受限比较提示：发布前仔细检查显示的当前内容；部分详细高亮可能不可用。',
              '发布失败：确认仍有页面编辑权限，并检查页面是否已产生更新版本。重新加载历史后再尝试。',
              '内容无法安全渲染：不要从该比较结果发布。返回页面并联系应用管理员或项目团队。',
              '使用 Close 可以退出 Dynamic History，不会发布任何内容。',
            ],
          },
        ],
      },
    ],
  },
};
