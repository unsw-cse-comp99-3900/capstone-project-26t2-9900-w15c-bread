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

function normaliseLineEndings(value) {
  return String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function getNodeOuterHtml(node) {
  if (!node) return '';
  if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent || '');
  if (node.nodeType === Node.ELEMENT_NODE) return node.outerHTML || '';
  return '';
}

function hashString(value) {
  let hash = 0;
  const text = String(value || '');

  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }

  return hash.toString(16);
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

function isWhiteboardUrl(url) {
  return /\/wiki\/spaces\/[^/]+\/whiteboard\/[^/?#]+/i.test(String(url || ''));
}

function cleanWhiteboardTitle(title) {
  return cleanUserFacingName(title) || 'Untitled whiteboard';
}

function renderWhiteboardCard(url, title) {
  const safeUrl = escapeHtml(url || '');
  const safeTitle = escapeHtml(cleanWhiteboardTitle(title));

  return [
    `<div data-dh-node-type="whiteboard_card" data-dh-whiteboard-url="${safeUrl}">`,
    '<div data-dh-whiteboard-icon="true"></div>',
    '<div data-dh-whiteboard-main="true">',
    `<a href="${safeUrl}" data-dh-whiteboard-title="true">${safeTitle}</a>`,
    '<div data-dh-whiteboard-product="true">',
    '<span data-dh-whiteboard-product-icon="true"></span>',
    '<span>Confluence Whiteboards</span>',
    '</div>',
    '</div>',
    `<a href="${safeUrl}" data-dh-whiteboard-open="true">Open preview</a>`,
    '</div>',
  ].join('');
}

function expandConfluenceLinks(html, baseUrl) {
  return html.replace(/<ac:link\b[\s\S]*?<\/ac:link>/gi, (match) => {
    const bodyMatch =
      /<ac:plain-text-link-body[^>]*>([\s\S]*?)<\/ac:plain-text-link-body>/i.exec(match) ||
      /<ac:link-body[^>]*>([\s\S]*?)<\/ac:link-body>/i.exec(match);
    const label = bodyMatch ? decodeCdata(bodyMatch[1]).trim() : '';
    const title = cleanUserFacingName(extractAttr(match, ['ac:title', 'title']));

    const urlMatch = /<ri:url\b[^>]*(?:ri:value|value)=["']([^"']+)["'][^>]*\/?>/i.exec(match);
    if (urlMatch) {
      const href = urlMatch[1];
      if (isWhiteboardUrl(href)) {
        return renderWhiteboardCard(href, label || title);
      }

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

function expandConfluenceCodeMacros(html) {
  return String(html || '').replace(
    /<ac:structured-macro\b[^>]*(?:ac:name|name)=["']code["'][^>]*>[\s\S]*?<\/ac:structured-macro>/gi,
    (match) => {
      const plainTextBody =
        /<ac:plain-text-body[^>]*>([\s\S]*?)<\/ac:plain-text-body>/i.exec(match);
      const richTextBody = /<ac:rich-text-body[^>]*>([\s\S]*?)<\/ac:rich-text-body>/i.exec(match);
      const language =
        /<ac:parameter\b[^>]*(?:ac:name|name)=["']language["'][^>]*>([\s\S]*?)<\/ac:parameter>/i.exec(
          match
        );
      const title =
        /<ac:parameter\b[^>]*(?:ac:name|name)=["']title["'][^>]*>([\s\S]*?)<\/ac:parameter>/i.exec(
          match
        );
      const rawBody = plainTextBody ? plainTextBody[1] : richTextBody ? richTextBody[1] : '';
      const code = normaliseLineEndings(decodeCdata(rawBody));
      const languageAttr = language
        ? ` data-language="${escapeHtml(decodeCdata(language[1]).trim())}"`
        : '';
      const titleAttr = title ? ` title="${escapeHtml(decodeCdata(title[1]).trim())}"` : '';

      return `<pre data-dh-node-type="code_block"${languageAttr}${titleAttr}><code>${escapeHtml(
        code
      )}</code></pre>`;
    }
  );
}

function extractMacroParameter(markup, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `<ac:parameter\\b[^>]*(?:ac:name|name)=["']${escapedName}["'][^>]*>([\\s\\S]*?)<\\/ac:parameter>`,
    'i'
  );
  const match = re.exec(markup);
  return match ? decodeCdata(match[1]).replace(/<[^>]+>/g, '').trim() : '';
}

function extractMacroBody(markup) {
  const richTextBody = /<ac:rich-text-body[^>]*>([\s\S]*?)<\/ac:rich-text-body>/i.exec(markup);
  const plainTextBody = /<ac:plain-text-body[^>]*>([\s\S]*?)<\/ac:plain-text-body>/i.exec(markup);
  return richTextBody ? richTextBody[1] : plainTextBody ? escapeHtml(decodeCdata(plainTextBody[1])) : '';
}

function stripTags(value) {
  return String(value || '').replace(/<[^>]+>/g, '').trim();
}

function cleanUserFacingName(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';

  // Storage nodes often carry internal identifiers that are useful for
  // reconstruction but noisy or sensitive in normal preview text. Keep those
  // values available in the raw inspector only.
  if (/https?:\/\//i.test(text)) return '';
  if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(text)) return '';
  if (/\b(ari:|localid|macro[-_]?id|status[-_]?id|extension[-_]?key)\b/i.test(text)) return '';
  if (text.length > 80) return '';

  return text;
}

function extractAdfAttribute(markup, names) {
  const keys = Array.isArray(names) ? names : [names];

  for (const key of keys) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(
      `<ac:adf-attribute\\b[^>]*(?:key|ac:key|name|ac:name)=["']${escapedKey}["'][^>]*>([\\s\\S]*?)<\\/ac:adf-attribute>`,
      'i'
    );
    const match = re.exec(markup);
    if (match) return stripTags(decodeCdata(match[1]));
  }

  return '';
}

function removeAdfAttributes(markup) {
  return String(markup || '').replace(/<ac:adf-attribute\b[\s\S]*?<\/ac:adf-attribute>/gi, '');
}

function fallbackEmojiText(name) {
  const cleanedName = cleanUserFacingName(String(name || '').replace(/^:|:$/g, ''));
  if (!cleanedName) return '[Emoji]';
  if (cleanedName.toLowerCase() === 'rainbow') return '🌈';
  return `[Emoji: ${cleanedName}]`;
}

function titleCaseStorageName(value) {
  return String(value || '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function createRawFallbackHtml(rawMarkup, options = {}) {
  const type = cleanUserFacingName(options.type) || 'Unsupported Confluence block';
  const name = cleanUserFacingName(options.name);
  const label = name ? `${type}: ${name}` : type;

  return [
    '<div data-dh-node-type="unsupported" data-dh-support-level="raw">',
    '<p><strong>Unsupported Confluence block</strong></p>',
    `<p>Type: ${escapeHtml(label)}</p>`,
    '<p>This block cannot be fully rendered by this app. Original data is preserved.</p>',
    '<details data-dh-raw-inspector="true">',
    '<summary>View raw data</summary>',
    `<pre>${escapeHtml(rawMarkup)}</pre>`,
    '</details>',
    '</div>',
  ].join('');
}

function expandConfluenceTaskLists(html) {
  return String(html || '').replace(/<ac:task-list\b[^>]*>[\s\S]*?<\/ac:task-list>/gi, (listMarkup) => {
    const taskItems = [];
    const taskRe = /<ac:task\b[^>]*>([\s\S]*?)<\/ac:task>/gi;
    let match = taskRe.exec(listMarkup);

    while (match) {
      const taskMarkup = match[1];
      const statusMatch = /<ac:task-status[^>]*>([\s\S]*?)<\/ac:task-status>/i.exec(taskMarkup);
      const bodyMatch = /<ac:task-body[^>]*>([\s\S]*?)<\/ac:task-body>/i.exec(taskMarkup);
      const status = statusMatch ? statusMatch[1].replace(/<[^>]+>/g, '').trim() : 'incomplete';
      const checked = /^(complete|done|checked)$/i.test(status);
      const body = bodyMatch ? bodyMatch[1] : '';

      taskItems.push(
        [
          `<li data-dh-node-type="task_item" data-dh-task-status="${checked ? 'complete' : 'incomplete'}">`,
          `<span data-dh-task-marker="true">${checked ? '[x]' : '[ ]'}</span> `,
          body,
          '</li>',
        ].join('')
      );

      match = taskRe.exec(listMarkup);
    }

    if (!taskItems.length) {
      return createRawFallbackHtml(listMarkup, { type: 'Task list' });
    }

    return `<ul data-dh-node-type="task_list">${taskItems.join('')}</ul>`;
  });
}

function expandWhiteboardAnchors(html) {
  return String(html || '').replace(/<a\b([^>]*)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi, (match, beforeHref, href, afterHref, labelMarkup) => {
    if (!isWhiteboardUrl(href)) return match;

    const label = stripTags(labelMarkup).replace(/\s+/g, ' ').trim();
    const title = cleanUserFacingName(extractAttr(`${beforeHref} ${afterHref}`, ['title', 'aria-label']));
    return renderWhiteboardCard(href, label || title);
  });
}

function expandAdfNodes(html) {
  let expanded = String(html || '');

  expanded = expanded.replace(
    /<ac:adf-node\b[^>]*(?:type|ac:type)=["']status["'][^>]*>[\s\S]*?<\/ac:adf-node>/gi,
    (match) => {
      const text =
        cleanUserFacingName(extractAdfAttribute(match, ['text', 'title', 'localId'])) ||
        'Status';
      return `<span data-dh-node-type="status">[Status: ${escapeHtml(text)}]</span>`;
    }
  );

  expanded = expanded.replace(
    /<ac:adf-node\b[^>]*(?:type|ac:type)=["']emoji["'][^>]*>[\s\S]*?<\/ac:adf-node>/gi,
    (match) => {
      const name = extractAdfAttribute(match, ['shortName', 'text', 'name']);
      return `<span data-dh-node-type="emoji">${escapeHtml(fallbackEmojiText(name))}</span>`;
    }
  );

  expanded = expanded.replace(
    /<ac:adf-node\b[^>]*(?:type|ac:type)=["']date["'][^>]*>[\s\S]*?<\/ac:adf-node>/gi,
    (match) => {
      const value = cleanUserFacingName(extractAdfAttribute(match, ['timestamp', 'date', 'value']));
      return value ? `<span data-dh-node-type="date">${escapeHtml(value)}</span>` : '[Date]';
    }
  );

  expanded = expanded.replace(
    /<ac:adf-node\b[^>]*(?:type|ac:type)=["']mention["'][^>]*>[\s\S]*?<\/ac:adf-node>/gi,
    (match) => {
      const displayName = cleanUserFacingName(extractAdfAttribute(match, ['text', 'displayName']));
      return `<span data-dh-node-type="mention">${escapeHtml(displayName ? `@${displayName}` : '[Mention]')}</span>`;
    }
  );

  expanded = expanded.replace(
    /<ac:adf-node\b[^>]*(?:type|ac:type)=["'](?:inlineCard|blockCard|embedCard)["'][^>]*>[\s\S]*?<\/ac:adf-node>/gi,
    (match) => {
      const title = cleanUserFacingName(
        extractAdfAttribute(match, ['title', 'text', 'name', 'displayName'])
      );
      const url = extractAdfAttribute(match, ['url', 'href']);

      if (isWhiteboardUrl(url)) {
        return renderWhiteboardCard(url, title);
      }

      return `<div data-dh-node-type="smart_link">${escapeHtml(title || '[Smart link]')}</div>`;
    }
  );

  expanded = expanded.replace(
    /<ac:adf-node\b[^>]*(?:type|ac:type)=["']decisionItem["'][^>]*>([\s\S]*?)<\/ac:adf-node>/gi,
    (_match, body) => `<div data-dh-node-type="decision">[Decision] ${removeAdfAttributes(body)}</div>`
  );

  expanded = expanded.replace(
    /<ac:adf-node\b[^>]*(?:type|ac:type)=["']taskItem["'][^>]*>([\s\S]*?)<\/ac:adf-node>/gi,
    (match, body) => {
      const state = extractAdfAttribute(match, ['state', 'checked']);
      const checked = /^(done|complete|checked|true)$/i.test(state);
      return [
        `<li data-dh-node-type="task_item" data-dh-task-status="${checked ? 'complete' : 'incomplete'}">`,
        `<span data-dh-task-marker="true">${checked ? '[x]' : '[ ]'}</span> `,
        removeAdfAttributes(body),
        '</li>',
      ].join('');
    }
  );

  expanded = expanded.replace(
    /<ac:adf-node\b[^>]*(?:type|ac:type)=["']taskList["'][^>]*>([\s\S]*?)<\/ac:adf-node>/gi,
    (_match, body) => `<ul data-dh-node-type="task_list">${body}</ul>`
  );

  expanded = expanded.replace(
    /<ac:adf-node\b[^>]*(?:type|ac:type)=["'](?:extension|bodiedExtension|multiBodiedExtension)["'][^>]*>[\s\S]*?<\/ac:adf-node>/gi,
    (match) =>
      createRawFallbackHtml(match, {
        type: 'Extension',
        name: titleCaseStorageName(extractAdfAttribute(match, ['extensionTitle', 'title'])),
      })
  );

  // Any remaining ADF attributes are implementation details. Removing them
  // prevents localIds, colors, gadget URLs, and state fields from becoming
  // ordinary preview text when their parent node is rendered in simplified form.
  return removeAdfAttributes(expanded);
}

function expandKnownStructuredMacros(html) {
  return String(html || '').replace(
    /<ac:structured-macro\b[^>]*>[\s\S]*?<\/ac:structured-macro>/gi,
    (macroMarkup) => {
      const name = extractAttr(macroMarkup, ['ac:name', 'name']);
      const normalisedName = String(name || '').toLowerCase();

      if (normalisedName === 'code') {
        return macroMarkup;
      }

      if (['info', 'note', 'warning', 'tip', 'success', 'error', 'panel'].includes(normalisedName)) {
        const title = cleanUserFacingName(extractMacroParameter(macroMarkup, 'title'));
        const body = extractMacroBody(macroMarkup);
        const panelType = normalisedName === 'panel' ? 'panel' : normalisedName;
        const heading = title || `${titleCaseStorageName(panelType)} panel`;

        return [
          `<div data-dh-node-type="panel" data-dh-panel-type="${escapeHtml(panelType)}">`,
          `<p><strong>${escapeHtml(heading)}</strong></p>`,
          body,
          '</div>',
        ].join('');
      }

      if (normalisedName === 'status') {
        const statusText =
          cleanUserFacingName(extractMacroParameter(macroMarkup, 'title')) ||
          cleanUserFacingName(extractMacroParameter(macroMarkup, 'text')) ||
          'Status';
        return `<span data-dh-node-type="status">[Status: ${escapeHtml(statusText)}]</span>`;
      }

      if (normalisedName === 'expand') {
        const title = cleanUserFacingName(extractMacroParameter(macroMarkup, 'title')) || 'Details';
        const body = extractMacroBody(macroMarkup);
        return [
          '<div data-dh-node-type="expand">',
          `<p>[Expand: ${escapeHtml(title)}]</p>`,
          body,
          '</div>',
        ].join('');
      }

      return createRawFallbackHtml(macroMarkup, {
        type: 'Structured macro',
        name: titleCaseStorageName(name),
      });
    }
  );
}

function expandUnsupportedStorageNodes(html) {
  return String(html || '')
    .replace(/<ac:(?:adf-extension|bodied-extension|extension)\b[\s\S]*?<\/ac:(?:adf-extension|bodied-extension|extension)>/gi, (match) =>
      createRawFallbackHtml(match, {
        type: 'Extension',
        name: titleCaseStorageName(extractAttr(match, ['ac:name', 'name'])),
      })
    )
    .replace(/<ri:user\b[^>]*\/?>/gi, () => '<span data-dh-node-type="mention">[Mention]</span>')
    .replace(/<ri:date\b[^>]*(?:ri:value|value)=["']([^"']+)["'][^>]*\/?>/gi, (_match, value) =>
      `<time datetime="${escapeHtml(value)}">${escapeHtml(value)}</time>`
    );
}

export function prepareConfluenceHtml(html, baseUrl, attachmentsByFilename = {}) {
  if (!html) return '';

  const expandedStorage = expandWhiteboardAnchors(
    expandUnsupportedStorageNodes(
      expandKnownStructuredMacros(
        expandConfluenceTaskLists(
          expandAdfNodes(expandConfluenceLinks(expandConfluenceCodeMacros(html), baseUrl))
        )
      )
    )
  )
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
    'DETAILS',
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
    'INS',
    'LI',
    'MARK',
    'OL',
    'P',
    'PRE',
    'S',
    'SPAN',
    'STRONG',
    'SUMMARY',
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

function visibleTextContent(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) {
    return node ? node.textContent || '' : '';
  }

  const clone = node.cloneNode(true);

  // The raw inspector is deliberately visible to a developer on demand, but it
  // must not affect normal diff text or leak internal identifiers into the
  // user-facing preview.
  Array.from(clone.querySelectorAll('[data-dh-raw-inspector], [data-dh-task-marker]')).forEach(
    (internalNode) => internalNode.remove()
  );

  return clone.textContent || '';
}

function normaliseBlockText(node) {
  if (
    node &&
    node.nodeType === Node.ELEMENT_NODE &&
    (node.getAttribute('data-dh-node-type') === 'code_block' || /^pre|code$/i.test(node.tagName))
  ) {
    return normaliseLineEndings(node.textContent || '').trimEnd();
  }

  return visibleTextContent(node).replace(/\s+/g, ' ').trim();
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
  return /^(p|h[1-6]|li|blockquote|td|th)$/i.test(tag || '');
}

function getComparableNodeType(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return 'paragraph';

  const explicitNodeType = node.getAttribute('data-dh-node-type');
  if (explicitNodeType) return explicitNodeType;

  const tag = node.tagName.toLowerCase();
  if (/^h[1-6]$/.test(tag)) return 'heading';
  if (tag === 'li') return 'list_item';
  if (tag === 'blockquote') return 'blockquote';
  if (tag === 'td' || tag === 'th') return 'table_cell';
  if (tag === 'table') return 'table';
  if (tag === 'pre' || tag === 'code') return 'code_block';
  if (tag === 'img') return 'image';
  return 'paragraph';
}

function extractBlockMeta(node, options = {}) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = normaliseBlockText(node);
    const html = options.html || (text ? `<p>${escapeHtml(text)}</p>` : '');

    return {
      key: text,
      html,
      renderedHtml: options.renderedHtml || html,
      tag: 'p',
      nodeType: 'paragraph',
      text,
      canInlineDiff: Boolean(text),
    };
  }

  const tag = node.tagName.toLowerCase();
  const nodeType = getComparableNodeType(node);
  const text = normaliseBlockText(node);
  const html = options.html || node.outerHTML;
  const renderedHtml = options.renderedHtml || node.outerHTML;
  const taskStatus = nodeType === 'task_item' ? node.getAttribute('data-dh-task-status') || '' : '';
  const hasNonTextMedia = Boolean(
    node.querySelector && node.querySelector('img, table, hr, iframe, video, audio')
  );
  const key =
    nodeType === 'unsupported'
      ? `unsupported:${hashString(options.rawHtml || html)}`
      : nodeType === 'task_item'
        ? `task_item:${taskStatus}:${text}`
        : stableHtmlSignature(node);

  return {
    key,
    html,
    renderedHtml,
    rawHtml: options.rawHtml || html,
    tag,
    nodeType,
    text,
    taskStatus,
    supportLevel: nodeType === 'unsupported' ? 'raw' : 'full',
    rawPreview: nodeType === 'unsupported' ? options.rawHtml || html : undefined,
    canInlineDiff:
      nodeType !== 'code_block' &&
      nodeType !== 'unsupported' &&
      isTextDiffableTag(tag) &&
      text &&
      !hasNonTextMedia,
  };
}

function wrapListItemHtml(listTag, itemHtml) {
  return `<${listTag}>${itemHtml}</${listTag}>`;
}

function hasBlockElementChildren(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;

  return Array.from(node.children).some((child) =>
    /^(p|div|section|h[1-6]|ul|ol|li|table|blockquote|pre|figure|hr|ac:layout|ac:layout-section|ac:layout-cell)$/i.test(child.tagName)
  );
}

function isTransparentContainer(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;

  const tag = node.tagName.toLowerCase();
  if (node.getAttribute('data-dh-node-type')) return false;
  if (tag === 'div' || tag === 'section' || tag === 'main' || tag === 'article') {
    return hasBlockElementChildren(node);
  }

  return false;
}

function isRawTransparentContainer(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;

  const tag = node.tagName.toLowerCase();

  if (/^(p|h[1-6]|ul|ol|li|table|blockquote|pre|figure|hr)$/i.test(tag)) return false;
  if (/^ac:(layout|layout-section|layout-cell)$/i.test(tag)) return true;
  if (/^(ac|ri):/i.test(tag)) return false;

  return hasBlockElementChildren(node);
}

function collectRawBlockNodes(node) {
  if (!node) return [];
  if (node.nodeType === Node.TEXT_NODE) return normaliseBlockText(node) ? [node] : [];
  if (node.nodeType !== Node.ELEMENT_NODE) return [];

  if (isRawTransparentContainer(node)) {
    return Array.from(node.childNodes).flatMap(collectRawBlockNodes);
  }

  return [node];
}

function extractRawListItemHtmls(rawHtml, listTag, expectedCount) {
  if (!rawHtml) return [];

  if (/<ac:task-list\b/i.test(rawHtml)) {
    const taskItems = [];
    const taskRe = /<ac:task\b[^>]*>[\s\S]*?<\/ac:task>/gi;
    let match = taskRe.exec(rawHtml);

    while (match) {
      taskItems.push(`<ac:task-list>${match[0]}</ac:task-list>`);
      match = taskRe.exec(rawHtml);
    }

    return taskItems.length === expectedCount ? taskItems : [];
  }

  const rawDoc = new DOMParser().parseFromString(rawHtml, 'text/html');
  const list = rawDoc.body.querySelector(listTag);
  if (!list) return [];

  const items = Array.from(list.children).filter((child) => /^li$/i.test(child.tagName));
  if (items.length !== expectedCount) return [];

  return items.map((item) => wrapListItemHtml(listTag, item.outerHTML));
}

function extractComparableBlocksFromPreparedNode(node, rawHtml) {
  if (isTransparentContainer(node)) {
    return Array.from(node.childNodes)
      .filter((child) => child.nodeType === Node.ELEMENT_NODE || normaliseBlockText(child))
      .flatMap((child) => extractComparableBlocksFromPreparedNode(child, getNodeOuterHtml(child)));
  }

  if (node.nodeType === Node.ELEMENT_NODE && /^(ul|ol)$/i.test(node.tagName)) {
    const listTag = node.tagName.toLowerCase();
    const items = Array.from(node.children).filter((child) => /^li$/i.test(child.tagName));

    if (items.length) {
      const rawItemHtmls = extractRawListItemHtmls(rawHtml, listTag, items.length);

      return items.map((item) => {
        const itemHtml = wrapListItemHtml(listTag, item.outerHTML);
        const reconstructionHtml = rawItemHtmls.length ? rawItemHtmls.shift() : itemHtml;

        return extractBlockMeta(item, {
          html: reconstructionHtml,
          renderedHtml: itemHtml,
          rawHtml: reconstructionHtml,
        });
      });
    }
  }

  const renderedHtml = getNodeOuterHtml(node);
  return [
    extractBlockMeta(node, {
      html: rawHtml || renderedHtml,
      renderedHtml,
      rawHtml: rawHtml || renderedHtml,
    }),
  ];
}

function extractDiffBlocks(html, baseUrl, attachmentsByFilename) {
  const rawDoc = new DOMParser().parseFromString(html || '', 'text/html');
  const rawBlocks = Array.from(rawDoc.body.childNodes)
    .filter((node) => node.nodeType === Node.ELEMENT_NODE || normaliseBlockText(node))
    .flatMap(collectRawBlockNodes);

  return rawBlocks
    .flatMap((rawNode) => {
      const rawHtml = getNodeOuterHtml(rawNode);
      const prepared = prepareConfluenceHtml(rawHtml, baseUrl, attachmentsByFilename);
      const preparedDoc = new DOMParser().parseFromString(prepared, 'text/html');

      return Array.from(preparedDoc.body.childNodes)
        .filter((node) => node.nodeType === Node.ELEMENT_NODE || normaliseBlockText(node))
        .flatMap((node) => extractComparableBlocksFromPreparedNode(node, rawHtml));
    })
    .filter((block) => block.html);
}

function createDiffSummary(overrides = {}) {
  return {
    added: 0,
    removed: 0,
    addedBlocks: 0,
    removedBlocks: 0,
    modifiedBlocks: 0,
    unchangedBlocks: 0,
    limited: false,
    ...overrides,
  };
}

function renderDiffBlock(block) {
  if (block.type === 'same') return block.renderedHtml || block.html;

  const html =
    block.renderedHtml ||
    block.newRenderedHtml ||
    block.oldRenderedHtml ||
    block.newHtml ||
    block.oldHtml ||
    block.html ||
    '';
  return `<div class="dh-rich-diff-block dh-rich-diff-block--${block.type}">${html}</div>`;
}

function makeSameBlock(block) {
  return {
    type: 'same',
    tag: block.tag,
    nodeType: block.nodeType,
    text: block.text,
    html: block.html,
    renderedHtml: block.renderedHtml,
    taskStatus: block.taskStatus,
    supportLevel: block.supportLevel,
    rawPreview: block.rawPreview,
  };
}

function makeAddedBlock(block) {
  return {
    type: 'added',
    tag: block.tag,
    nodeType: block.nodeType,
    text: block.text,
    newHtml: block.html,
    renderedHtml: block.renderedHtml || block.html,
    taskStatus: block.taskStatus,
    supportLevel: block.supportLevel,
    rawPreview: block.rawPreview,
    added: 1,
    removed: 0,
  };
}

function makeRemovedBlock(block) {
  return {
    type: 'removed',
    tag: block.tag,
    nodeType: block.nodeType,
    text: block.text,
    oldHtml: block.html,
    renderedHtml: block.renderedHtml || block.html,
    taskStatus: block.taskStatus,
    supportLevel: block.supportLevel,
    rawPreview: block.rawPreview,
    added: 0,
    removed: 1,
  };
}

function buildDiffResult(blocks, summaryOverrides = {}) {
  const summary = createDiffSummary(summaryOverrides);

  // The UI still renders HTML for the rich Confluence preview, but the
  // structured block list is the stable contract for counters, chips, and any
  // future component-based rendering. Keeping both outputs avoids a risky UI
  // rewrite while making the diff result easier for the frontend to consume.
  blocks.forEach((block) => {
    if (block.type === 'same') summary.unchangedBlocks++;
    if (block.type === 'added') summary.addedBlocks++;
    if (block.type === 'removed') summary.removedBlocks++;
    if (block.type === 'modified') summary.modifiedBlocks++;

    summary.added += block.added || 0;
    summary.removed += block.removed || 0;
    summary.limited = summary.limited || Boolean(block.limited);
  });

  return {
    html: blocks.map(renderDiffBlock).join(''),
    blocks,
    summary,
    added: summary.added,
    removed: summary.removed,
    limited: summary.limited,
  };
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

function renderInlineParts(parts) {
  return parts
    .map((part) => {
      if (part.type === 'same') return escapeHtml(part.text);
      const tag = part.type === 'removed' ? 'del' : 'ins';
      return `<${tag} class="dh-rich-diff-inline dh-rich-diff-inline--${part.type}">${escapeHtml(
        part.text
      )}</${tag}>`;
    })
    .join('');
}

function countMeaningfulUnits(text) {
  return splitInlineDiffUnits(text).filter((unit) => unit.trim()).length;
}

function splitSentenceUnits(text) {
  const value = normaliseLineEndings(text);
  if (!value) return [];

  if (value.includes('\n')) {
    const lines = value.split('\n');
    return lines
      .map((line, index) => (index < lines.length - 1 ? `${line}\n` : line))
      .filter((line) => line.length > 0);
  }

  return (
    value.match(/[^.!?。！？；;]+[.!?。！？；;]?\s*|[^\s]+/g) || [value]
  ).filter((unit) => unit.length > 0);
}

function canInlineDiffText(oldText, newText, maxCells) {
  const oldUnits = splitInlineDiffUnits(oldText);
  const newUnits = splitInlineDiffUnits(newText);
  return oldUnits.length * newUnits.length <= maxCells;
}

function appendDiffParts(target, parts) {
  parts.forEach((part) => appendInlinePart(target, part.type, part.text));
}

function buildCoarseTextDiff(oldText, newText) {
  const oldUnits = splitSentenceUnits(oldText);
  const newUnits = splitSentenceUnits(newText);
  const oldCount = oldUnits.length;
  const newCount = newUnits.length;
  const maxCells = 240000;
  const inlineMaxCells = 80000;

  if (!oldCount && !newCount) {
    return { html: '', parts: [], added: 0, removed: 0, limited: false };
  }

  if (oldCount * newCount > maxCells) {
    return {
      html: escapeHtml(newText),
      parts: [{ type: 'same', text: newText }],
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
  let limited = false;
  let i = 0;
  let j = 0;

  while (i < oldCount && j < newCount) {
    if (oldUnits[i] === newUnits[j]) {
      appendInlinePart(parts, 'same', oldUnits[i]);
      i++;
      j++;
    } else if (
      textSimilarity(oldUnits[i], newUnits[j]) >= 0.35 &&
      canInlineDiffText(oldUnits[i], newUnits[j], inlineMaxCells)
    ) {
      const inline = buildInlineTextDiff(oldUnits[i], newUnits[j], {
        allowCoarseFallback: false,
      });
      appendDiffParts(parts, inline.parts);
      added += inline.added;
      removed += inline.removed;
      limited = limited || inline.limited;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      appendInlinePart(parts, 'removed', oldUnits[i]);
      removed += countMeaningfulUnits(oldUnits[i]);
      i++;
    } else {
      appendInlinePart(parts, 'added', newUnits[j]);
      added += countMeaningfulUnits(newUnits[j]);
      j++;
    }
  }

  while (i < oldCount) {
    appendInlinePart(parts, 'removed', oldUnits[i]);
    removed += countMeaningfulUnits(oldUnits[i]);
    i++;
  }

  while (j < newCount) {
    appendInlinePart(parts, 'added', newUnits[j]);
    added += countMeaningfulUnits(newUnits[j]);
    j++;
  }

  return {
    html: renderInlineParts(parts),
    parts,
    added,
    removed,
    limited,
  };
}

function buildInlineTextDiff(oldText, newText, options = {}) {
  const oldUnits = splitInlineDiffUnits(oldText);
  const newUnits = splitInlineDiffUnits(newText);
  const oldCount = oldUnits.length;
  const newCount = newUnits.length;
  const maxCells = 80000;
  const allowCoarseFallback = options.allowCoarseFallback !== false;

  if (!oldCount && !newCount) {
    return { html: '', parts: [], added: 0, removed: 0, limited: false };
  }

  if (oldCount * newCount > maxCells) {
    if (allowCoarseFallback) {
      return buildCoarseTextDiff(oldText, newText);
    }

    return {
      html: escapeHtml(newText),
      parts: [{ type: 'same', text: newText }],
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
    html: renderInlineParts(parts),
    parts,
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
  if (oldBlock.nodeType === 'table' && currentBlock.nodeType === 'table') return true;
  if (oldBlock.nodeType === 'code_block' && currentBlock.nodeType === 'code_block') return true;
  if (
    ['paragraph', 'heading', 'panel', 'blockquote', 'unsupported'].includes(oldBlock.nodeType) ||
    ['paragraph', 'heading', 'panel', 'blockquote', 'unsupported'].includes(currentBlock.nodeType)
  ) {
    return false;
  }
  if (!oldBlock.canInlineDiff || !currentBlock.canInlineDiff) return false;
  if (oldBlock.tag !== currentBlock.tag) return false;
  return textSimilarity(oldBlock.text, currentBlock.text) >= 0.25;
}

function renderCodeDiffLines(segments) {
  const html = segments
    .map((segment) =>
      segment.lines
        .map((line) => {
          const className = `dh-code-diff-line dh-code-diff-line--${segment.type}`;
          return `<span class="${className}">${escapeHtml(line)}</span>`;
        })
        .join('\n')
    )
    .join('\n');

  return `<pre data-dh-node-type="code_block"><code>${html}</code></pre>`;
}

function buildCodeBlockDiff(oldBlock, currentBlock) {
  const lineDiff = buildLineDiff(oldBlock.text, currentBlock.text);
  const inline = [];

  lineDiff.segments.forEach((segment) => {
    segment.lines.forEach((line, index) => {
      appendInlinePart(inline, segment.type === 'same' ? 'same' : segment.type, line);
      if (index < segment.lines.length - 1) {
        appendInlinePart(inline, 'same', '\n');
      }
    });
  });

  return {
    type: 'modified',
    tag: currentBlock.tag,
    nodeType: 'code_block',
    oldText: oldBlock.text,
    newText: currentBlock.text,
    oldHtml: oldBlock.html,
    newHtml: currentBlock.html,
    renderedHtml: renderCodeDiffLines(lineDiff.segments),
    inline,
    added: lineDiff.added,
    removed: lineDiff.removed,
    limited: lineDiff.limited,
  };
}

function extractTableRows(html) {
  const doc = new DOMParser().parseFromString(html || '', 'text/html');
  const table = doc.body.querySelector('table');
  if (!table) return [];

  return Array.from(table.querySelectorAll('tr')).map((row, rowIndex) => {
    const cells = Array.from(row.children)
      .filter((cell) => /^(td|th)$/i.test(cell.tagName))
      .map((cell, colIndex) => ({
        rowIndex,
        colIndex,
        tag: cell.tagName.toLowerCase(),
        text: normaliseBlockText(cell),
        html: cell.innerHTML,
      }));

    return { rowIndex, cells };
  });
}

function haveSameTableShape(oldRows, currentRows) {
  if (!oldRows.length || !currentRows.length) return false;
  if (oldRows.length !== currentRows.length) return false;

  return oldRows.every((oldRow, rowIndex) => {
    const currentRow = currentRows[rowIndex];
    return currentRow && oldRow.cells.length === currentRow.cells.length;
  });
}

function countTableCells(rows) {
  return rows.reduce((total, row) => total + row.cells.length, 0);
}

function buildCellLevelTableDiff(oldBlock, currentBlock, oldRows, currentRows) {
  const doc = new DOMParser().parseFromString(currentBlock.html || '', 'text/html');
  const table = doc.body.querySelector('table');
  let added = 0;
  let removed = 0;
  let limited = false;
  const changedCells = [];

  if (!table) {
    return null;
  }

  table.classList.add('dh-table-diff', 'dh-table-diff--cell-level');

  Array.from(table.querySelectorAll('tr')).forEach((row, rowIndex) => {
    const currentCells = Array.from(row.children).filter((cell) => /^(td|th)$/i.test(cell.tagName));

    currentCells.forEach((cell, colIndex) => {
      const oldCell = oldRows[rowIndex] && oldRows[rowIndex].cells[colIndex];
      const currentCell = currentRows[rowIndex] && currentRows[rowIndex].cells[colIndex];

      if (!oldCell || !currentCell || oldCell.text === currentCell.text) return;

      const inline = buildInlineTextDiff(oldCell.text, currentCell.text);
      cell.classList.add('dh-table-cell-diff', 'dh-table-cell-diff--modified');
      cell.innerHTML = inline.html || escapeHtml(currentCell.text);
      added += inline.added;
      removed += inline.removed;
      limited = limited || inline.limited;
      changedCells.push({
        rowIndex,
        colIndex,
        oldText: oldCell.text,
        newText: currentCell.text,
        inline: inline.parts,
      });
    });
  });

  return {
    type: 'modified',
    tag: currentBlock.tag,
    nodeType: 'table',
    oldText: oldBlock.text,
    newText: currentBlock.text,
    oldHtml: oldBlock.html,
    newHtml: currentBlock.html,
    renderedHtml: table.outerHTML,
    inline: [],
    tableDiff: {
      mode: 'cell_level',
      changedCells,
      rows: currentRows.length,
      cells: countTableCells(currentRows),
    },
    added,
    removed,
    limited,
  };
}

function buildSideBySideTableDiff(oldBlock, currentBlock, oldRows, currentRows) {
  return {
    type: 'modified',
    tag: currentBlock.tag,
    nodeType: 'table',
    oldText: oldBlock.text,
    newText: currentBlock.text,
    oldHtml: oldBlock.html,
    newHtml: currentBlock.html,
    renderedHtml: [
      '<div class="dh-table-diff-pair">',
      '<div class="dh-table-diff-panel dh-table-diff-panel--removed">',
      '<div class="dh-table-diff-label">Previous table</div>',
      oldBlock.html,
      '</div>',
      '<div class="dh-table-diff-panel dh-table-diff-panel--added">',
      '<div class="dh-table-diff-label">Current table</div>',
      currentBlock.html,
      '</div>',
      '</div>',
    ].join(''),
    inline: [],
    tableDiff: {
      mode: 'side_by_side',
      reason: 'table shape changed',
      oldRows: oldRows.length,
      currentRows: currentRows.length,
      oldCells: countTableCells(oldRows),
      currentCells: countTableCells(currentRows),
    },
    added: 1,
    removed: 1,
    limited: false,
  };
}

function buildTableDiff(oldBlock, currentBlock) {
  const oldRows = extractTableRows(oldBlock.html);
  const currentRows = extractTableRows(currentBlock.html);

  if (haveSameTableShape(oldRows, currentRows)) {
    const cellLevelDiff = buildCellLevelTableDiff(oldBlock, currentBlock, oldRows, currentRows);
    if (cellLevelDiff) return cellLevelDiff;
  }

  return buildSideBySideTableDiff(oldBlock, currentBlock, oldRows, currentRows);
}

function buildModifiedBlockDiff(oldBlock, currentBlock) {
  if (oldBlock.nodeType === 'table' && currentBlock.nodeType === 'table') {
    return buildTableDiff(oldBlock, currentBlock);
  }

  if (oldBlock.nodeType === 'code_block' && currentBlock.nodeType === 'code_block') {
    return buildCodeBlockDiff(oldBlock, currentBlock);
  }

  if (oldBlock.nodeType === 'task_item' && currentBlock.nodeType === 'task_item') {
    return buildTaskItemDiff(oldBlock, currentBlock);
  }

  if (
    ['paragraph', 'heading', 'list_item', 'panel', 'blockquote', 'unsupported'].includes(
      oldBlock.nodeType
    ) ||
    ['paragraph', 'heading', 'list_item', 'panel', 'blockquote', 'unsupported'].includes(
      currentBlock.nodeType
    )
  ) {
    return buildBlockLevelModifiedDiff(oldBlock, currentBlock);
  }

  const inlineDiff = buildInlineTextDiff(oldBlock.text, currentBlock.text);
  return {
    type: 'modified',
    tag: currentBlock.tag,
    nodeType: currentBlock.nodeType,
    oldText: oldBlock.text,
    newText: currentBlock.text,
    oldHtml: oldBlock.html,
    newHtml: currentBlock.html,
    oldRenderedHtml: oldBlock.renderedHtml || oldBlock.html,
    newRenderedHtml: currentBlock.renderedHtml || currentBlock.html,
    renderedHtml: renderBlockWithInlineDiff(currentBlock, inlineDiff.html),
    inline: inlineDiff.parts,
    added: inlineDiff.added,
    removed: inlineDiff.removed,
    limited: inlineDiff.limited,
  };
}

function buildBlockLevelModifiedDiff(oldBlock, currentBlock) {
  return {
    type: 'modified',
    tag: currentBlock.tag,
    nodeType: currentBlock.nodeType,
    oldText: oldBlock.text,
    newText: currentBlock.text,
    oldHtml: oldBlock.html,
    newHtml: currentBlock.html,
    oldRenderedHtml: oldBlock.renderedHtml || oldBlock.html,
    newRenderedHtml: currentBlock.renderedHtml || currentBlock.html,
    renderedHtml: currentBlock.renderedHtml || currentBlock.html,
    inline: [],
    supportLevel: currentBlock.supportLevel || oldBlock.supportLevel,
    rawPreview: currentBlock.rawPreview || oldBlock.rawPreview,
    added: oldBlock.text === currentBlock.text ? 0 : 1,
    removed: oldBlock.text === currentBlock.text ? 0 : 1,
    limited: false,
  };
}

function buildTaskItemDiff(oldBlock, currentBlock) {
  const textChanged = oldBlock.text !== currentBlock.text;
  const statusChanged = oldBlock.taskStatus !== currentBlock.taskStatus;

  return {
    ...buildBlockLevelModifiedDiff(oldBlock, currentBlock),
    nodeType: 'task_item',
    taskDiff: {
      oldStatus: oldBlock.taskStatus || 'incomplete',
      newStatus: currentBlock.taskStatus || 'incomplete',
      statusChanged,
      textChanged,
    },
    added: textChanged || statusChanged ? 1 : 0,
    removed: textChanged || statusChanged ? 1 : 0,
  };
}

function canCoalesceReplacementBlocks(removedBlock, addedBlock) {
  if (!removedBlock || !addedBlock) return false;
  if (removedBlock.type !== 'removed' || addedBlock.type !== 'added') return false;

  // A replacement should occupy the same structural role in the page. This
  // prevents an adjacent paragraph and image, for example, from becoming one
  // decision merely because the LCS traversal emitted them next to each other.
  if (
    removedBlock.nodeType !== addedBlock.nodeType ||
    removedBlock.tag !== addedBlock.tag
  ) {
    return false;
  }

  return (
    isTextDiffableTag(removedBlock.tag) ||
    removedBlock.nodeType === 'table' ||
    removedBlock.nodeType === 'code_block'
  );
}

function coalesceReplacementBlocks(blocks) {
  const coalesced = [];

  for (let index = 0; index < blocks.length; index++) {
    const removedBlock = blocks[index];
    const addedBlock = blocks[index + 1];

    if (!canCoalesceReplacementBlocks(removedBlock, addedBlock)) {
      coalesced.push(removedBlock);
      continue;
    }

    // The LCS algorithm represents a low-similarity edit, such as changing
    // "456456" to "123456", as one removal followed by one addition. Rebuild
    // those two output blocks as a single internal modification so the UI can
    // present one atomic old-versus-current choice while still displaying only
    // GitHub-style "-" and "+" rows.
    const oldComparableBlock = {
      tag: removedBlock.tag,
      nodeType: removedBlock.nodeType,
      text: removedBlock.text,
      html: removedBlock.oldHtml,
      renderedHtml: removedBlock.renderedHtml,
      taskStatus: removedBlock.taskStatus,
      supportLevel: removedBlock.supportLevel,
      rawPreview: removedBlock.rawPreview,
      canInlineDiff: isTextDiffableTag(removedBlock.tag),
    };
    const currentComparableBlock = {
      tag: addedBlock.tag,
      nodeType: addedBlock.nodeType,
      text: addedBlock.text,
      html: addedBlock.newHtml,
      renderedHtml: addedBlock.renderedHtml,
      taskStatus: addedBlock.taskStatus,
      supportLevel: addedBlock.supportLevel,
      rawPreview: addedBlock.rawPreview,
      canInlineDiff: isTextDiffableTag(addedBlock.tag),
    };

    coalesced.push(buildModifiedBlockDiff(oldComparableBlock, currentComparableBlock));
    index++;
  }

  return coalesced;
}

export function buildRichTextDiffHtml(oldHtml, currentHtml, baseUrl, attachmentsByFilename = {}) {
  const oldBlocks = extractDiffBlocks(oldHtml, baseUrl, attachmentsByFilename);
  const currentBlocks = extractDiffBlocks(currentHtml, baseUrl, attachmentsByFilename);
  const oldCount = oldBlocks.length;
  const currentCount = currentBlocks.length;
  const maxCells = 120000;

  if (!oldCount && !currentCount) {
    return buildDiffResult([]);
  }

  if (!oldCount) {
    return buildDiffResult(currentBlocks.map(makeAddedBlock));
  }

  if (!currentCount || oldCount * currentCount > maxCells) {
    if (oldCount * currentCount > maxCells) {
      return buildDiffResult(currentBlocks.map(makeSameBlock), { limited: true });
    }

    return buildDiffResult(oldBlocks.map(makeRemovedBlock));
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

  const blocks = [];
  let limited = false;
  let i = 0;
  let j = 0;

  while (i < oldCount && j < currentCount) {
    if (oldBlocks[i].key === currentBlocks[j].key) {
      blocks.push(makeSameBlock(currentBlocks[j]));
      i++;
      j++;
    } else if (
      canPairForInlineDiff(oldBlocks[i], currentBlocks[j]) &&
      dp[i + 1][j + 1] >= Math.max(dp[i + 1][j], dp[i][j + 1])
    ) {
      // Only substitute the two blocks when moving diagonally does not discard
      // a better exact match later in either version. Without this guard, an
      // inserted paragraph that resembles the following unchanged paragraph
      // can be mistaken for a replacement.
      const modified = buildModifiedBlockDiff(oldBlocks[i], currentBlocks[j]);
      blocks.push(modified);
      limited = limited || modified.limited;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      blocks.push(makeRemovedBlock(oldBlocks[i]));
      i++;
    } else {
      blocks.push(makeAddedBlock(currentBlocks[j]));
      j++;
    }
  }

  while (i < oldCount) {
    blocks.push(makeRemovedBlock(oldBlocks[i]));
    i++;
  }

  while (j < currentCount) {
    blocks.push(makeAddedBlock(currentBlocks[j]));
    j++;
  }

  return buildDiffResult(coalesceReplacementBlocks(blocks), { limited });
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
