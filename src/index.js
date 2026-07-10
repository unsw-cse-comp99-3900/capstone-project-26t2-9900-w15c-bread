import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';

const resolver = new Resolver();

/**
 * Fetch all versions of a Confluence page (newest first), following pagination.
 */
async function fetchAllVersions(pageId) {
  const versions = [];
  let cursor = null;
  let baseUrl = '';

  // Safety cap: 20 pages * 50 = up to 1000 versions.
  for (let i = 0; i < 20; i++) {
    const path = cursor
      ? route`/wiki/api/v2/pages/${pageId}/versions?limit=50&sort=-modified-date&body-format=storage&cursor=${cursor}`
      : route`/wiki/api/v2/pages/${pageId}/versions?limit=50&sort=-modified-date&body-format=storage`;

    const res = await api.asUser().requestConfluence(path, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Confluence versions API ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    versions.push(...(data.results || []));
    if (!baseUrl && data._links && data._links.base) {
      baseUrl = data._links.base;
    }

    const next = data._links && data._links.next;
    if (!next) break;
    const m = /[?&]cursor=([^&]+)/.exec(next);
    cursor = m ? decodeURIComponent(m[1]) : null;
    if (!cursor) break;
  }

  return { versions, baseUrl };
}

/**
 * Fetch attachments on the current page so storage image macros can be rendered as images.
 * Confluence storage usually references uploaded images by filename, not by direct URL.
 */
async function fetchPageAttachments(pageId) {
  const attachments = {};
  let cursor = null;
  let baseUrl = '';

  // Safety cap: 10 pages * 100 = up to 1000 attachments.
  for (let i = 0; i < 10; i++) {
    const path = cursor
      ? route`/wiki/api/v2/pages/${pageId}/attachments?limit=100&cursor=${cursor}`
      : route`/wiki/api/v2/pages/${pageId}/attachments?limit=100`;

    const res = await api.asUser().requestConfluence(path, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      console.warn('[fetchPageAttachments] attachment API failed', res.status, await res.text());
      return { attachments, baseUrl };
    }

    const data = await res.json();
    if (!baseUrl && data._links && data._links.base) {
      baseUrl = data._links.base;
    }

    (data.results || []).forEach((attachment) => {
      const filename = attachment.title || attachment.filename;
      const rawDownload =
        attachment.downloadLink ||
        (attachment._links && attachment._links.download) ||
        attachment.webuiLink ||
        '';

      if (!filename || !rawDownload) return;

      const downloadUrl =
        rawDownload.startsWith('http') || !baseUrl ? rawDownload : `${baseUrl}${rawDownload}`;

      attachments[filename] = downloadUrl;
      attachments[filename.toLowerCase()] = downloadUrl;
    });

    const next = data._links && data._links.next;
    if (!next) break;
    const m = /[?&]cursor=([^&]+)/.exec(next);
    cursor = m ? decodeURIComponent(m[1]) : null;
    if (!cursor) break;
  }

  return { attachments, baseUrl };
}

/**
 * Normalise the version body returned by the v2 versions API.
 * Page versions accept `storage`, `atlas_doc_format`, or `markdown`; unlike the page-by-id
 * endpoint, they do not accept `view`.
 */
function extractStorageBody(version) {
  const storage = version && version.page && version.page.body && version.page.body.storage;

  if (!storage) {
    return {
      representation: 'storage',
      value: '',
    };
  }

  return {
    representation: storage.representation || 'storage',
    value: storage.value || '',
  };
}

/**
 * Normalise the current page body returned by the page-by-id endpoint.
 * The versions endpoint is still the right source for historical bodies, but
 * the live page endpoint is more reliable for the current version because it
 * returns the page exactly as Confluence currently stores it.
 */
function extractCurrentPageStorageBody(page) {
  const storage = page && page.body && page.body.storage;

  if (!storage || !storage.value) {
    return null;
  }

  return {
    representation: storage.representation || 'storage',
    value: storage.value || '',
  };
}

/**
 * Resolve account ids -> display names (best effort; failures fall back to "Unknown user").
 */
async function resolveAuthorNames(authorIds) {
  const map = {};
  await Promise.all(
    authorIds.map(async (id) => {
      try {
        const res = await api.asUser().requestConfluence(
          route`/wiki/rest/api/user?accountId=${id}`,
          { headers: { Accept: 'application/json' } }
        );
        if (res.ok) {
          const u = await res.json();
          map[id] = u.displayName || id;
        }
      } catch (e) {
        // ignore — handled by fallback below
      }
    })
  );
  return map;
}

resolver.define('getPageVersions', async (req) => {
  const pageId =
    (req.payload && req.payload.pageId) ||
    (req.context &&
      req.context.extension &&
      req.context.extension.content &&
      req.context.extension.content.id);

  if (!pageId) {
    throw new Error('Unable to determine the current page id from context.');
  }

  console.log('[getPageVersions] start, pageId =', pageId);

  // Current page metadata/body (best effort). We still fetch historical versions
  // below, but the latest version preview should use the dedicated page endpoint
  // so current-vs-current rendering does not depend on the versions listing
  // response shape for complex pages.
  let pageTitle = '';
  let currentPageBody = null;
  try {
    const pageRes = await api.asUser().requestConfluence(
      route`/wiki/api/v2/pages/${pageId}?body-format=storage`,
      {
        headers: { Accept: 'application/json' },
      }
    );
    if (pageRes.ok) {
      const page = await pageRes.json();
      pageTitle = page.title || '';
      currentPageBody = extractCurrentPageStorageBody(page);
    }
  } catch (e) {
    // Current page metadata/body is optional here; the versions endpoint below
    // remains the fallback so the app can still render something useful.
  }

  const { versions: rawVersions, baseUrl: versionsBaseUrl } = await fetchAllVersions(pageId);
  const { attachments, baseUrl: attachmentsBaseUrl } = await fetchPageAttachments(pageId);
  const baseUrl = versionsBaseUrl || attachmentsBaseUrl;

  console.log('[getPageVersions] fetched', rawVersions.length, 'versions');

  const authorIds = [...new Set(rawVersions.map((v) => v.authorId).filter(Boolean))];
  const authorMap = await resolveAuthorNames(authorIds);

  console.log('[getPageVersions] resolved', Object.keys(authorMap).length, 'author names; returning');

  return {
    pageId,
    pageTitle,
    baseUrl,
    attachmentsByFilename: attachments,
    versions: rawVersions.map((v, index) => {
      const versionBody = extractStorageBody(v);

      return {
        number: v.number,
        authorId: v.authorId,
        authorName: authorMap[v.authorId] || 'Unknown user',
        createdAt: v.createdAt,
        message: v.message || '',
        minorEdit: !!v.minorEdit,
        title: v.page && v.page.title ? v.page.title : pageTitle,
        body: index === 0 && currentPageBody ? currentPageBody : versionBody,
      };
    }),
  };
});

resolver.define('createDraft', async (req) => {
  const pageId = req.payload && req.payload.pageId;
  const bodyValue = req.payload && req.payload.bodyValue;

  if (!pageId) {
    throw new Error('A source page id is required to create a draft.');
  }

  if (typeof bodyValue !== 'string') {
    throw new Error('Draft content must be provided as a string.');
  }

  // Keep unexpectedly large client payloads from consuming the resolver
  // invocation. Normal Confluence pages are well below this defensive limit.
  if (bodyValue.length > 2_000_000) {
    throw new Error('The generated draft is too large to create safely.');
  }

  // Resolve the space and parent on the server instead of trusting client
  // supplied location data. asUser() also ensures Confluence applies the
  // invoking user's own page-view and page-create permissions.
  const pageRes = await api.asUser().requestConfluence(
    route`/wiki/api/v2/pages/${pageId}`,
    { headers: { Accept: 'application/json' } }
  );

  if (!pageRes.ok) {
    throw new Error(`Unable to read the source page (${pageRes.status}): ${await pageRes.text()}`);
  }

  const sourcePage = await pageRes.json();
  if (!sourcePage.spaceId) {
    throw new Error('Unable to determine the source page space.');
  }

  const sourceTitle = sourcePage.title || 'Untitled page';
  const titleSuffix = ' — Restored draft';
  const draftTitle = `${sourceTitle.slice(0, Math.max(1, 255 - titleSuffix.length))}${titleSuffix}`;
  const createPayload = {
    spaceId: sourcePage.spaceId,
    status: 'draft',
    title: draftTitle,
    body: {
      representation: 'storage',
      value: bodyValue,
    },
  };

  // Create the draft beside the source page when it has a parent. Root pages
  // remain at the root of the same space.
  if (sourcePage.parentId) {
    createPayload.parentId = sourcePage.parentId;
  }

  const createRes = await api.asUser().requestConfluence(route`/wiki/api/v2/pages`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createPayload),
  });

  if (!createRes.ok) {
    throw new Error(`Confluence draft API ${createRes.status}: ${await createRes.text()}`);
  }

  const draft = await createRes.json();
  const baseUrl =
    (draft._links && draft._links.base) ||
    (sourcePage._links && sourcePage._links.base) ||
    '';
  const webUiPath = draft._links && draft._links.webui ? draft._links.webui : '';

  return {
    id: draft.id,
    status: draft.status || 'draft',
    title: draft.title || draftTitle,
    url: webUiPath && baseUrl ? `${baseUrl}${webUiPath}` : webUiPath,
  };
});

export const handler = resolver.getDefinitions();
