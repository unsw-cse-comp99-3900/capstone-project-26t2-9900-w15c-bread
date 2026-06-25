// Small formatting helpers for the timeline.

export function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export function formatRelativeTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;

  const sec = Math.round((Date.now() - d.getTime()) / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);

  if (sec < 60) return 'just now';
  if (min < 60) return `${min} min ago`;
  if (hr < 24) return `${hr} hr ago`;
  if (day < 30) return `${day} day${day > 1 ? 's' : ''} ago`;
  return formatDateTime(iso);
}

export function initials(name) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function storageToPlainText(bodyValue) {
  if (!bodyValue) return '';

  const withoutMacros = bodyValue.replace(/<ac:[^>]+>|<\/ac:[^>]+>/g, ' ');
  const withLineBreaks = withoutMacros
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|table)>/gi, '\n');

  const doc = new DOMParser().parseFromString(withLineBreaks, 'text/html');
  return (doc.body.textContent || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function lookupAttachmentUrl(filename, attachmentsByFilename) {
  if (!filename || !attachmentsByFilename) return '';
  return attachmentsByFilename[filename] || attachmentsByFilename[filename.toLowerCase()] || '';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decodeCdata(value) {
  return String(value || '').replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
}

function extractAttr(markup, attrNames) {
  for (const attrName of attrNames) {
    const escapedName = attrName.replace(':', '\\:');
    const re = new RegExp(`${escapedName}=["']([^"']+)["']`, 'i');
    const m = re.exec(markup);
    if (m) return m[1];
  }
  return '';
}

function confluenceEmoticonToText(name) {
  const map = {
    'smile': '🙂',
    'sad': '🙁',
    'cheeky': '😛',
    'laugh': '😀',
    'wink': '😉',
    'thumbs-up': '👍',
    'thumbs-down': '👎',
    'information': 'ℹ️',
    'tick': '✅',
    'cross': '❌',
    'warning': '⚠️',
    'plus': '➕',
    'minus': '➖',
    'question': '❓',
    'light-on': '💡',
    'light-off': '💡',
  };
  return map[name] || (name ? `:${name}:` : '');
}

function expandConfluenceLinks(html, baseUrl) {
  return html.replace(/<ac:link\b[\s\S]*?<\/ac:link>/gi, (match) => {
    const bodyMatch =
      /<ac:plain-text-link-body[^>]*>([\s\S]*?)<\/ac:plain-text-link-body>/i.exec(match) ||
      /<ac:link-body[^>]*>([\s\S]*?)<\/ac:link-body>/i.exec(match);
    const label = bodyMatch ? decodeCdata(bodyMatch[1]).trim() : '';

    const urlMatch = /<ri:url\b[^>]*(?:ri:value|value)=["']([^"']+)["'][^>]*\/?>/i.exec(match);
    if (urlMatch) {
      const href = urlMatch[1];
      return `<a href="${escapeHtml(href)}">${escapeHtml(label || href)}</a>`;
    }

    const pageMatch = /<ri:page\b[^>]*\/?>/i.exec(match);
    if (pageMatch) {
      const pageMarkup = pageMatch[0];
      const title = extractAttr(pageMarkup, ['ri:content-title', 'content-title']) || label;
      const href =
        baseUrl && title
          ? `${baseUrl}/wiki/search?text=${encodeURIComponent(title)}`
          : '';
      return href
        ? `<a href="${escapeHtml(href)}">${escapeHtml(label || title)}</a>`
        : escapeHtml(label || title);
    }

    const attachmentMatch = /<ri:attachment\b[^>]*\/?>/i.exec(match);
    if (attachmentMatch) {
      const filename = extractAttr(attachmentMatch[0], ['ri:filename', 'filename']);
      return escapeHtml(label || filename);
    }

    return escapeHtml(label);
  });
}

export function prepareConfluenceHtml(html, baseUrl, attachmentsByFilename = {}) {
  if (!html) return '';

  const expandedStorage = expandConfluenceLinks(html, baseUrl)
    .replace(/<ac:emoticon\b[^>]*(?:ac:name|name)=["']([^"']+)["'][^>]*\/?>/gi, (_match, name) =>
      confluenceEmoticonToText(name)
    )
    .replace(
      /<ac:image[\s\S]*?<ri:url[^>]*(?:ri:value|value)=["']([^"']+)["'][^>]*>[\s\S]*?<\/ac:image>/gi,
      '<img src="$1" alt="" />'
    )
    .replace(
      /<ac:image[\s\S]*?<ri:attachment[^>]*(?:ri:filename|filename)=["']([^"']+)["'][^>]*>[\s\S]*?<\/ac:image>/gi,
      (_match, filename) => {
        const url = lookupAttachmentUrl(filename, attachmentsByFilename);
        if (url) {
          return `<img src="${escapeHtml(url)}" alt="${escapeHtml(filename)}" />`;
        }
        return `<figure><div data-image-placeholder="true">Image attachment: ${escapeHtml(
          filename
        )}</div></figure>`;
      }
    );

  const allowedTags = new Set([
    'A',
    'B',
    'BLOCKQUOTE',
    'BR',
    'CODE',
    'COL',
    'COLGROUP',
    'DEL',
    'DIV',
    'EM',
    'FIGURE',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'HR',
    'I',
    'IMG',
    'LI',
    'MARK',
    'OL',
    'P',
    'PRE',
    'S',
    'SPAN',
    'STRONG',
    'TABLE',
    'TBODY',
    'TD',
    'TH',
    'THEAD',
    'TR',
    'U',
    'UL',
  ]);
  const allowedAttrs = new Set(['alt', 'colspan', 'href', 'rowspan', 'src', 'title']);
  const doc = new DOMParser().parseFromString(expandedStorage, 'text/html');

  Array.from(doc.body.querySelectorAll('*')).forEach((node) => {
    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(...Array.from(node.childNodes));
      return;
    }

    Array.from(node.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value || '';
      const isAllowedDataImage = name === 'src' && value.startsWith('data:image/');
      if (!allowedAttrs.has(name) && !name.startsWith('data-')) {
        node.removeAttribute(attr.name);
        return;
      }

      if ((name === 'href' || name === 'src') && !isAllowedDataImage) {
        if (/^\s*javascript:/i.test(value)) {
          node.removeAttribute(attr.name);
          return;
        }

        if (baseUrl && value.startsWith('/')) {
          node.setAttribute(attr.name, `${baseUrl}${value}`);
        }
      }
    });

    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noreferrer');
    }
  });

  return doc.body.innerHTML;
}

