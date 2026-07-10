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

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}

function decodeBasicHtmlEntities(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function decodeCdata(value) {
  return decodeBasicHtmlEntities(decodeBasicHtmlEntities(value))
    .replace(/^\s*<!--\s*\[CDATA\[/, '')
    .replace(/\]\]\s*-->\s*$/, '')
    .replace(/^\s*<!\[CDATA\[/, '')
    .replace(/\]\]>\s*$/, '');
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

const CONFLUENCE_COLOR_PALETTE = {
  black: '#172b4d',
  blue: '#0052cc',
  gray: '#44546f',
  grey: '#44546f',
  green: '#00875a',
  magenta: '#cd519d',
  neutral: '#44546f',
  orange: '#ff8b00',
  purple: '#6554c0',
  red: '#de350b',
  teal: '#008da6',
  white: '#ffffff',
  yellow: '#ffab00',
  'dark-blue': '#0055cc',
  'dark-green': '#216e4e',
  'dark-grey': '#44546f',
  'dark-gray': '#44546f',
  'dark-lime': '#4c6b1f',
  'dark-magenta': '#943d73',
  'dark-orange': '#a54800',
  'dark-purple': '#5e4db2',
  'dark-red': '#ae2a19',
  'dark-teal': '#206a83',
  'dark-yellow': '#7f5f01',
  'light-blue': '#e9f2ff',
  'light-green': '#dcfff1',
  'light-grey': '#f4f5f7',
  'light-gray': '#f4f5f7',
  'light-lime': '#efffd6',
  'light-magenta': '#ffecf8',
  'light-orange': '#fef1e8',
  'light-purple': '#f3f0ff',
  'light-red': '#ffedeb',
  'light-teal': '#e7f9ff',
  'light-yellow': '#fff7d6',
  'medium-gray': '#b3bac5',
};

const ATLASSIAN_DESIGN_TOKEN_COLORS = {
  '--ds-text-accent-blue': '#0052cc',
  '--ds-text-accent-blue-bolder': '#09326c',
  '--ds-text-accent-green': '#00875a',
  '--ds-text-accent-green-bolder': '#164b35',
  '--ds-text-accent-lime': '#4c6b1f',
  '--ds-text-accent-lime-bolder': '#37471f',
  '--ds-text-accent-magenta': '#943d73',
  '--ds-text-accent-magenta-bolder': '#50253f',
  '--ds-text-accent-orange': '#a54800',
  '--ds-text-accent-orange-bolder': '#702e00',
  '--ds-text-accent-purple': '#5e4db2',
  '--ds-text-accent-purple-bolder': '#352c63',
  '--ds-text-accent-red': '#ae2a19',
  '--ds-text-accent-red-bolder': '#601e16',
  '--ds-text-accent-teal': '#206a83',
  '--ds-text-accent-teal-bolder': '#164555',
  '--ds-text-accent-yellow': '#7f5f01',
  '--ds-text-accent-yellow-bolder': '#533f04',
  '--ds-background-accent-blue-subtlest': '#e9f2ff',
  '--ds-background-accent-blue-subtler': '#cce0ff',
  '--ds-background-accent-green-subtlest': '#dcfff1',
  '--ds-background-accent-green-subtler': '#baf3db',
  '--ds-background-accent-lime-subtlest': '#efffd6',
  '--ds-background-accent-lime-subtler': '#d3f1a7',
  '--ds-background-accent-magenta-subtlest': '#ffecf8',
  '--ds-background-accent-magenta-subtler': '#fdd0ec',
  '--ds-background-accent-orange-subtlest': '#fff4e6',
  '--ds-background-accent-orange-subtler': '#fedec8',
  '--ds-background-accent-purple-subtlest': '#f3f0ff',
  '--ds-background-accent-purple-subtler': '#dfd8fd',
  '--ds-background-accent-red-subtlest': '#ffedeb',
  '--ds-background-accent-red-subtler': '#ffd2cc',
  '--ds-background-accent-teal-subtlest': '#e7f9ff',
  '--ds-background-accent-teal-subtler': '#c6edfb',
  '--ds-background-accent-yellow-subtlest': '#fff7d6',
  '--ds-background-accent-yellow-subtler': '#f8e6a0',
  '--ds-background-neutral': '#f4f5f7',
  '--ds-surface': '#ffffff',
};

const ATLASSIAN_DESIGN_TOKEN_COLOR_KEYS = {
  '--ds-text-accent-blue': 'blue',
  '--ds-text-accent-blue-bolder': 'dark-blue',
  '--ds-text-accent-green': 'green',
  '--ds-text-accent-green-bolder': 'dark-green',
  '--ds-text-accent-lime': 'dark-lime',
  '--ds-text-accent-lime-bolder': 'dark-lime',
  '--ds-text-accent-magenta': 'dark-magenta',
  '--ds-text-accent-magenta-bolder': 'dark-magenta',
  '--ds-text-accent-orange': 'dark-orange',
  '--ds-text-accent-orange-bolder': 'dark-orange',
  '--ds-text-accent-purple': 'dark-purple',
  '--ds-text-accent-purple-bolder': 'dark-purple',
  '--ds-text-accent-red': 'dark-red',
  '--ds-text-accent-red-bolder': 'dark-red',
  '--ds-text-accent-teal': 'dark-teal',
  '--ds-text-accent-teal-bolder': 'dark-teal',
  '--ds-text-accent-yellow': 'dark-yellow',
  '--ds-text-accent-yellow-bolder': 'dark-yellow',
  '--ds-background-accent-blue-subtlest': 'light-blue',
  '--ds-background-accent-blue-subtler': 'light-blue',
  '--ds-background-accent-green-subtlest': 'light-green',
  '--ds-background-accent-green-subtler': 'light-green',
  '--ds-background-accent-lime-subtlest': 'light-lime',
  '--ds-background-accent-lime-subtler': 'light-lime',
  '--ds-background-accent-magenta-subtlest': 'light-magenta',
  '--ds-background-accent-magenta-subtler': 'light-magenta',
  '--ds-background-accent-orange-subtlest': 'light-orange',
  '--ds-background-accent-orange-subtler': 'light-orange',
  '--ds-background-accent-purple-subtlest': 'light-purple',
  '--ds-background-accent-purple-subtler': 'light-purple',
  '--ds-background-accent-red-subtlest': 'light-red',
  '--ds-background-accent-red-subtler': 'light-red',
  '--ds-background-accent-teal-subtlest': 'light-teal',
  '--ds-background-accent-teal-subtler': 'light-teal',
  '--ds-background-accent-yellow-subtlest': 'light-yellow',
  '--ds-background-accent-yellow-subtler': 'light-yellow',
  '--ds-background-neutral': 'light-gray',
  '--ds-surface': 'white',
};

const HEX_COLOR_KEYS = {
  '#09326c': 'dark-blue',
  '#0747a6': 'dark-blue',
  '#0049b0': 'dark-blue',
  '#0052cc': 'blue',
  '#0055cc': 'blue',
  '#0c66e4': 'blue',
  '#2684ff': 'blue',
  '#4c9aff': 'blue',
  '#b3d4ff': 'light-blue',
  '#cce0ff': 'light-blue',
  '#deebff': 'light-blue',
  '#e9f2ff': 'light-blue',
  '#164b35': 'dark-green',
  '#006644': 'dark-green',
  '#00875a': 'green',
  '#216e4e': 'dark-green',
  '#36b37e': 'green',
  '#57d9a3': 'green',
  '#abf5d1': 'light-green',
  '#baf3db': 'light-green',
  '#dcfff1': 'light-green',
  '#37471f': 'dark-lime',
  '#4c6b1f': 'dark-lime',
  '#d3f1a7': 'light-lime',
  '#efffd6': 'light-lime',
  '#50253f': 'dark-magenta',
  '#943d73': 'dark-magenta',
  '#cd519d': 'magenta',
  '#fdd0ec': 'light-magenta',
  '#ffecf8': 'light-magenta',
  '#974f0c': 'dark-orange',
  '#702e00': 'dark-orange',
  '#a54800': 'dark-orange',
  '#ff8b00': 'orange',
  '#ff991f': 'orange',
  '#ffc400': 'yellow',
  '#fedec8': 'light-orange',
  '#fef1e8': 'light-orange',
  '#fff4e6': 'light-orange',
  '#352c63': 'dark-purple',
  '#403294': 'dark-purple',
  '#5e4db2': 'dark-purple',
  '#6554c0': 'purple',
  '#dfd8fd': 'light-purple',
  '#eae6ff': 'light-purple',
  '#f3f0ff': 'light-purple',
  '#601e16': 'dark-red',
  '#bf2600': 'dark-red',
  '#ae2a19': 'dark-red',
  '#de350b': 'red',
  '#ff5630': 'red',
  '#ff7452': 'red',
  '#ff8f73': 'red',
  '#ffbdad': 'light-red',
  '#ffd2cc': 'light-red',
  '#ffedeb': 'light-red',
  '#164555': 'dark-teal',
  '#206a83': 'dark-teal',
  '#008da6': 'teal',
  '#c6edfb': 'light-teal',
  '#e6fcff': 'light-teal',
  '#e7f9ff': 'light-teal',
  '#533f04': 'dark-yellow',
  '#7f5f01': 'dark-yellow',
  '#ffab00': 'yellow',
  '#f8e6a0': 'light-yellow',
  '#fff0b3': 'light-yellow',
  '#fff7d6': 'light-yellow',
  '#172b4d': 'black',
  '#091e42': 'black',
  '#253858': 'black',
  '#42526e': 'gray',
  '#44546f': 'gray',
  '#5e6c84': 'gray',
  '#6b778c': 'gray',
  '#7a869a': 'gray',
  '#97a0af': 'gray',
  '#b3bac5': 'medium-gray',
  '#dfe1e6': 'light-gray',
  '#ebecf0': 'light-gray',
  '#f4f5f7': 'light-gray',
  '#ffffff': 'white',
};

function rgbToHexColorKey(value) {
  const match = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.exec(
    String(value || '').trim()
  );
  if (!match) return '';

  const rgb = match.slice(1, 4).map((part) => Number(part));
  if (rgb.some((part) => !Number.isFinite(part) || part < 0 || part > 255)) return '';

  const hex = `#${rgb.map((part) => part.toString(16).padStart(2, '0')).join('')}`;
  return HEX_COLOR_KEYS[hex] || '';
}

function normaliseConfluenceColorName(value) {
  return String(value || '')
    .trim()
    .replace(/^color:/i, '')
    .replace(/^background:/i, '')
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

function normaliseConfluenceColorKey(value) {
  const color = String(value || '').trim();
  if (!color) return '';

  const tokenMatch = /^var\(\s*(--ds-[^) ,]+)(?:\s*,\s*([^)]+))?\s*\)$/i.exec(color);
  if (tokenMatch) {
    const tokenKey = ATLASSIAN_DESIGN_TOKEN_COLOR_KEYS[tokenMatch[1].toLowerCase()];
    if (tokenKey) return tokenKey;
    if (tokenMatch[2]) return normaliseConfluenceColorKey(tokenMatch[2]);
  }

  const paletteKey = normaliseConfluenceColorName(color);
  if (CONFLUENCE_COLOR_PALETTE[paletteKey]) return paletteKey;

  const lowerHex = color.toLowerCase();
  if (HEX_COLOR_KEYS[lowerHex]) return HEX_COLOR_KEYS[lowerHex];

  const rgbKey = rgbToHexColorKey(color);
  if (rgbKey) return rgbKey;

  return '';
}

function normaliseCssColor(value) {
  const color = String(value || '').trim();
  if (!color) return '';

  const tokenMatch = /^var\(\s*(--ds-[^) ,]+)(?:\s*,\s*([^)]+))?\s*\)$/i.exec(color);
  if (tokenMatch) {
    const tokenColor = ATLASSIAN_DESIGN_TOKEN_COLORS[tokenMatch[1].toLowerCase()];
    if (tokenColor) return tokenColor;
    if (tokenMatch[2]) return normaliseCssColor(tokenMatch[2]);
  }

  const paletteColor = CONFLUENCE_COLOR_PALETTE[normaliseConfluenceColorName(color)];
  if (paletteColor) return paletteColor;

  if (/^#[0-9a-f]{3,8}$/i.test(color)) return color;
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(color)) {
    return color;
  }

  return '';
}

