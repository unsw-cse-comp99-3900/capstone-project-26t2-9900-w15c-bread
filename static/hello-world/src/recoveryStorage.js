import {
  getStorageNodeOuterHtml,
  normaliseCodeMacroStorageForWriteBack,
  normaliseDetachedPanelBodiesForWriteBack,
  normaliseStorageHtmlForParsing,
} from './utils';
import { blockSelectionKey } from './diffDisplay';
import { buildCellScopedTableChoiceRun } from './tableCellRecovery';

const UNSUPPORTED_MISSING_RAW_ERROR =
  'Recovered content is missing raw Confluence storage for an unsupported block, so write-back is disabled to avoid data loss.';
const MISSING_STORAGE_ERROR =
  'Recovered content is missing Confluence storage for one or more blocks, so write-back is disabled to avoid data loss.';
const UNSUPPORTED_PLACEHOLDER_STORAGE_RE =
  /data-dh-node-type=["']unsupported["']|Unsupported Confluence block/i;

function getBlockChoice(index, blockChoices, blockChoiceKeys) {
  const key = blockChoiceKeys.get(index) || blockSelectionKey(index);

  // The current app keeps the live page unless the user explicitly restores
  // an old block. This differs from the source write-back branch's historical
  // default and is intentional so the existing Sprint 2 behavior is preserved.
  return blockChoices.get(key) || 'current';
}

function blockIsOmitted(block, useCurrent) {
  if (block && block.isBlankLineCountChange) return false;

  return (
    (block && block.type === 'added' && !useCurrent) ||
    (block && block.type === 'removed' && useCurrent)
  );
}

function selectLayoutCellOpeningTag(block, useCurrent) {
  const currentTag = block.newRawHtml || block.newHtml || block.html || '';
  const oldTag = block.oldRawHtml || block.oldHtml || block.html || '';

  if (useCurrent || !block.layoutColumnWidthChange) return currentTag;
  if (!currentTag) return oldTag;

  // A column-width choice must change only the width metadata. Reusing the
  // complete historical opening tag could also restore stale local IDs or
  // editor bookkeeping attributes that have nothing to do with the user's
  // decision. Start from the live/current tag, remove its width attribute,
  // and copy only the historical width attribute when one existed.
  const widthAttributePattern =
    /\s+(?:data-width|ac:width|width)\s*=\s*(?:"[^"]*"|'[^']*')/gi;
  const oldWidthAttribute =
    oldTag.match(/\s+(?:data-width|ac:width|width)\s*=\s*(?:"[^"]*"|'[^']*')/i)?.[0] || '';
  const tagWithoutCurrentWidth = currentTag.replace(widthAttributePattern, '');

  return tagWithoutCurrentWidth.replace(
    /(\s*\/?>)$/,
    `${oldWidthAttribute}$1`
  );
}

export function getSelectedBlockStorageHtml(block, useCurrent) {
  if (!block) return '';

  if (block.isBlankLineCountChange) {
    // A count change stores complete runs on both sides. Although its public
    // type reports only the net direction (+ or -), neither choice is absent.
    return useCurrent
      ? block.newRawHtml || block.newHtml || ''
      : block.oldRawHtml || block.oldHtml || '';
  }

  if (block.type === 'same') {
    if (
      block.isStructuralBoundary &&
      block.layoutWrapperTag === 'ac:layout-cell' &&
      block.layoutBoundaryEdge === 'start' &&
      block.layoutColumnWidthChange
    ) {
      return selectLayoutCellOpeningTag(block, useCurrent);
    }

    if (
      block.isStructuralBoundary &&
      block.layoutWrapperTag === 'ac:layout-section' &&
      block.layoutBoundaryEdge === 'start' &&
      block.layoutWidthChange
    ) {
      // Widths live on child layout-cell tags. Keep the current section tag so
      // restoring widths does not roll back unrelated section/local-id data.
      return block.newRawHtml || block.newHtml || block.html || '';
    }

    return useCurrent
      ? block.newRawHtml || block.newHtml || block.html || ''
      : block.oldRawHtml || block.oldHtml || block.html || '';
  }

  if (block.type === 'added') {
    return useCurrent ? block.newRawHtml || block.newHtml || '' : '';
  }

  if (block.type === 'removed') {
    return useCurrent ? '' : block.oldRawHtml || block.oldHtml || '';
  }

  if (block.type === 'modified') {
    return useCurrent
      ? block.newRawHtml || block.newHtml || ''
      : block.oldRawHtml || block.oldHtml || '';
  }

  return block.html || '';
}

function validateSelectedBlock(block, useCurrent) {
  if (!block || blockIsOmitted(block, useCurrent)) return '';

  const storageHtml = getSelectedBlockStorageHtml(block, useCurrent);
  const isUnsupported =
    block.nodeType === 'unsupported' || block.supportLevel === 'raw';

  if (isUnsupported) {
    if (!storageHtml.trim() || UNSUPPORTED_PLACEHOLDER_STORAGE_RE.test(storageHtml)) {
      return UNSUPPORTED_MISSING_RAW_ERROR;
    }
    return '';
  }

  return storageHtml.trim() ? '' : MISSING_STORAGE_ERROR;
}

function isAdfNodeElement(node) {
  return (
    node &&
    node.nodeType === Node.ELEMENT_NODE &&
    String(node.tagName || '').toLowerCase() === 'ac:adf-node'
  );
}

function getAdfNodeType(node) {
  return String(
    (node && (node.getAttribute('type') || node.getAttribute('ac:type'))) || ''
  )
    .replace(/[-_]/g, '')
    .toLowerCase();
}

function findFirstElement(root, predicate) {
  return Array.from(root.querySelectorAll('*')).find(predicate) || null;
}

function getStorageOpeningTagAttributes(node) {
  const html = getStorageNodeOuterHtml(node);
  const match = /^<[^>\s]+([^>]*)>/.exec(html);
  return match ? match[1] : '';
}

function getStorageInnerHtml(node) {
  return Array.from((node && node.childNodes) || [])
    .map(getStorageNodeOuterHtml)
    .join('');
}

function isStorageElement(node, tagName) {
  return (
    node &&
    node.nodeType === Node.ELEMENT_NODE &&
    String(node.tagName || '').toLowerCase() === tagName
  );
}

function findClosestElement(node, predicate) {
  let current = node && node.parentElement;

  while (current) {
    if (predicate(current)) return current;
    current = current.parentElement;
  }

  return null;
}

function extractTaskItemStorage(storageHtml) {
  const doc = new DOMParser().parseFromString(
    normaliseStorageHtmlForParsing(storageHtml || ''),
    'text/html'
  );
  const adfTaskList = findFirstElement(
    doc.body,
    (node) => isAdfNodeElement(node) && getAdfNodeType(node) === 'tasklist'
  );

  if (adfTaskList) {
    const items = Array.from(adfTaskList.children).filter(
      (node) => isAdfNodeElement(node) && getAdfNodeType(node) === 'taskitem'
    );
    if (items.length === 1) {
      return {
        kind: 'adf-task-list',
        itemHtml: getStorageNodeOuterHtml(items[0]),
        wrapperAttrs: getStorageOpeningTagAttributes(adfTaskList),
      };
    }
  }

  const legacyTaskList = findFirstElement(
    doc.body,
    (node) => String(node.tagName || '').toLowerCase() === 'ac:task-list'
  );

  if (legacyTaskList) {
    const items = Array.from(legacyTaskList.children).filter(
      (node) => String(node.tagName || '').toLowerCase() === 'ac:task'
    );
    if (items.length === 1) {
      return {
        kind: 'confluence-task-list',
        itemHtml: getStorageNodeOuterHtml(items[0]),
        wrapperAttrs: getStorageOpeningTagAttributes(legacyTaskList),
      };
    }
  }

  return null;
}

function extractDecisionItemStorage(storageHtml) {
  const doc = new DOMParser().parseFromString(
    normaliseStorageHtmlForParsing(storageHtml || ''),
    'text/html'
  );
  const decisionList = findFirstElement(
    doc.body,
    (node) => isAdfNodeElement(node) && getAdfNodeType(node) === 'decisionlist'
  );
  if (!decisionList) return null;

  const items = Array.from(decisionList.children).filter(
    (node) => isAdfNodeElement(node) && getAdfNodeType(node) === 'decisionitem'
  );
  if (items.length !== 1) return null;

  const content = findFirstElement(
    items[0],
    (node) => isStorageElement(node, 'ac:adf-content')
  );

  return {
    kind: 'adf-decision-list',
    itemHtml: getStorageNodeOuterHtml(items[0]),
    // Confluence stores a readable copy of each Decision inside
    // ac:adf-fallback. Keep the selected item's rich content available so a
    // mixed old/current recovery can rebuild that fallback without retaining
    // an unselected Decision from either source version.
    fallbackHtml: content ? getStorageInnerHtml(content) : '',
    wrapperAttrs: getStorageOpeningTagAttributes(decisionList),
  };
}

function extractGroupedItemStorage(block, storageHtml) {
  if (block.nodeType === 'task_item') return extractTaskItemStorage(storageHtml);
  if (block.nodeType === 'decision') return extractDecisionItemStorage(storageHtml);
  return null;
}

function getStorageGroupKeys(block) {
  if (!block || !['task_item', 'decision'].includes(block.nodeType)) return new Set();

  return new Set(
    [block.oldStorageGroupKey, block.newStorageGroupKey, block.storageGroupKey]
      .filter(Boolean)
      .map(String)
  );
}

function keySetsOverlap(first, second) {
  if (!first.size || !second.size) return false;
  return Array.from(first).some((key) => second.has(key));
}

function mergeKeySets(target, source) {
  source.forEach((key) => target.add(key));
}

function getSelectedStorageGroup(block, useCurrent) {
  if (!block || blockIsOmitted(block, useCurrent)) return null;

  const html = useCurrent
    ? block.newStorageGroupHtml || block.storageGroupHtml
    : block.oldStorageGroupHtml || block.storageGroupHtml;

  return html ? { html } : null;
}

function getStorageGroupWrapperAttributes(block, groupHtml) {
  if (!groupHtml) return '';

  const doc = new DOMParser().parseFromString(
    normaliseStorageHtmlForParsing(groupHtml),
    'text/html'
  );
  if (block.nodeType === 'task_item') {
    const wrapper = findFirstElement(
      doc.body,
      (node) =>
        String(node.tagName || '').toLowerCase() === 'ac:task-list' ||
        (isAdfNodeElement(node) && getAdfNodeType(node) === 'tasklist')
    );
    return wrapper ? getStorageOpeningTagAttributes(wrapper) : '';
  }

  if (block.nodeType === 'decision') {
    const wrapper = findFirstElement(
      doc.body,
      (node) => isAdfNodeElement(node) && getAdfNodeType(node) === 'decisionlist'
    );
    return wrapper ? getStorageOpeningTagAttributes(wrapper) : '';
  }

  return '';
}

function getDecisionGroupTemplate(groupHtml) {
  if (!groupHtml) return null;

  const doc = new DOMParser().parseFromString(
    normaliseStorageHtmlForParsing(groupHtml),
    'text/html'
  );
  const decisionList = findFirstElement(
    doc.body,
    (node) => isAdfNodeElement(node) && getAdfNodeType(node) === 'decisionlist'
  );
  if (!decisionList) return null;

  const extension = findClosestElement(
    decisionList,
    (node) => isStorageElement(node, 'ac:adf-extension')
  );
  const fallback = extension
    ? findFirstElement(extension, (node) => isStorageElement(node, 'ac:adf-fallback'))
    : null;
  const fallbackList = fallback
    ? findFirstElement(fallback, (node) => /^(ul|ol)$/i.test(node.tagName || ''))
    : null;

  // A Decision List normally carries a list-level local-id before its item
  // nodes. It must stay on the list wrapper rather than being mistaken for an
  // independently selectable Decision.
  const listMetadataHtml = Array.from(decisionList.children)
    .filter(
      (node) =>
        node !== fallback &&
        !(isAdfNodeElement(node) && getAdfNodeType(node) === 'decisionitem')
    )
    .map(getStorageNodeOuterHtml)
    .join('');
  const extensionMetadataHtml = extension
    ? Array.from(extension.children)
        .filter((node) => node !== decisionList && node !== fallback)
        .map(getStorageNodeOuterHtml)
        .join('')
    : '';

  return {
    hasExtension: Boolean(extension),
    extensionAttrs: extension ? getStorageOpeningTagAttributes(extension) : '',
    extensionMetadataHtml,
    listAttrs: getStorageOpeningTagAttributes(decisionList),
    listMetadataHtml,
    fallbackAttrs: fallback ? getStorageOpeningTagAttributes(fallback) : '',
    // Confluence has emitted both shapes over time: some pages place the
    // fallback inside the decision-list node, while others place it beside the
    // node inside ac:adf-extension. Recreate the shape we actually received;
    // moving or retaining it in both places makes Confluence render a second
    // copy after saving.
    fallbackPlacement:
      fallback && fallback.parentElement === decisionList ? 'inside-list' : 'extension',
    fallbackListTag: fallbackList
      ? String(fallbackList.tagName || 'ul').toLowerCase()
      : 'ul',
    fallbackListAttrs: fallbackList
      ? getStorageOpeningTagAttributes(fallbackList)
      : ' class="decision-list"',
  };
}

function decisionGroupContainsExactly(groupHtml, selectedItems) {
  const template = getDecisionGroupTemplate(groupHtml);
  if (!template) return false;

  const doc = new DOMParser().parseFromString(
    normaliseStorageHtmlForParsing(groupHtml),
    'text/html'
  );
  const decisionList = findFirstElement(
    doc.body,
    (node) => isAdfNodeElement(node) && getAdfNodeType(node) === 'decisionlist'
  );
  const sourceItems = decisionList
    ? Array.from(decisionList.children)
        .filter(
          (node) => isAdfNodeElement(node) && getAdfNodeType(node) === 'decisionitem'
        )
        .map(getStorageNodeOuterHtml)
    : [];

  return (
    sourceItems.length === selectedItems.length &&
    sourceItems.every((itemHtml, index) => itemHtml === selectedItems[index].itemHtml)
  );
}

function renderStorageGroup(kind, items, wrapperAttrs = '', decisionTemplate = null) {
  if (!items.length) return '';
  const itemHtml = items.map((item) => item.itemHtml).join('');

  if (kind === 'adf-task-list') {
    return `<ac:adf-node${wrapperAttrs || ' type="taskList"'}>${itemHtml}</ac:adf-node>`;
  }
  if (kind === 'confluence-task-list') {
    return `<ac:task-list${wrapperAttrs}>${itemHtml}</ac:task-list>`;
  }
  if (kind === 'adf-decision-list') {
    const template = decisionTemplate || {};
    const fallbackListTag = template.fallbackListTag || 'ul';
    const fallbackItems = items
      .map((item) => `<li>${item.fallbackHtml || ''}</li>`)
      .join('');
    const fallback = [
      `<ac:adf-fallback${template.fallbackAttrs || ''}>`,
      `<${fallbackListTag}${template.fallbackListAttrs || ' class="decision-list"'}>`,
      fallbackItems,
      `</${fallbackListTag}>`,
      '</ac:adf-fallback>',
    ].join('');
    const decisionList = [
      `<ac:adf-node${template.listAttrs || wrapperAttrs || ' type="decision-list"'}>`,
      template.listMetadataHtml || '',
      itemHtml,
      template.fallbackPlacement === 'inside-list' ? fallback : '',
      '</ac:adf-node>',
    ].join('');

    if (!template.hasExtension) return decisionList;

    return [
      `<ac:adf-extension${template.extensionAttrs || ''}>`,
      template.extensionMetadataHtml || '',
      decisionList,
      template.fallbackPlacement === 'inside-list' ? '' : fallback,
      '</ac:adf-extension>',
    ].join('');
  }
  return itemHtml;
}

function getRawStorageGroupKeys(block) {
  if (!block) return new Set();

  return new Set(
    [block.oldStorageGroupKey, block.newStorageGroupKey, block.storageGroupKey]
      .filter((key) => key && String(key).startsWith('raw-block:'))
      .map(String)
  );
}

function collectConnectedGroups(blocks, getKeys, blockChoiceKeys, familyForBlock) {
  const components = [];

  blocks.forEach((block, index) => {
    const keys = getKeys(block);
    if (!keys.size) return;

    const family = familyForBlock(block);
    const choiceKey = blockChoiceKeys.get(index) || '';
    const matching = components.filter(
      (component) =>
        component.family === family &&
        (keySetsOverlap(component.keys, keys) ||
          (choiceKey && component.choiceKeys.has(choiceKey)))
    );

    if (!matching.length) {
      components.push({
        family,
        indices: [index],
        keys: new Set(keys),
        choiceKeys: new Set(choiceKey ? [choiceKey] : []),
      });
      return;
    }

    const target = matching[0];
    target.indices.push(index);
    mergeKeySets(target.keys, keys);
    if (choiceKey) target.choiceKeys.add(choiceKey);

    // A newly observed same block or paired choice can bridge two components
    // that previously only knew the old-side and current-side group keys.
    matching.slice(1).forEach((component) => {
      target.indices.push(...component.indices);
      mergeKeySets(target.keys, component.keys);
      mergeKeySets(target.choiceKeys, component.choiceKeys);
      components.splice(components.indexOf(component), 1);
    });
  });

  return components.map((component) => ({
    ...component,
    indices: Array.from(new Set(component.indices)).sort((left, right) => left - right),
  }));
}

function collectStorageGroupRuns(blocks, blockChoices, blockChoiceKeys) {
  const components = collectConnectedGroups(
    blocks,
    getStorageGroupKeys,
    blockChoiceKeys,
    (block) => block.nodeType
  );

  return components.flatMap((component) => {
    const items = [];
    let kind = '';
    let wrapperAttrs = '';
    let templateGroupHtml = '';
    let commonSelectedGroupHtml = '';
    let allItemsShareSelectedGroup = true;

    component.indices.forEach((index) => {
      const block = blocks[index];
      const useCurrent = getBlockChoice(index, blockChoices, blockChoiceKeys) !== 'old';
      const selectedGroup = getSelectedStorageGroup(block, useCurrent);
      const storageHtml = getSelectedBlockStorageHtml(block, useCurrent);
      const item = blockIsOmitted(block, useCurrent)
        ? null
        : extractGroupedItemStorage(block, storageHtml);

      if (!wrapperAttrs && selectedGroup) {
        wrapperAttrs = getStorageGroupWrapperAttributes(block, selectedGroup.html);
      }
      if (item) {
        kind = kind || item.kind;
        if (item.kind === kind) {
          wrapperAttrs = wrapperAttrs || item.wrapperAttrs || '';
          templateGroupHtml = templateGroupHtml || (selectedGroup && selectedGroup.html) || '';
          if (!selectedGroup) {
            allItemsShareSelectedGroup = false;
          } else if (!commonSelectedGroupHtml) {
            commonSelectedGroupHtml = selectedGroup.html;
          } else if (commonSelectedGroupHtml !== selectedGroup.html) {
            allItemsShareSelectedGroup = false;
          }
          items.push(item);
        }
      }
    });

    if (!items.length) return [];

    // If every selected Decision still belongs to one complete source group,
    // emit that original Storage verbatim. This preserves Confluence's outer
    // adf-extension and fallback exactly and prevents the editor from
    // normalising a naked decision-list into a second visible Decision block.
    const canReuseCompleteDecisionGroup =
      kind === 'adf-decision-list' &&
      allItemsShareSelectedGroup &&
      commonSelectedGroupHtml &&
      decisionGroupContainsExactly(commonSelectedGroupHtml, items);
    const decisionTemplate =
      kind === 'adf-decision-list'
        ? getDecisionGroupTemplate(templateGroupHtml || commonSelectedGroupHtml)
        : null;

    return [{
      start: component.indices[0],
      indices: new Set(component.indices),
      // Rebuild from selected raw items. Emitting an entire source group could
      // reintroduce an item the user explicitly omitted.
      html: canReuseCompleteDecisionGroup
        ? commonSelectedGroupHtml
        : renderStorageGroup(kind, items, wrapperAttrs, decisionTemplate),
    }];
  });
}

function getSelectedRawStorageGroup(block, useCurrent) {
  if (!block || blockIsOmitted(block, useCurrent)) return null;

  const html = useCurrent
    ? block.newStorageGroupHtml || block.storageGroupHtml
    : block.oldStorageGroupHtml || block.storageGroupHtml;
  const key = useCurrent
    ? block.newStorageGroupKey || block.storageGroupKey
    : block.oldStorageGroupKey || block.storageGroupKey;

  return html && key && String(key).startsWith('raw-block:')
    ? { html, useCurrent }
    : null;
}

function collectRawStorageGroupRuns(blocks, blockChoices, blockChoiceKeys) {
  const components = collectConnectedGroups(
    blocks,
    getRawStorageGroupKeys,
    blockChoiceKeys,
    () => 'raw-block'
  );

  return components.flatMap((component) => {
    let fallback = null;
    let current = null;

    component.indices.forEach((index) => {
      const block = blocks[index];
      const useCurrent = getBlockChoice(index, blockChoices, blockChoiceKeys) !== 'old';
      const selectedGroup = getSelectedRawStorageGroup(block, useCurrent);
      if (!selectedGroup) return;

      fallback = fallback || selectedGroup;
      if (selectedGroup.useCurrent) current = selectedGroup;
    });

    const selected = current || fallback;
    if (!selected) return [];

    return [{
      start: component.indices[0],
      indices: new Set(component.indices),
      html: selected.html,
    }];
  });
}

function findStorageGroupRun(runs, index) {
  return runs.find((run) => run.indices.has(index)) || null;
}

export function buildRecoveryStorageHtml(
  blocks,
  blockChoices = new Map(),
  blockChoiceKeys = new Map()
) {
  const safeBlocks = blocks || [];
  const storageParts = [];
  const rawGroupRuns = collectRawStorageGroupRuns(
    safeBlocks,
    blockChoices,
    blockChoiceKeys
  );
  const groupRuns = collectStorageGroupRuns(safeBlocks, blockChoices, blockChoiceKeys);

  for (let index = 0; index < safeBlocks.length; index++) {
    const block = safeBlocks[index];

    // Same-structure tables can expose independent cell choices in the Inline
    // comparison UI. Rebuild one complete table from the current Storage and
    // copy only explicitly restored old cells into it. The ordinary whole-block
    // path below remains untouched for structural table changes.
    const tableCellRun = buildCellScopedTableChoiceRun({
      blocks: safeBlocks,
      index,
      blockChoices,
      blockChoiceKeys,
      storageFormat: true,
    });
    if (tableCellRun) {
      if (!String(tableCellRun.html || '').trim()) {
        return { html: '', error: MISSING_STORAGE_ERROR };
      }
      storageParts.push(tableCellRun.html);
      index += tableCellRun.consumed - 1;
      continue;
    }

    const useCurrent = getBlockChoice(index, blockChoices, blockChoiceKeys) !== 'old';
    const error = validateSelectedBlock(block, useCurrent);
    if (error) return { html: '', error };

    const rawGroupRun = findStorageGroupRun(rawGroupRuns, index);
    if (rawGroupRun) {
      if (rawGroupRun.start === index) storageParts.push(rawGroupRun.html);
      continue;
    }

    const groupRun = findStorageGroupRun(groupRuns, index);
    if (groupRun) {
      if (groupRun.start === index) storageParts.push(groupRun.html);
      continue;
    }

    if (!blockIsOmitted(block, useCurrent)) {
      storageParts.push(getSelectedBlockStorageHtml(block, useCurrent));
    }
  }

  return {
    html: normaliseDetachedPanelBodiesForWriteBack(
      normaliseCodeMacroStorageForWriteBack(storageParts.join(''))
    ),
    error: '',
  };
}