function normaliseBlockText(node) {
  return (node.textContent || '').replace(/\s+/g, ' ').trim();
}

function normaliseComparableText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function stableHtmlSignature(node) {
  if (node.nodeType === Node.TEXT_NODE) return normaliseBlockText(node);
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const element = node;
  const tag = element.tagName.toLowerCase();
  const text = normaliseBlockText(element);
  if (text) return `${tag}:${text}`;

  if (tag === 'img') {
    return `img:${element.getAttribute('src') || element.getAttribute('alt') || element.outerHTML}`;
  }

  const img = element.querySelector && element.querySelector('img');
  if (img) {
    return `image-block:${img.getAttribute('src') || img.getAttribute('alt') || element.outerHTML}`;
  }

  if (tag === 'hr') return 'hr';
  if (tag === 'br') return 'br';

  return `${tag}:${element.outerHTML.replace(/\s+/g, ' ').trim()}`;
}

function isTextDiffableTag(tag) {
  return /^(p|h[1-6]|li|blockquote|td|th|pre|code)$/i.test(tag || '');
}

function extractBlockMeta(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = normaliseBlockText(node);
    return {
      key: text,
      html: text ? `<p>${escapeHtml(text)}</p>` : '',
      tag: 'p',
      text,
      canInlineDiff: Boolean(text),
    };
  }

  const tag = node.tagName.toLowerCase();
  const text = normaliseBlockText(node);
  const hasNonTextMedia = Boolean(
    node.querySelector && node.querySelector('img, table, hr, iframe, video, audio')
  );

  return {
    key: stableHtmlSignature(node),
    html: node.outerHTML,
    tag,
    text,
    canInlineDiff: isTextDiffableTag(tag) && text && !hasNonTextMedia,
  };
}

function extractDiffBlocks(html, baseUrl, attachmentsByFilename) {
  const prepared = prepareConfluenceHtml(html, baseUrl, attachmentsByFilename);
  const doc = new DOMParser().parseFromString(prepared, 'text/html');

  return Array.from(doc.body.childNodes)
    .filter((node) => node.nodeType === Node.ELEMENT_NODE || normaliseBlockText(node))
    .map(extractBlockMeta)
    .filter((block) => block.html);
}

function appendRichDiffBlock(htmlParts, type, html) {
  if (type === 'same') {
    htmlParts.push(html);
    return;
  }

  htmlParts.push(`<div class="dh-rich-diff-block dh-rich-diff-block--${type}">${html}</div>`);
}