function colorDataAttr(name, value) {
  const key = normaliseConfluenceColorKey(value);
  return key ? ` ${name}="${escapeAttr(key)}"` : '';
}

function normaliseCssLength(value) {
  const length = String(value || '').trim();
  if (!length) return '';
  if (length === '0') return '0';
  if (/^\d{1,4}(?:\.\d{1,2})?(?:px|em|rem|%)$/i.test(length)) return length;
  if (/^\d{1,4}$/.test(length)) return `${length}px`;
  return '';
}

function normaliseCssKeyword(value, allowed) {
  const keyword = String(value || '').trim().toLowerCase();
  return allowed.includes(keyword) ? keyword : '';
}

function normaliseTextAlign(value) {
  const text = normaliseConfluenceColorName(value)
    .replace(/^text-align-/, '')
    .replace(/^alignment-/, '')
    .replace(/^align-/, '');

  return normaliseCssKeyword(text, ['left', 'center', 'right', 'justify']);
}

function normaliseIndentLevel(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';

  const classLikeMatch = /(?:indent|indentation)[-_ ]*(\d{1,2})/.exec(raw);
  const numericValue = classLikeMatch ? Number(classLikeMatch[1]) : Number(raw);

  if (Number.isFinite(numericValue)) {
    const level = Math.max(0, Math.min(8, Math.round(numericValue)));
    return level ? String(level) : '';
  }

  const pxMatch = /^(\d{1,4}(?:\.\d{1,2})?)px$/.exec(raw);
  if (pxMatch) {
    const level = Math.max(0, Math.min(8, Math.round(Number(pxMatch[1]) / 24)));
    return level ? String(level) : '';
  }

  const emMatch = /^(\d{1,2}(?:\.\d{1,2})?)(?:em|rem)$/.exec(raw);
  if (emMatch) {
    const level = Math.max(0, Math.min(8, Math.round(Number(emMatch[1]) / 1.5)));
    return level ? String(level) : '';
  }

  return '';
}

function setTextLayoutDataAttributes(node, { align, indent } = {}) {
  const safeAlign = normaliseTextAlign(align);
  const safeIndent = normaliseIndentLevel(indent);

  if (safeAlign) node.setAttribute('data-dh-align', safeAlign);
  if (safeIndent) node.setAttribute('data-dh-indent', safeIndent);
}

function textLayoutDataAttrs({ align, indent } = {}) {
  const attrs = [];
  const safeAlign = normaliseTextAlign(align);
  const safeIndent = normaliseIndentLevel(indent);

  if (safeAlign) attrs.push(` data-dh-align="${escapeAttr(safeAlign)}"`);
  if (safeIndent) attrs.push(` data-dh-indent="${escapeAttr(safeIndent)}"`);

  return attrs.join('');
}

function textLayoutDataAttrsFromMarkup(markup) {
  const align =
    extractAdfAttribute(markup, ['textAlign', 'align', 'alignment', 'text-align']) ||
    extractLooseField(markup, ['textAlign', 'align', 'alignment', 'text-align']) ||
    extractAttr(markup, ['data-dh-align', 'data-align', 'data-alignment', 'data-text-align', 'align']);
  const indent =
    extractAdfAttribute(markup, ['indentation', 'indent', 'level']) ||
    extractLooseField(markup, ['indentation', 'indent', 'level']) ||
    extractAttr(markup, ['data-dh-indent', 'data-indent', 'data-indentation', 'indent']);

  return textLayoutDataAttrs({ align, indent });
}

function safeStyleDeclarations(styleText) {
  const declarations = [];

  // The app renders Confluence storage HTML with dangerouslySetInnerHTML in a
  // Custom UI iframe. That is fine only if we aggressively reduce style
  // attributes to a small allow-list that supports page fidelity without
  // allowing script URLs, fixed positioning, overlays, or layout escape hatches.
  String(styleText || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const colonIndex = part.indexOf(':');
      if (colonIndex === -1) return;

      const property = part.slice(0, colonIndex).trim().toLowerCase();
      const value = part.slice(colonIndex + 1).trim();
      let safeValue = '';

      if (property === 'color' || property === 'background' || property === 'background-color' || property === 'border-color') {
        safeValue = normaliseCssColor(value);
      } else if (property === 'text-align') {
        safeValue = normaliseCssKeyword(value, ['left', 'center', 'right', 'justify']);
      } else if (property === 'vertical-align') {
        safeValue = normaliseCssKeyword(value, ['top', 'middle', 'bottom', 'baseline']);
      } else if (['width', 'height', 'max-width', 'min-width', 'margin-left', 'padding-left'].includes(property)) {
        safeValue = normaliseCssLength(value);
      }

      if (safeValue) declarations.push(`${property}: ${safeValue}`);
    });

  return declarations;
}

function styleAttr(declarations) {
  const safeDeclarations = Array.isArray(declarations)
    ? declarations.filter(Boolean)
    : safeStyleDeclarations(declarations);

  return safeDeclarations.length ? ` style="${escapeAttr(safeDeclarations.join('; '))}"` : '';
}

function appendSafeStyle(existingStyle, extraDeclarations) {
  return [...safeStyleDeclarations(existingStyle), ...extraDeclarations.filter(Boolean)].join('; ');
}

function applySafeColorDataAttribute(node, attrName, value) {
  const colorKey = normaliseConfluenceColorKey(value);
  if (!colorKey) return false;

  node.setAttribute(attrName, colorKey);
  return true;
}

function styleDeclarationsWithoutColor(styleText) {
  return safeStyleDeclarations(styleText).filter((declaration) => {
    const property = declaration.split(':')[0].trim().toLowerCase();
    return !['color', 'background', 'background-color', 'border-color', 'text-align', 'margin-left', 'padding-left'].includes(property);
  });
}

