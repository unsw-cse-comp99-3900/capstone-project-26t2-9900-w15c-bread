import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';

const resolver = new Resolver();

/**
 * Fetch all versions of a Confluence page (newest first), following pagination.
 */
async function fetchAllVersions(pageId) {
  const versions = [];
  let cursor = null;

  // Safety cap: 20 pages * 50 = up to 1000 versions.
  for (let i = 0; i < 20; i++) {
    const path = cursor
      ? route`/wiki/api/v2/pages/${pageId}/versions?limit=50&sort=-modified-date&cursor=${cursor}`
      : route`/wiki/api/v2/pages/${pageId}/versions?limit=50&sort=-modified-date`;

    const res = await api.asUser().requestConfluence(path, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Confluence versions API ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    versions.push(...(data.results || []));

    const next = data._links && data._links.next;
    if (!next) break;
    const m = /[?&]cursor=([^&]+)/.exec(next);
    cursor = m ? decodeURIComponent(m[1]) : null;
    if (!cursor) break;
  }

  return versions;
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

  // Page title (best effort).
  let pageTitle = '';
  try {
    const pageRes = await api.asUser().requestConfluence(route`/wiki/api/v2/pages/${pageId}`, {
      headers: { Accept: 'application/json' },
    });
    if (pageRes.ok) {
      const page = await pageRes.json();
      pageTitle = page.title || '';
    }
  } catch (e) {
    // title is optional
  }

  const rawVersions = await fetchAllVersions(pageId);

  console.log('[getPageVersions] fetched', rawVersions.length, 'versions');

  const authorIds = [...new Set(rawVersions.map((v) => v.authorId).filter(Boolean))];
  const authorMap = await resolveAuthorNames(authorIds);

  console.log('[getPageVersions] resolved', Object.keys(authorMap).length, 'author names; returning');

  return {
    pageId,
    pageTitle,
    versions: rawVersions.map((v) => ({
      number: v.number,
      authorId: v.authorId,
      authorName: authorMap[v.authorId] || 'Unknown user',
      createdAt: v.createdAt,
      message: v.message || '',
      minorEdit: !!v.minorEdit,
    })),
  };
});

export const handler = resolver.getDefinitions();