function splitInlineDiffUnits(text) {
  const value = String(text || '').replace(/\r\n/g, '\n');
  if (!value) return [];

  const units = value.match(/\s+|[\u4e00-\u9fff]|[A-Za-z0-9_]+|[^\sA-Za-z0-9_\u4e00-\u9fff]/g);
  return units || [value];
}

function textSimilarity(a, b) {
  const oldText = normaliseComparableText(a);
  const newText = normaliseComparableText(b);
  if (!oldText || !newText) return 0;
  if (oldText === newText) return 1;

  const oldUnits = splitInlineDiffUnits(oldText).filter((unit) => unit.trim());
  const newUnits = splitInlineDiffUnits(newText).filter((unit) => unit.trim());
  if (!oldUnits.length || !newUnits.length) return 0;

  const oldSet = new Set(oldUnits);
  const newSet = new Set(newUnits);
  let overlap = 0;
  oldSet.forEach((unit) => {
    if (newSet.has(unit)) overlap++;
  });

  return overlap / Math.max(oldSet.size, newSet.size);
}

function appendInlinePart(parts, type, text) {
  if (!text) return;

  const previous = parts[parts.length - 1];
  if (previous && previous.type === type) {
    previous.text += text;
    return;
  }

  parts.push({ type, text });
}