function applyColorDeclarationsFromStyle(node, styleText) {
  String(styleText || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const colonIndex = part.indexOf(':');
      if (colonIndex === -1) return;

      const property = part.slice(0, colonIndex).trim().toLowerCase();
      const value = part.slice(colonIndex + 1).trim();

      if (property === 'color') {
        applySafeColorDataAttribute(node, 'data-dh-text-color', value);
      } else if (property === 'background' || property === 'background-color') {
        applySafeColorDataAttribute(node, 'data-dh-bg-color', value);
      } else if (property === 'border-color') {
        applySafeColorDataAttribute(node, 'data-dh-border-color', value);
      }
    });
}

function applyTextLayoutDeclarationsFromStyle(node, styleText) {
  safeStyleDeclarations(styleText).forEach((declaration) => {
    const colonIndex = declaration.indexOf(':');
    if (colonIndex === -1) return;

    const property = declaration.slice(0, colonIndex).trim().toLowerCase();
    const value = declaration.slice(colonIndex + 1).trim();

    if (property === 'text-align') {
      setTextLayoutDataAttributes(node, { align: value });
    } else if (property === 'margin-left' || property === 'padding-left') {
      setTextLayoutDataAttributes(node, { indent: value });
    }
  });
}

function applyTextLayoutHintsFromClass(node, className) {
  const text = normaliseConfluenceColorName(className);
  const alignMatch = /(?:^|[-_ ])(?:text[-_ ]align|alignment|align)[-_ ](left|center|right|justify)(?:$|[-_ ])/.exec(text);
  const indentMatch = /(?:^|[-_ ])(?:indent|indentation)[-_ ](\d{1,2})(?:$|[-_ ])/.exec(text);

  if (alignMatch) setTextLayoutDataAttributes(node, { align: alignMatch[1] });
  if (indentMatch) setTextLayoutDataAttributes(node, { indent: indentMatch[1] });
}

function normaliseNestedIndentation(root) {
  Array.from(root.querySelectorAll('[data-dh-indent]')).forEach((node) => {
    const absoluteLevel = Number(node.getAttribute('data-dh-indent'));
    if (!Number.isFinite(absoluteLevel) || absoluteLevel <= 0) {
      node.removeAttribute('data-dh-indent');
      return;
    }

    // ADF paragraph wrappers and their HTML fallback children can both carry
    // the same absolute indentation metadata. CSS margins naturally add, so a
    // level-two wrapper containing a level-one paragraph would otherwise look
    // like level three. Earlier ancestors have already been converted to local
    // deltas, therefore their sum is the indentation currently inherited here.
    let inheritedLevel = 0;
    let ancestor = node.parentElement;

    while (ancestor && ancestor !== root) {
      const ancestorLevel = Number(ancestor.getAttribute('data-dh-indent'));
      if (Number.isFinite(ancestorLevel) && ancestorLevel > 0) {
        inheritedLevel += ancestorLevel;
      }
      ancestor = ancestor.parentElement;
    }

    const localLevel = absoluteLevel - inheritedLevel;
    if (localLevel > 0) {
      node.setAttribute('data-dh-indent', String(localLevel));
    } else {
      node.removeAttribute('data-dh-indent');
    }
  });
}

function colorKeyFromClassName(className) {
  const normalised = normaliseConfluenceColorName(className);
  const classParts = normalised.split('-');

  for (let size = 3; size >= 1; size--) {
    for (let index = 0; index <= classParts.length - size; index++) {
      const candidate = classParts.slice(index, index + size).join('-');
      if (CONFLUENCE_COLOR_PALETTE[candidate]) return candidate;
    }
  }

  return '';
}

function applyColorHintsFromClass(node, className) {
  const classes = String(className || '').split(/\s+/).filter(Boolean);

  classes.forEach((classToken) => {
    const colorKey = colorKeyFromClassName(classToken);
    if (!colorKey) return;

    const lowerClass = classToken.toLowerCase();
    if (/status|lozenge/.test(lowerClass)) {
      node.setAttribute('data-dh-status-color', normaliseStatusColor(colorKey));
    } else if (/background|highlight|mark|bg/.test(lowerClass)) {
      node.setAttribute('data-dh-bg-color', colorKey);
    } else if (/border/.test(lowerClass)) {
      node.setAttribute('data-dh-border-color', colorKey);
    } else if (/text|color|colour/.test(lowerClass)) {
      node.setAttribute('data-dh-text-color', colorKey);
    }
  });

  if (/\baui-lozenge-success\b/i.test(className)) node.setAttribute('data-dh-status-color', 'green');
  if (/\baui-lozenge-error\b/i.test(className)) node.setAttribute('data-dh-status-color', 'red');
  if (/\baui-lozenge-current\b/i.test(className)) node.setAttribute('data-dh-status-color', 'blue');
  if (/\baui-lozenge-moved\b/i.test(className)) node.setAttribute('data-dh-status-color', 'yellow');
  if (/\baui-lozenge-complete\b/i.test(className)) node.setAttribute('data-dh-status-color', 'green');
}

function formatConfluenceDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const numeric = Number(raw);
  const date =
    Number.isFinite(numeric) && raw.length >= 10
      ? new Date(raw.length <= 10 ? numeric * 1000 : numeric)
      : new Date(raw);

  if (!isNaN(date.getTime())) {
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  return raw;
}

function extractDateValueFromMarkup(markup) {
  return (
    cleanMacroDisplayText(
      extractAdfAttribute(markup, [
        'timestamp',
        'date',
        'value',
        'datetime',
        'dateTime',
        'startDate',
        'endDate',
      ])
    ) ||
    cleanMacroDisplayText(
      extractLooseField(markup, [
        'timestamp',
        'date',
        'value',
        'datetime',
        'dateTime',
        'startDate',
        'endDate',
      ])
    ) ||
    cleanMacroDisplayText(
      extractAttr(markup, [
        'ri:value',
        'value',
        'datetime',
        'data-date',
        'data-value',
        'data-timestamp',
        'timestamp',
      ])
    )
  );
}

function renderDate(value, fallbackText = '') {
  const dateValue = value || fallbackText;
  const displayDate = formatConfluenceDate(dateValue);

  if (displayDate) {
    const datetimeAttr = value ? ` datetime="${escapeAttr(value)}"` : '';
    return `<time data-dh-node-type="date"${datetimeAttr}>${escapeHtml(displayDate)}</time>`;
  }

  return fallbackText
    ? `<time data-dh-node-type="date">${escapeHtml(fallbackText)}</time>`
    : '<time data-dh-node-type="date">Date</time>';
}

function expandSelfClosingTimeTags(html) {
  return String(html || '').replace(/<time\b([^>]*)\/>/gi, (match) =>
    renderDate(extractDateValueFromMarkup(match))
  );
}

function normaliseSelfClosingTimeTagsForParsing(html) {
  return String(html || '').replace(/<time\b([^>]*)\/>/gi, '<time$1></time>');
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

function extractExactAttr(markup, attrNames) {
  for (const attrName of attrNames) {
    const escapedName = attrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?:^|\\s)${escapedName}=["']([^"']+)["']`, 'i');
    const match = re.exec(String(markup || ''));
    if (match) return match[1];
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

function extractImageCaption(markup) {
  const captionMatch = /<ac:caption\b[^>]*>([\s\S]*?)<\/ac:caption>/i.exec(markup);
  if (!captionMatch) return '';
  return stripTags(captionMatch[1]).replace(/\s+/g, ' ').trim();
}

function extractImageAltText(markup, fallback) {
  return (
    cleanUserFacingName(extractAttr(markup, ['ac:alt', 'alt', 'ac:title', 'title'])) ||
    cleanUserFacingName(fallback) ||
    fallback ||
    ''
  );
}

function extractImageStyle(markup) {
  const width = normaliseCssLength(extractExactAttr(markup, ['ac:width', 'width']));
  const height = normaliseCssLength(extractExactAttr(markup, ['ac:height', 'height']));
  const align = normaliseCssKeyword(extractAttr(markup, ['ac:align', 'align']), [
    'left',
    'center',
    'right',
  ]);
  const borderValue = extractAttr(markup, [
    'ac:border',
    'border',
    'data-border',
    'data-image-border',
  ]);
  const borderMark = /<ac:adf-mark\b[^>]*(?:key|type)=["']border["'][^>]*>/i.exec(markup);
  const internalBorderMarker = /<span\b[^>]*data-dh-image-border-marker=["']true["'][^>]*>/i.exec(
    markup
  );
  const borderMarkMarkup = borderMark
    ? borderMark[0]
    : internalBorderMarker
      ? internalBorderMarker[0]
      : '';
  const borderSizeRaw = extractAttr(borderMarkMarkup, [
    'size',
    'data-dh-image-border-size',
  ]);
  const borderSizeValue = borderSizeRaw ? Number(borderSizeRaw) : Number.NaN;
  const borderSize = Number.isFinite(borderSizeValue)
    ? Math.max(1, Math.min(5, Math.round(borderSizeValue)))
    : 0;
  const borderColor = normaliseConfluenceColorKey(
    extractAttr(borderMarkMarkup, ['color', 'colour', 'data-dh-image-border-color'])
  );
  const hasBorder =
    /^(?:true|1|yes|on|border)$/i.test(borderValue) || Boolean(borderMarkMarkup);
  const styles = [];

  if (height) styles.push(`height: ${height}`);
  if (align === 'center') {
    styles.push('margin-left: auto', 'margin-right: auto');
  }

  return {
    imageStyle: styleAttr(styles),
    imageWidth: width,
    align: align || '',
    hasBorder,
    borderSize,
    borderColor,
  };
}

function renderImageFigure({
  src,
  alt,
  caption,
  imageStyle,
  imageWidth = '',
  align,
  hasBorder = false,
  borderSize = 0,
  borderColor = '',
}) {
  if (!src) return '';

  const alignAttr = align ? ` data-dh-align="${escapeAttr(align)}"` : '';
  const borderAttr = hasBorder ? ' data-dh-image-border="true"' : '';
  const borderSizeAttr = borderSize
    ? ` data-dh-image-border-size="${escapeAttr(borderSize)}"`
    : '';
  const borderColorAttr = borderColor
    ? ` data-dh-border-color="${escapeAttr(borderColor)}"`
    : '';
  const imageWidthAttr = imageWidth
    ? ` data-dh-image-width="${escapeAttr(imageWidth)}"`
    : '';
  const numericImageWidth = /^\d+(?:\.\d+)?px$/i.test(imageWidth)
    ? String(Math.max(1, Math.round(Number.parseFloat(imageWidth))))
    : '';
  const nativeWidthAttr = numericImageWidth
    ? ` width="${escapeAttr(numericImageWidth)}"`
    : '';
  const captionHtml = caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : '';

  return [
    `<figure data-dh-node-type="image"${alignAttr}>`,
    `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt || caption || '')}"${nativeWidthAttr}${borderAttr}${borderSizeAttr}${borderColorAttr}${imageWidthAttr}${imageStyle || ''} />`,
    captionHtml,
    '</figure>',
  ].join('');
}

function normaliseStatusColor(color) {
  const key = normaliseConfluenceColorName(color);
  if (!key) return '';

  const aliases = {
    grey: 'gray',
    'light-grey': 'gray',
    'light-gray': 'gray',
    neutral: 'gray',
    default: 'gray',
    standard: 'gray',
    success: 'green',
    'dark-green': 'green',
    error: 'red',
    'dark-red': 'red',
    'dark-orange': 'orange',
    'dark-yellow': 'yellow',
    'dark-blue': 'blue',
    'dark-purple': 'purple',
    'dark-teal': 'teal',
    'dark-magenta': 'magenta',
    'dark-lime': 'lime',
    'light-blue': 'blue',
    'light-green': 'green',
    'light-red': 'red',
    'light-orange': 'orange',
    'light-yellow': 'yellow',
    'light-purple': 'purple',
    'light-teal': 'teal',
    'light-magenta': 'magenta',
    'light-lime': 'lime',
  };

  const normalised = aliases[key] || key;
  return ['gray', 'green', 'red', 'orange', 'yellow', 'blue', 'purple', 'teal', 'magenta', 'lime'].includes(
    normalised
  )
    ? normalised
    : '';
}

function renderStatus(text, color) {
  const initialText = cleanMacroDisplayText(text) || cleanUserFacingName(text);
  const normalisedColor = normaliseStatusColor(color) || normaliseStatusColor(initialText);
  const statusText =
    initialText && initialText.toLowerCase() !== 'status'
      ? initialText
      : normalisedColor
        ? normalisedColor.toUpperCase()
        : 'Status';
  const colorAttr = normalisedColor ? ` data-dh-status-color="${escapeAttr(normalisedColor)}"` : '';
  return `<span data-dh-node-type="status"${colorAttr}>${escapeHtml(statusText)}</span>`;
}

function renderDecision(body, state = '') {
  const normalisedState = /^(?:decided|done|complete|completed|true)$/i.test(state)
    ? 'decided'
    : state
      ? 'undecided'
      : '';
  const stateAttr = normalisedState
    ? ` data-dh-decision-state="${escapeAttr(normalisedState)}"`
    : '';

  return `<div data-dh-node-type="decision"${stateAttr}>${removeAdfAttributes(body)}</div>`;
}