function buildInlineTextDiff(oldText, newText) {
  const oldUnits = splitInlineDiffUnits(oldText);
  const newUnits = splitInlineDiffUnits(newText);
  const oldCount = oldUnits.length;
  const newCount = newUnits.length;
  const maxCells = 80000;

  if (!oldCount && !newCount) {
    return { html: '', added: 0, removed: 0, limited: false };
  }

  if (oldCount * newCount > maxCells) {
    return {
      html: escapeHtml(newText),
      added: 0,
      removed: 0,
      limited: true,
    };
  }

  const dp = Array.from({ length: oldCount + 1 }, () => Array(newCount + 1).fill(0));

  for (let i = oldCount - 1; i >= 0; i--) {
    for (let j = newCount - 1; j >= 0; j--) {
      dp[i][j] =
        oldUnits[i] === newUnits[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const parts = [];
  let added = 0;
  let removed = 0;
  let i = 0;
  let j = 0;

  while (i < oldCount && j < newCount) {
    if (oldUnits[i] === newUnits[j]) {
      appendInlinePart(parts, 'same', oldUnits[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      appendInlinePart(parts, 'removed', oldUnits[i]);
      if (oldUnits[i].trim()) removed++;
      i++;
    } else {
      appendInlinePart(parts, 'added', newUnits[j]);
      if (newUnits[j].trim()) added++;
      j++;
    }
  }

  while (i < oldCount) {
    appendInlinePart(parts, 'removed', oldUnits[i]);
    if (oldUnits[i].trim()) removed++;
    i++;
  }

  while (j < newCount) {
    appendInlinePart(parts, 'added', newUnits[j]);
    if (newUnits[j].trim()) added++;
    j++;
  }

  return {
    html: parts
      .map((part) => {
        if (part.type === 'same') return escapeHtml(part.text);
        return `<span class="dh-rich-diff-inline dh-rich-diff-inline--${part.type}">${escapeHtml(
          part.text
        )}</span>`;
      })
      .join(''),
    added,
    removed,
    limited: false,
  };
}

function renderBlockWithInlineDiff(currentBlock, inlineDiffHtml) {
  const doc = new DOMParser().parseFromString(currentBlock.html, 'text/html');
  const element = doc.body.firstElementChild;

  if (!element) {
    return `<p>${inlineDiffHtml}</p>`;
  }

  element.innerHTML = inlineDiffHtml;
  return element.outerHTML;
}

function canPairForInlineDiff(oldBlock, currentBlock) {
  if (!oldBlock || !currentBlock) return false;
  if (!oldBlock.canInlineDiff || !currentBlock.canInlineDiff) return false;
  if (oldBlock.tag !== currentBlock.tag) return false;
  return textSimilarity(oldBlock.text, currentBlock.text) >= 0.25;
}

function buildModifiedBlockDiff(oldBlock, currentBlock) {
  const inlineDiff = buildInlineTextDiff(oldBlock.text, currentBlock.text);
  return {
    html: `<div class="dh-rich-diff-block dh-rich-diff-block--modified">${renderBlockWithInlineDiff(
      currentBlock,
      inlineDiff.html
    )}</div>`,
    added: inlineDiff.added,
    removed: inlineDiff.removed,
    limited: inlineDiff.limited,
  };
}

export function buildRichTextDiffHtml(oldHtml, currentHtml, baseUrl, attachmentsByFilename = {}) {
  const oldBlocks = extractDiffBlocks(oldHtml, baseUrl, attachmentsByFilename);
  const currentBlocks = extractDiffBlocks(currentHtml, baseUrl, attachmentsByFilename);
  const oldCount = oldBlocks.length;
  const currentCount = currentBlocks.length;
  const maxCells = 120000;

  if (!oldCount && !currentCount) {
    return { html: '', added: 0, removed: 0, limited: false };
  }

  if (!oldCount) {
    return {
      html: currentBlocks
        .map((block) => `<div class="dh-rich-diff-block dh-rich-diff-block--added">${block.html}</div>`)
        .join(''),
      added: currentCount,
      removed: 0,
      limited: false,
    };
  }

  if (!currentCount || oldCount * currentCount > maxCells) {
    return {
      html: currentBlocks.map((block) => block.html).join(''),
      added: 0,
      removed: 0,
      limited: oldCount * currentCount > maxCells,
    };
  }

  const dp = Array.from({ length: oldCount + 1 }, () => Array(currentCount + 1).fill(0));

  for (let i = oldCount - 1; i >= 0; i--) {
    for (let j = currentCount - 1; j >= 0; j--) {
      dp[i][j] =
        oldBlocks[i].key === currentBlocks[j].key
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const htmlParts = [];
  let added = 0;
  let removed = 0;
  let limited = false;
  let i = 0;
  let j = 0;

  while (i < oldCount && j < currentCount) {
    if (oldBlocks[i].key === currentBlocks[j].key) {
      appendRichDiffBlock(htmlParts, 'same', currentBlocks[j].html);
      i++;
      j++;
    } else if (canPairForInlineDiff(oldBlocks[i], currentBlocks[j])) {
      const modified = buildModifiedBlockDiff(oldBlocks[i], currentBlocks[j]);
      htmlParts.push(modified.html);
      added += modified.added;
      removed += modified.removed;
      limited = limited || modified.limited;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      appendRichDiffBlock(htmlParts, 'removed', oldBlocks[i].html);
      removed++;
      i++;
    } else {
      appendRichDiffBlock(htmlParts, 'added', currentBlocks[j].html);
      added++;
      j++;
    }
  }

  while (i < oldCount) {
    appendRichDiffBlock(htmlParts, 'removed', oldBlocks[i].html);
    removed++;
    i++;
  }

  while (j < currentCount) {
    appendRichDiffBlock(htmlParts, 'added', currentBlocks[j].html);
    added++;
    j++;
  }

  return { html: htmlParts.join(''), added, removed, limited };
}

export function countWords(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function splitDiffLines(text) {
  if (!text) return [];
  return text.replace(/\r\n/g, '\n').split('\n');
}

function appendSegment(segments, type, text) {
  const previous = segments[segments.length - 1];
  if (previous && previous.type === type) {
    previous.lines.push(text);
    return;
  }

  segments.push({ type, lines: [text] });
}

export function buildLineDiff(oldText, newText) {
  const oldLines = splitDiffLines(oldText);
  const newLines = splitDiffLines(newText);
  const oldCount = oldLines.length;
  const newCount = newLines.length;
  const maxCells = 500000;

  if (oldCount * newCount > maxCells) {
    return {
      segments: [{ type: 'same', lines: newLines }],
      added: 0,
      removed: 0,
      unchanged: newCount,
      limited: true,
    };
  }

  const dp = Array.from({ length: oldCount + 1 }, () => Array(newCount + 1).fill(0));

  for (let i = oldCount - 1; i >= 0; i--) {
    for (let j = newCount - 1; j >= 0; j--) {
      dp[i][j] =
        oldLines[i] === newLines[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const segments = [];
  let added = 0;
  let removed = 0;
  let unchanged = 0;
  let i = 0;
  let j = 0;

  while (i < oldCount && j < newCount) {
    if (oldLines[i] === newLines[j]) {
      appendSegment(segments, 'same', oldLines[i]);
      unchanged++;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      appendSegment(segments, 'removed', oldLines[i]);
      removed++;
      i++;
    } else {
      appendSegment(segments, 'added', newLines[j]);
      added++;
      j++;
    }
  }

  while (i < oldCount) {
    appendSegment(segments, 'removed', oldLines[i]);
    removed++;
    i++;
  }

  while (j < newCount) {
    appendSegment(segments, 'added', newLines[j]);
    added++;
    j++;
  }

  return { segments, added, removed, unchanged, limited: false };
}