function renderDecisionList(markup) {
  const items = [];
  const itemPattern =
    /<ac:adf-node\b[^>]*(?:type|ac:type)=["'](?:decision-item|decisionItem)["'][^>]*>([\s\S]*?)<\/ac:adf-node>/gi;
  let itemMatch = itemPattern.exec(markup);

  while (itemMatch) {
    const itemMarkup = itemMatch[0];
    const contentMatch = /<ac:adf-content\b[^>]*>([\s\S]*?)<\/ac:adf-content>/i.exec(
      itemMarkup
    );
    const content = getReadableHtmlText(contentMatch ? contentMatch[1] : '');
    const state = extractAdfAttribute(itemMarkup, ['state']);

    if (content) {
      items.push(renderDecision(escapeHtml(content), state));
    }

    itemMatch = itemPattern.exec(markup);
  }

  if (!items.length) return '';

  return `<div data-dh-node-type="decision_list">${items.join('')}</div>`;
}

function expandConfluenceLinks(html, baseUrl) {
  return html.replace(/<ac:link\b[\s\S]*?<\/ac:link>/gi, (match) => {
    const dateMatch = /<ri:date\b[^>]*\/?>/i.exec(match);
    if (dateMatch) {
      return renderDate(extractDateValueFromMarkup(dateMatch[0]));
    }

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

function normaliseCodeLanguage(value) {
  const language = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^language-/, '')
    .replace(/\s+/g, '');

  const aliases = {
    javascript: 'javascript',
    js: 'javascript',
    jsx: 'javascript',
    typescript: 'typescript',
    ts: 'typescript',
    tsx: 'typescript',
    python: 'python',
    py: 'python',
    java: 'java',
    sql: 'sql',
    html: 'html',
    xml: 'html',
    css: 'css',
  };

  return aliases[language] || language;
}

function normaliseDecodedCodeBody(value, language = '') {
  const code = String(value || '');

  if (normaliseCodeLanguage(language) !== 'html') return code;

  // Some Confluence storage responses encode an HTML code block using a
  // comment-shaped CDATA wrapper. After that wrapper is decoded, the closing
  // characters from its opening marker can occasionally remain attached to
  // the first HTML tag, for example: <section class="example"-->. This is not
  // valid source code and is only a storage-serialization artefact. Restrict
  // the repair to the first tag of HTML/XML code blocks so genuine comments,
  // JavaScript operators, and code in every other language remain untouched.
  const malformedOpening = /^(\s*<([A-Za-z][\w:-]*)(?:\s+[^<>\n]*?)?)-->/i.exec(code);
  if (!malformedOpening) return code;

  const repairedCode = code.replace(malformedOpening[0], `${malformedOpening[1]}>`);
  const rootTag = malformedOpening[2];
  const voidElements = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
  ]);

  // The same premature parsing that leaves "-->" on the opening tag can
  // consume the matching root closing tag. Only reconstruct it when this
  // precise corruption marker was present, the element is not void or
  // self-closing, and no matching closing tag survived in the code body.
  const closingTag = new RegExp(`</${rootTag}\\s*>`, 'i');
  const openingWasSelfClosing = /\/\s*$/.test(malformedOpening[1]);
  if (
    voidElements.has(rootTag.toLowerCase()) ||
    openingWasSelfClosing ||
    closingTag.test(repairedCode)
  ) {
    return repairedCode;
  }

  return `${repairedCode.replace(/\s+$/, '')}\n</${rootTag}>`;
}

function codeKeywordsForLanguage(language) {
  const common = ['false', 'null', 'true'];
  const keywordMap = {
    javascript: [
      ...common,
      'async',
      'await',
      'break',
      'case',
      'catch',
      'class',
      'const',
      'continue',
      'default',
      'else',
      'export',
      'extends',
      'finally',
      'for',
      'from',
      'function',
      'if',
      'import',
      'let',
      'new',
      'return',
      'switch',
      'throw',
      'try',
      'var',
      'while',
    ],
    typescript: [
      ...common,
      'async',
      'await',
      'class',
      'const',
      'enum',
      'export',
      'extends',
      'from',
      'function',
      'implements',
      'import',
      'interface',
      'let',
      'private',
      'protected',
      'public',
      'readonly',
      'return',
      'type',
    ],
    python: [
      ...common,
      'and',
      'as',
      'class',
      'def',
      'elif',
      'else',
      'except',
      'finally',
      'for',
      'from',
      'if',
      'import',
      'in',
      'is',
      'lambda',
      'none',
      'not',
      'or',
      'pass',
      'print',
      'return',
      'try',
      'while',
    ],
    java: [
      ...common,
      'class',
      'else',
      'extends',
      'final',
      'for',
      'if',
      'import',
      'new',
      'private',
      'protected',
      'public',
      'return',
      'static',
      'void',
      'while',
    ],
    sql: [
      'and',
      'as',
      'by',
      'create',
      'delete',
      'desc',
      'from',
      'group',
      'insert',
      'into',
      'join',
      'left',
      'limit',
      'not',
      'null',
      'or',
      'order',
      'right',
      'select',
      'set',
      'table',
      'true',
      'update',
      'where',
    ],
    css: ['background', 'background-color', 'border', 'color', 'display', 'font', 'margin', 'padding'],
  };

  return keywordMap[language] || keywordMap.javascript;
}

function codeToken(tokenType, value) {
  return `<span data-dh-code-token="${tokenType}">${escapeHtml(value)}</span>`;
}

function highlightHtmlCodeLine(line) {
  let html = '';
  let lastIndex = 0;
  const tagRe = /(<\/?)([A-Za-z][\w:-]*)([^>]*?)(\/?>)/g;
  let match = tagRe.exec(line);

  while (match) {
    html += escapeHtml(line.slice(lastIndex, match.index));
    html += `${escapeHtml(match[1])}${codeToken('tag', match[2])}`;
    html += String(match[3] || '').replace(
      /([A-Za-z_:][\w:.-]*)(=)("[^"]*"|'[^']*')/g,
      (_attrMatch, attrName, equals, attrValue) =>
        `${codeToken('attr', attrName)}${escapeHtml(equals)}${codeToken('string', attrValue)}`
    );
    html += escapeHtml(match[4]);
    lastIndex = match.index + match[0].length;
    match = tagRe.exec(line);
  }

  return html + escapeHtml(line.slice(lastIndex));
}

function highlightCssCodeLine(line) {
  let html = '';
  let lastIndex = 0;
  const tokenRe =
    /(\/\*.*?\*\/|#[0-9a-f]{3,8}\b|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\b[-a-zA-Z]+(?=\s*:)|\b\d+(?:\.\d+)?(?:px|em|rem|%)?\b)/g;
  let match = tokenRe.exec(line);

  while (match) {
    const token = match[0];
    html += escapeHtml(line.slice(lastIndex, match.index));
    if (/^\/\*/.test(token)) {
      html += codeToken('comment', token);
    } else if (/^['"]/.test(token) || /^#/.test(token)) {
      html += codeToken('string', token);
    } else if (/^\d/.test(token)) {
      html += codeToken('number', token);
    } else {
      html += codeToken('property', token);
    }
    lastIndex = match.index + token.length;
    match = tokenRe.exec(line);
  }

  return html + escapeHtml(line.slice(lastIndex));
}

function highlightGenericCodeLine(line, language) {
  const keywords = codeKeywordsForLanguage(language)
    .map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .sort((a, b) => b.length - a.length);
  const keywordSource = keywords.length ? `\\b(?:${keywords.join('|')})\\b` : '(?!)';
  const commentSource = language === 'python' ? '#.*' : language === 'sql' ? '--.*' : '\\/\\/.*';
  const tokenRe = new RegExp(
    `(${commentSource}|\\/\\*.*?\\*\\/|\`(?:\\\\.|[^\`])*\`|"(?:\\\\.|[^"])*"|'(?:\\\\.|[^'])*'|\\b\\d+(?:\\.\\d+)?\\b|${keywordSource})`,
    'gi'
  );
  let html = '';
  let lastIndex = 0;
  let match = tokenRe.exec(line);

  while (match) {
    const token = match[0];
    html += escapeHtml(line.slice(lastIndex, match.index));
    if (/^(\/\/|#|--|\/\*)/.test(token)) {
      html += codeToken('comment', token);
    } else if (/^['"`]/.test(token)) {
      html += codeToken('string', token);
    } else if (/^\d/.test(token)) {
      html += codeToken('number', token);
    } else if (/^[A-Z][\w$]*$/.test(token) && language !== 'sql') {
      html += codeToken('type', token);
    } else {
      html += codeToken('keyword', token);
    }
    lastIndex = match.index + token.length;
    match = tokenRe.exec(line);
  }

  return html + escapeHtml(line.slice(lastIndex));
}

function highlightCodeLine(line, language) {
  const normalisedLanguage = normaliseCodeLanguage(language);

  if (normalisedLanguage === 'html') return highlightHtmlCodeLine(line);
  if (normalisedLanguage === 'css') return highlightCssCodeLine(line);
  return highlightGenericCodeLine(line, normalisedLanguage);
}

function renderCodeBlockHtml(code, language = '', extraLineClass = '') {
  const lines = normaliseLineEndings(code).split('\n');
  const lineClass = extraLineClass ? ` class="${escapeAttr(extraLineClass)}"` : '';

  return lines
    .map(
      (line) =>
        `<span data-dh-code-line="true"${lineClass}><span data-dh-code-line-content="true">${escapeHtml(
          line
        )}</span></span>`
    )
    .join('');
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
      const languageValue = language ? decodeCdata(language[1]).trim() : '';
      const code = normaliseLineEndings(
        normaliseDecodedCodeBody(decodeCdata(rawBody), languageValue)
      );
      const languageAttr = language
        ? ` data-language="${escapeHtml(languageValue)}"`
        : '';
      const titleAttr = title ? ` title="${escapeHtml(decodeCdata(title[1]).trim())}"` : '';

      return `<pre data-dh-node-type="code_block" data-dh-code-enhanced="true"${languageAttr}${titleAttr}><code>${renderCodeBlockHtml(
        code,
        languageValue
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

function extractFirstMacroParameter(markup, names) {
  for (const name of names) {
    const value = cleanMacroDisplayText(extractMacroParameter(markup, name));
    if (value) return value;
  }

  return '';
}

function buildPanelStyleAttribute(macroMarkup) {
  return [
    colorDataAttr(
      'data-dh-bg-color',
      extractFirstMacroParameter(macroMarkup, ['bgColor', 'backgroundColor', 'backgroundColour'])
    ),
    colorDataAttr(
      'data-dh-border-color',
      extractFirstMacroParameter(macroMarkup, ['borderColor', 'borderColour'])
    ),
  ].join('');
}

function buildPanelTitleStyleAttribute(macroMarkup) {
  return [
    colorDataAttr(
      'data-dh-bg-color',
      extractFirstMacroParameter(macroMarkup, ['titleBGColor', 'titleBackgroundColor'])
    ),
    colorDataAttr(
      'data-dh-text-color',
      extractFirstMacroParameter(macroMarkup, ['titleColor', 'titleColour'])
    ),
  ].join('');
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

function cleanMacroDisplayText(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (/https?:\/\//i.test(text)) return '';
  if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(text)) return '';

  // Unlike generic names, macro display text is allowed to contain words such
  // as "status" (for example a Status lozenge whose text is literally STATUS).
  // Only strip obvious id-like labels instead of discarding the whole value.
  const withoutInternalLabels = text
    .replace(/\b(?:localid|local-id|macro-id|status-id|extension-key)\b\s*[:=]\s*\S+/gi, '')
    .trim();

  return withoutInternalLabels.length <= 120 ? withoutInternalLabels : '';
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

function expandAdfMarks(html) {
  return String(html || '').replace(
    /<ac:adf-mark\b[^>]*>[\s\S]*?<\/ac:adf-mark>/gi,
    (markMarkup) => {
      const markType = normaliseConfluenceColorName(
        extractAttr(markMarkup, ['type', 'ac:type', 'key', 'ac:key', 'name', 'ac:name'])
      );
      const bodyMatch = /<ac:adf-mark\b[^>]*>([\s\S]*?)<\/ac:adf-mark>/i.exec(markMarkup);
      const body = removeAdfAttributes(bodyMatch ? bodyMatch[1] : '');
      const rawColor =
        extractAdfAttribute(markMarkup, [
          'color',
          'colour',
          'textColor',
          'textColour',
          'backgroundColor',
          'backgroundColour',
          'highlightColor',
          'highlightColour',
        ]) ||
        extractAttr(markMarkup, [
          'color',
          'colour',
          'text-color',
          'text-colour',
          'background-color',
          'background-colour',
        ]);
      const colorKey = normaliseConfluenceColorKey(rawColor);
      const layoutAttrs = textLayoutDataAttrsFromMarkup(markMarkup);

      if (markType === 'border') {
        const sizeRaw = extractAttr(markMarkup, ['size']);
        const sizeValue = sizeRaw ? Number(sizeRaw) : Number.NaN;
        const safeSize = Number.isFinite(sizeValue)
          ? Math.max(1, Math.min(5, Math.round(sizeValue)))
          : 0;
        const sizeAttr = safeSize
          ? ` data-dh-image-border-size="${escapeAttr(safeSize)}"`
          : '';
        const colorAttr = colorKey
          ? ` data-dh-image-border-color="${escapeAttr(colorKey)}"`
          : '';

        // Confluence stores the image border as an empty ADF mark next to the
        // attachment. Preserve its metadata just long enough for the enclosing
        // ac:image renderer to consume it; the marker is not emitted in the
        // final user-facing HTML.
        return `<span data-dh-image-border-marker="true"${sizeAttr}${colorAttr}></span>`;
      }

      if (layoutAttrs && /align|alignment|indent|indentation/.test(markType)) {
        return `<span${layoutAttrs}>${body}</span>`;
      }

      if (!colorKey) return body;

      if (/background|highlight/.test(markType)) {
        return `<mark data-dh-bg-color="${escapeAttr(colorKey)}">${body}</mark>`;
      }

      if (/color|colour|text/.test(markType)) {
        return `<span data-dh-text-color="${escapeAttr(colorKey)}">${body}</span>`;
      }

      return body;
    }
  );
}

function extractAdfBodiedExtensionBody(markup) {
  const bodyMatch =
    /<ac:adf-node\b[^>]*(?:type|ac:type)=["'](?:bodiedExtension|multiBodiedExtension)["'][^>]*>([\s\S]*?)<\/ac:adf-node>/i.exec(
      markup
    );
  const body = bodyMatch ? removeAdfAttributes(bodyMatch[1]) : '';
  return body.replace(/<ac:adf-node\b[^>]*>[\s\S]*?<\/ac:adf-node>/gi, '').trim();
}

function extractAdfFallbackBody(markup) {
  const fallbackMatch = /<ac:adf-fallback\b[^>]*>([\s\S]*?)<\/ac:adf-fallback>/i.exec(markup);
  if (!fallbackMatch) return '';

  return removeAdfAttributes(fallbackMatch[1])
    .replace(/<\/?ac:adf-fallback\b[^>]*>/gi, '')
    .replace(/<\/?ac:adf-node\b[^>]*>/gi, '')
    .trim();
}

function extractAdfPanelFallbackBody(markup) {
  const fallbackBody = extractAdfFallbackBody(markup);
  if (!fallbackBody) return '';

  // The newer Note panel fallback contains a complete legacy panel renderer
  // inside the ADF extension. Keeping those wrapper divs would place a second
  // background and border inside the app's own panel, producing the pale box
  // around the body. Select only Confluence's explicit panelContent wrapper;
  // arbitrary divs authored inside the panel body remain untouched.
  const doc = new DOMParser().parseFromString(fallbackBody, 'text/html');
  const panelContent = doc.body.querySelector('.panelContent');

  return panelContent ? panelContent.innerHTML.trim() : fallbackBody;
}

function extractAdfPlainBody(markup) {
  return removeAdfAttributes(markup)
    .replace(/<\/?ac:adf-extension\b[^>]*>/gi, '')
    .replace(/<\/?ac:bodied-extension\b[^>]*>/gi, '')
    .replace(/<\/?ac:extension\b[^>]*>/gi, '')
    .replace(/<\/?ac:adf-fallback\b[^>]*>/gi, '')
    .replace(/<\/?ac:adf-node\b[^>]*>/gi, '')
    .trim();
}

function extractLooseField(markup, names) {
  const decoded = String(markup || '')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

  for (const name of names) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const jsonMatch = new RegExp(`["']${escapedName}["']\\s*:\\s*["']([^"']+)["']`, 'i').exec(decoded);
    if (jsonMatch) return stripTags(jsonMatch[1]);

    const xmlMatch = new RegExp(
      `<ac:adf-parameter\\b[^>]*(?:key|ac:key|name|ac:name)=["']${escapedName}["'][^>]*>([\\s\\S]*?)<\\/ac:adf-parameter>`,
      'i'
    ).exec(decoded);
    if (xmlMatch) return stripTags(decodeCdata(xmlMatch[1]));
  }

  return '';
}

function inferPanelTypeFromText(value) {
  const text = normaliseConfluenceColorName(value);
  if (/note/.test(text)) return 'note';
  if (/warning|warn/.test(text)) return 'warning';
  if (/error/.test(text)) return 'error';
  if (/success/.test(text)) return 'success';
  if (/info/.test(text)) return 'info';
  if (/custom|panel/.test(text)) return 'panel';
  return '';
}

function normalisePanelType(value) {
  const type = normaliseConfluenceColorName(value);
  if (type === 'info') return 'info';
  if (type === 'note') return 'note';
  if (type === 'warning' || type === 'warn') return 'warning';
  if (type === 'error') return 'error';
  if (type === 'success') return 'success';
  if (type === 'panel' || type === 'custom') return 'panel';
  return '';
}

function panelTypeFromStructuredMacroName(value) {
  const macroName = normaliseConfluenceColorName(value);

  // Legacy Confluence structured macro names do not use the same vocabulary
  // as the current editor's panel picker. These mappings come from the actual
  // storage emitted for each visual type on the target site; visible panel text
  // must never be used to override them.
  const legacyPanelTypes = {
    info: 'info',
    tip: 'success',
    note: 'warning',
    warning: 'error',
    panel: 'panel',
    success: 'success',
    error: 'error',
  };

  return legacyPanelTypes[macroName] || '';
}

function getReadableHtmlText(markup) {
  const text = String(markup || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|td|th|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}

function inferPanelTypeFromPanelText(title, body) {
  const text = `${cleanMacroDisplayText(title)} ${getReadableHtmlText(body)}`.trim();
  const leadingText = text.slice(0, 160);

  if (/(^|\s)(error|错误)\s*(panel|面板|:|：)/i.test(leadingText)) return 'error';
  if (/(^|\s)(warning|warn|警告)\s*(panel|面板|:|：)/i.test(leadingText)) return 'warning';
  if (/(^|\s)(success|成功)\s*(panel|面板|:|：)/i.test(leadingText)) return 'success';
  if (/(^|\s)(tip|提示)\s*(panel|面板|:|：)/i.test(leadingText)) return 'tip';
  if (/(^|\s)(note|备注|注释)\s*(panel|面板|:|：)/i.test(leadingText)) return 'note';
  if (/(^|\s)(info|信息)\s*(panel|面板|:|：)/i.test(leadingText)) return 'info';
  if (/(^|\s)(custom|自定义)\s*(panel|面板|:|：)/i.test(leadingText)) return 'panel';

  return '';
}

function panelBodyAlreadyNamesPanel(title, body, panelType) {
  const bodyText = getReadableHtmlText(body).toLowerCase();
  if (!bodyText) return false;

  const heading = cleanMacroDisplayText(title).toLowerCase();
  const typeName = titleCaseStorageName(panelType).toLowerCase();
  const knownPanelLead = /^(info|note|warning|warn|error|success|tip|custom|信息|备注|注释|警告|错误|成功|提示|自定义)\s*(panel|面板|:|：)/i;

  return (
    knownPanelLead.test(bodyText) ||
    (heading && bodyText.startsWith(heading)) ||
    (typeName && bodyText.startsWith(typeName))
  );
}

function panelTypeDisplayName(panelType) {
  const labels = {
    info: 'Info',
    note: 'Note',
    success: 'Success',
    warning: 'Warning',
    error: 'Error',
    panel: 'Custom',
  };

  return labels[panelType] || titleCaseStorageName(panelType);
}

function renderPanelBlock(panelType, title, body, extraAttrs = '') {
  const type = normalisePanelType(panelType) || 'info';
  const typeLabel = panelTypeDisplayName(type);
  const titleAttrMatch = /\sdata-dh-panel-title-extra="([^"]*)"/.exec(extraAttrs);
  const titleExtraAttrs = titleAttrMatch ? ` ${titleAttrMatch[1]}` : '';
  const blockAttrs = extraAttrs.replace(/\sdata-dh-panel-title-extra="[^"]*"/, '');

  return [
    `<div data-dh-node-type="panel" data-dh-panel-type="${escapeHtml(type)}"${blockAttrs}>`,
    `<strong data-dh-panel-title="true"${titleExtraAttrs}>${escapeHtml(typeLabel)}</strong>`,
    '<div data-dh-panel-body="true">',
    body || '',
    '</div>',
    '</div>',
  ].join('');
}

function renderAdfExtension(match) {
  const adfNodeType = extractAttr(match, ['type', 'ac:type']);
  const panelTypeHint =
    extractAdfAttribute(match, ['panel-type', 'panelType', 'panelStyle', 'type']) ||
    extractLooseField(match, ['panel-type', 'panelType', 'panelStyle', 'type']);
  const extensionKey = [
    adfNodeType,
    extractAdfAttribute(match, ['extensionKey', 'extensionType', 'extensionTitle', 'title']),
    panelTypeHint,
    extractAdfAttribute(match, ['macroMetadata', 'parameters', 'attrs']),
    extractLooseField(match, ['extensionKey', 'extensionType', 'extensionTitle', 'macroName', 'panel-type', 'panelType']),
  ].join(' ');
  const lowerExtensionKey = extensionKey.toLowerCase();
  const looksLikePanel =
    /panel|note|warning|error|success|info/.test(lowerExtensionKey) ||
    inferPanelTypeFromText(panelTypeHint) ||
    /<ac:adf-node\b[^>]*(?:type|ac:type)=["']panel["']/i.test(match);

  if (
    /decision[-_]?list|decisionlist/.test(lowerExtensionKey) ||
    /<ac:adf-node\b[^>]*(?:type|ac:type)=["']decision-list["']/i.test(match)
  ) {
    const renderedDecisionList = renderDecisionList(match);
    if (renderedDecisionList) return renderedDecisionList;
  }

  if (/status/.test(lowerExtensionKey)) {
    const text =
      cleanMacroDisplayText(extractAdfAttribute(match, ['text', 'title', 'label', 'value'])) ||
      cleanMacroDisplayText(extractAdfAttribute(match, ['statusText'])) ||
      cleanMacroDisplayText(extractLooseField(match, ['text', 'title', 'label', 'value', 'statusText'])) ||
      'Status';
    const color =
      extractAdfAttribute(match, ['color', 'colour', 'style', 'appearance', 'statusColor', 'statusColour']) ||
      extractLooseField(match, ['color', 'colour', 'style', 'appearance', 'statusColor', 'statusColour']) ||
      inferPanelTypeFromText(extensionKey);

    return renderStatus(text, color);
  }

  if (looksLikePanel) {
    const panelType = normalisePanelType(inferPanelTypeFromText(panelTypeHint)) || 'info';
    const title =
      cleanMacroDisplayText(extractAdfAttribute(match, ['title', 'panelTitle'])) ||
      cleanMacroDisplayText(extractLooseField(match, ['title', 'panelTitle'])) ||
      titleCaseStorageName(panelType);
    const body =
      extractAdfPanelFallbackBody(match) ||
      extractAdfBodiedExtensionBody(match) ||
      extractAdfPlainBody(match) ||
      `<p>${escapeHtml(
        cleanMacroDisplayText(extractAdfAttribute(match, ['text', 'content'])) ||
          cleanMacroDisplayText(extractLooseField(match, ['text', 'content'])) ||
          ''
      )}</p>`;

    return renderPanelBlock(panelType, title, body);
  }

  return createRawFallbackHtml(match, {
    type: 'Extension',
    name: titleCaseStorageName(extractAdfAttribute(match, ['extensionTitle', 'title'])),
  });
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
  let expanded = expandAdfMarks(html);

  expanded = expanded.replace(
    /<ac:adf-node\b[^>]*(?:type|ac:type)=["']status["'][^>]*>[\s\S]*?<\/ac:adf-node>/gi,
    (match) => {
      const text =
        cleanMacroDisplayText(
          extractAdfAttribute(match, ['text', 'title', 'label', 'value', 'statusText'])
        ) ||
        cleanMacroDisplayText(extractLooseField(match, ['text', 'title', 'label', 'value', 'statusText'])) ||
        'Status';
      const color =
        extractAdfAttribute(match, ['color', 'colour', 'style', 'appearance', 'statusColor', 'statusColour']) ||
        extractLooseField(match, ['color', 'colour', 'style', 'appearance', 'statusColor', 'statusColour']);
      return renderStatus(text, color);
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
      return renderDate(extractDateValueFromMarkup(match), stripTags(removeAdfAttributes(match)));
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
    (_match, body) => renderDecision(body)
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
    /<ac:adf-node\b[^>]*(?:type|ac:type)=["'](?:paragraph|heading|blockquote|listItem)["'][^>]*>[\s\S]*?<\/ac:adf-node>/gi,
    (match) => {
      const layoutAttrs = textLayoutDataAttrsFromMarkup(match);
      const bodyMatch = /<ac:adf-node\b[^>]*>([\s\S]*?)<\/ac:adf-node>/i.exec(match);
      const body = removeAdfAttributes(bodyMatch ? bodyMatch[1] : '');

      return layoutAttrs ? `<div data-dh-node-type="paragraph"${layoutAttrs}>${body}</div>` : body;
    }
  );

  expanded = expanded.replace(
    /<ac:adf-node\b[^>]*(?:type|ac:type)=["'](?:extension|bodiedExtension|multiBodiedExtension)["'][^>]*>[\s\S]*?<\/ac:adf-node>/gi,
    (match) => renderAdfExtension(match)
  );

  expanded = expanded.replace(
    /<ac:(?:adf-extension|bodied-extension|extension)\b[\s\S]*?<\/ac:(?:adf-extension|bodied-extension|extension)>/gi,
    (match) => renderAdfExtension(match)
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
        const title = cleanMacroDisplayText(extractMacroParameter(macroMarkup, 'title'));
        const body = extractMacroBody(macroMarkup);
        const panelStyle = buildPanelStyleAttribute(macroMarkup);
        const titleStyle = buildPanelTitleStyleAttribute(macroMarkup);
        const panelType = panelTypeFromStructuredMacroName(normalisedName) || 'info';
        const titleExtra = titleStyle ? ` data-dh-panel-title-extra="${escapeAttr(titleStyle.trim())}"` : '';

        return renderPanelBlock(panelType, title || titleCaseStorageName(panelType), body, `${panelStyle}${titleExtra}`);
      }

      if (normalisedName === 'status') {
        const statusText =
          cleanMacroDisplayText(extractMacroParameter(macroMarkup, 'title')) ||
          cleanMacroDisplayText(extractMacroParameter(macroMarkup, 'text')) ||
          cleanMacroDisplayText(extractMacroParameter(macroMarkup, 'label')) ||
          'Status';
        const statusColor =
          cleanMacroDisplayText(extractMacroParameter(macroMarkup, 'colour')) ||
          cleanMacroDisplayText(extractMacroParameter(macroMarkup, 'color')) ||
          cleanMacroDisplayText(extractMacroParameter(macroMarkup, 'subtleColour')) ||
          cleanMacroDisplayText(extractMacroParameter(macroMarkup, 'subtleColor'));
        return renderStatus(statusText, statusColor);
      }

      if (normalisedName === 'expand') {
        const title = cleanUserFacingName(extractMacroParameter(macroMarkup, 'title')) || 'Details';
        const body = extractMacroBody(macroMarkup);
        return [
          '<details data-dh-node-type="expand" open>',
          `<summary>${escapeHtml(title)}</summary>`,
          '<div data-dh-expand-body="true">',
          body,
          '</div>',
          '</details>',
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
      renderAdfExtension(match)
    )
    .replace(/<ri:user\b[^>]*\/?>/gi, () => '<span data-dh-node-type="mention">[Mention]</span>')
    .replace(/<ri:date\b[^>]*\/?>/gi, (match) => renderDate(extractDateValueFromMarkup(match)));
}

export function prepareConfluenceHtml(html, baseUrl, attachmentsByFilename = {}) {
  if (!html) return '';

  // Convert Confluence-only storage constructs into ordinary, sanitized HTML.
  // This is intentionally a renderer-only layer: the original storage fragments
  // are still kept in the diff blocks for reconstruction and draft creation.
  const expandedStorage = expandSelfClosingTimeTags(
    expandWhiteboardAnchors(
      expandUnsupportedStorageNodes(
        expandKnownStructuredMacros(
          expandConfluenceTaskLists(
            expandAdfNodes(expandConfluenceLinks(expandConfluenceCodeMacros(html), baseUrl))
          )
        )
      )
    )
  )
    .replace(/<ac:emoticon\b[^>]*(?:ac:name|name)=["']([^"']+)["'][^>]*\/?>/gi, (_match, name) =>
      confluenceEmoticonToText(name)
    )
    .replace(
      /<ac:image[\s\S]*?<ri:url[^>]*(?:ri:value|value)=["']([^"']+)["'][^>]*>[\s\S]*?<\/ac:image>/gi,
      (match, url) => {
        const imageMeta = extractImageStyle(match);
        const renderedImage = renderImageFigure({
          src: url,
          alt: extractImageAltText(match, ''),
          caption: extractImageCaption(match),
          imageStyle: imageMeta.imageStyle,
          imageWidth: imageMeta.imageWidth,
          align: imageMeta.align,
          hasBorder: imageMeta.hasBorder,
          borderSize: imageMeta.borderSize,
          borderColor: imageMeta.borderColor,
        });
        return renderedImage;
      }
    )
    .replace(
      /<ac:image[\s\S]*?<ri:attachment[^>]*(?:ri:filename|filename)=["']([^"']+)["'][^>]*>[\s\S]*?<\/ac:image>/gi,
      (match, filename) => {
        const url = lookupAttachmentUrl(filename, attachmentsByFilename);
        const imageMeta = extractImageStyle(match);
        if (url) {
          const renderedImage = renderImageFigure({
            src: url,
            alt: extractImageAltText(match, filename),
            caption: extractImageCaption(match),
            imageStyle: imageMeta.imageStyle,
            imageWidth: imageMeta.imageWidth,
            align: imageMeta.align,
            hasBorder: imageMeta.hasBorder,
            borderSize: imageMeta.borderSize,
            borderColor: imageMeta.borderColor,
          });
          return renderedImage;
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
    'FIGCAPTION',
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
    'SUB',
    'SUMMARY',
    'SUP',
    'TABLE',
    'TBODY',
    'TD',
    'TH',
    'THEAD',
    'TR',
    'U',
    'UL',
    'TIME',
  ]);
  const allowedAttrs = new Set([
    'alt',
    'colspan',
    'datetime',
    'height',
    'href',
    'rowspan',
    'scope',
    'src',
    'start',
    'style',
    'title',
    'width',
  ]);
  const doc = new DOMParser().parseFromString(expandedStorage, 'text/html');

  Array.from(doc.body.querySelectorAll('*')).forEach((node) => {
    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(...Array.from(node.childNodes));
      return;
    }

    const originalClassName = node.getAttribute('class') || '';

    Array.from(node.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value || '';
      const isAllowedDataImage = name === 'src' && value.startsWith('data:image/');
      const isAlignmentAttr = name === 'align' || name === 'valign';
      const isTableCell = node.tagName === 'TD' || node.tagName === 'TH';

      if (name === 'class') {
        applyColorHintsFromClass(node, value);
        applyTextLayoutHintsFromClass(node, value);
        node.removeAttribute(attr.name);
        return;
      }

      if (['data-align', 'data-alignment', 'data-text-align', 'data-text-alignment', 'text-align'].includes(name)) {
        setTextLayoutDataAttributes(node, { align: value });
        node.removeAttribute(attr.name);
        return;
      }

      if (['data-indent', 'data-indentation', 'indent', 'indentation'].includes(name)) {
        setTextLayoutDataAttributes(node, { indent: value });
        node.removeAttribute(attr.name);
        return;
      }

      if (name === 'data-layout') {
        setTextLayoutDataAttributes(node, { align: value, indent: value });
        node.removeAttribute(attr.name);
        return;
      }

      if (['data-color', 'data-colour', 'data-text-color', 'data-text-colour', 'text-color', 'text-colour'].includes(name)) {
        const shouldTreatAsBackground =
          isTableCell ||
          node.tagName === 'MARK' ||
          /background|highlight|mark|bg/i.test(originalClassName);
        applySafeColorDataAttribute(
          node,
          shouldTreatAsBackground ? 'data-dh-bg-color' : 'data-dh-text-color',
          value
        );
        node.removeAttribute(attr.name);
        return;
      }

      if (
        name === 'bgcolor' ||
        [
          'data-highlight-color',
          'data-highlight-colour',
          'data-background-color',
          'data-background-colour',
          'data-cell-background',
          'data-cell-background-color',
          'data-cell-background-colour',
        ].includes(name)
      ) {
        if (isTableCell || name !== 'bgcolor') {
          applySafeColorDataAttribute(node, 'data-dh-bg-color', value);
        }
        node.removeAttribute(attr.name);
        return;
      }

      if (isAlignmentAttr) {
        const property = name === 'align' ? 'text-align' : 'vertical-align';
        const allowed = name === 'align'
          ? ['left', 'center', 'right', 'justify']
          : ['top', 'middle', 'bottom', 'baseline'];
        const safeValue = normaliseCssKeyword(value, allowed);
        if (safeValue) {
          node.setAttribute(
            'style',
            appendSafeStyle(node.getAttribute('style') || '', [`${property}: ${safeValue}`])
          );
        }
        node.removeAttribute(attr.name);
        return;
      }

      if (!allowedAttrs.has(name) && !name.startsWith('data-')) {
        node.removeAttribute(attr.name);
        return;
      }

      if (name === 'style') {
        applyColorDeclarationsFromStyle(node, value);
        applyTextLayoutDeclarationsFromStyle(node, value);
        const safeStyle = styleDeclarationsWithoutColor(value).join('; ');
        if (safeStyle) {
          node.setAttribute(attr.name, safeStyle);
        } else {
          node.removeAttribute(attr.name);
        }
        return;
      }

      if (name === 'width' || name === 'height') {
        const safeLength = normaliseCssLength(value);
        if (safeLength) {
          node.setAttribute(attr.name, safeLength.replace(/px$/i, ''));
        } else {
          node.removeAttribute(attr.name);
        }
        return;
      }

      if (name === 'start' && !/^-?\d+$/.test(value)) {
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

    const explicitDateValue =
      node.getAttribute('datetime') ||
      node.getAttribute('data-date') ||
      node.getAttribute('data-value') ||
      node.getAttribute('data-timestamp');
    const isExplicitDateNode =
      node.tagName === 'TIME' ||
      node.getAttribute('data-node-type') === 'date' ||
      (node.tagName === 'SPAN' && /\bdate-node\b/i.test(originalClassName) && explicitDateValue);

    if (isExplicitDateNode) {
      const value =
        explicitDateValue ||
        node.textContent;
      const displayDate = formatConfluenceDate(value);

      node.setAttribute('data-dh-node-type', 'date');
      if (value && node.tagName === 'TIME') {
        node.setAttribute('datetime', value);
      }
      if (displayDate) {
        node.textContent = displayDate;
      }
    }

    // Confluence sometimes stores/returns status lozenges as regular spans
    // with AUI/Fabric classes instead of as a structured status macro. The
    // visible fallback text for those spans can be the generic word "STATUS",
    // while the real user-facing distinction is carried by the lozenge color.
    // Preserve normal custom labels, but replace generic labels with the color
    // name so the regression page displays NEUTRAL/PURPLE/BLUE/... as expected.
    if (node.tagName === 'SPAN' && /\b(status|lozenge)\b/i.test(originalClassName)) {
      const statusColor = normaliseStatusColor(node.getAttribute('data-dh-status-color'));
      const currentText = cleanMacroDisplayText(node.textContent);
      node.setAttribute('data-dh-node-type', 'status');

      if (statusColor && (!currentText || /^status$/i.test(currentText))) {
        node.textContent = /\bneutral\b/i.test(originalClassName) ? 'NEUTRAL' : statusColor.toUpperCase();
      }
    }
  });

  normaliseNestedIndentation(doc.body);
  markEmptyParentListItems(doc.body);

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
  return `<${listTag}>${normaliseNestedListItemHtml(itemHtml)}</${listTag}>`;
}

function isEmptyParentListItem(item) {
  if (!item || item.nodeType !== Node.ELEMENT_NODE || !/^li$/i.test(item.tagName)) return false;

  const hasNestedList = Array.from(item.children).some((child) => /^(ul|ol)$/i.test(child.tagName));
  const hasDirectText = Array.from(item.childNodes).some(
    (child) => child.nodeType === Node.TEXT_NODE && normaliseBlockText(child)
  );
  const hasDirectNonListElement = Array.from(item.children).some(
    (child) => !/^(ul|ol)$/i.test(child.tagName) && normaliseBlockText(child)
  );

  return hasNestedList && !hasDirectText && !hasDirectNonListElement;
}

function markEmptyParentListItems(root) {
  if (!root || !root.querySelectorAll) return;

  Array.from(root.querySelectorAll('li')).forEach((item) => {
    if (isEmptyParentListItem(item)) {
      item.setAttribute('data-dh-empty-parent-list-item', 'true');
      if (!item.querySelector(':scope > [data-dh-empty-list-marker]')) {
        const markerAnchor = item.ownerDocument.createElement('span');
        markerAnchor.setAttribute('data-dh-empty-list-marker', 'true');
        markerAnchor.setAttribute('aria-hidden', 'true');
        item.insertBefore(markerAnchor, item.firstChild);
      }
    }
  });
}

function normaliseNestedListItemHtml(itemHtml) {
  const doc = new DOMParser().parseFromString(itemHtml || '', 'text/html');
  const item = doc.body.firstElementChild;

  if (!item || !/^li$/i.test(item.tagName)) return itemHtml;

  if (isEmptyParentListItem(item)) {
    item.setAttribute('data-dh-empty-parent-list-item', 'true');
    if (!item.querySelector(':scope > [data-dh-empty-list-marker]')) {
      const markerAnchor = doc.createElement('span');
      markerAnchor.setAttribute('data-dh-empty-list-marker', 'true');
      markerAnchor.setAttribute('aria-hidden', 'true');
      item.insertBefore(markerAnchor, item.firstChild);
    }
  }

  return item.outerHTML;
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
  const parserSafeHtml = normaliseSelfClosingTimeTagsForParsing(html || '');
  const rawDoc = new DOMParser().parseFromString(parserSafeHtml, 'text/html');
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

function renderCodeDiffLines(segments, language = '') {
  const html = segments
    .map((segment) =>
      renderCodeBlockHtml(
        segment.lines.join('\n'),
        language,
        `dh-code-diff-line dh-code-diff-line--${segment.type}`
      )
    )
    .join('');

  const languageAttr = language ? ` data-language="${escapeAttr(language)}"` : '';
  return `<pre data-dh-node-type="code_block" data-dh-code-enhanced="true"${languageAttr}><code>${html}</code></pre>`;
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
    renderedHtml: renderCodeDiffLines(
      lineDiff.segments,
      extractAttr(currentBlock.renderedHtml || currentBlock.html || '', ['data-language'])
    ),
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
  const doc = new DOMParser().parseFromString(
    currentBlock.renderedHtml || currentBlock.html || '',
    'text/html'
  );
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
      oldBlock.renderedHtml || oldBlock.html,
      '</div>',
      '<div class="dh-table-diff-panel dh-table-diff-panel--added">',
      '<div class="dh-table-diff-label">Current table</div>',
      currentBlock.renderedHtml || currentBlock.html,
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
  const oldRows = extractTableRows(oldBlock.renderedHtml || oldBlock.html);
  const currentRows = extractTableRows(currentBlock.renderedHtml || currentBlock.html);

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
