// Mock data used when the app runs outside Confluence (e.g. `npm start` / `forge tunnel`
// without a real page context). Lets you develop the UI without a live page.

const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();
const storageBody = (value) => ({
  body: {
    representation: 'storage',
    value,
  },
});

export const mockData = {
  pageId: 'mock-page-123',
  pageTitle: 'Getting Started Guide (mock data)',
  baseUrl: '',
  attachmentsByFilename: {},
  versions: [
    {
      number: 6,
      authorName: 'Sample User A',
      createdAt: hoursAgo(1),
      message: 'Clarified setup steps',
      minorEdit: false,
      ...storageBody(
        '<h1>Getting Started</h1><p>Install the app from the Atlassian Marketplace and open Dynamic History from the page actions menu.</p><p>Review the highlighted additions and removals before publishing major updates.</p><ul><li>Open a Confluence page.</li><li>Select Dynamic History.</li><li>Compare any version with the current page.</li></ul>'
      ),
    },
    {
      number: 5,
      authorName: 'Sample User B',
      createdAt: hoursAgo(5),
      message: 'Fixed broken link',
      minorEdit: true,
      ...storageBody(
        '<h1>Getting Started</h1><p>Install the app from the Atlassian Marketplace and open Dynamic History from the page actions menu.</p><p>Review the highlighted changes before publishing updates.</p><ul><li>Open a Confluence page.</li><li>Select Dynamic History.</li></ul>'
      ),
    },
    {
      number: 4,
      authorName: 'Sample User C',
      createdAt: hoursAgo(26),
      message: 'Added API reference section',
      minorEdit: false,
      ...storageBody(
        '<h1>Getting Started</h1><p>Install the app from the Atlassian Marketplace and open Dynamic History from the page actions menu.</p><p>Review the changes before publishing updates.</p>'
      ),
    },
    {
      number: 3,
      authorName: 'Sample User A',
      createdAt: hoursAgo(72),
      message: '',
      minorEdit: false,
      ...storageBody(
        '<h1>Getting Started</h1><p>Install the app and open it from the page actions menu.</p><p>Review the changes before publishing updates.</p>'
      ),
    },
    {
      number: 2,
      authorName: 'Sample User C',
      createdAt: hoursAgo(120),
      message: 'Initial draft of overview',
      minorEdit: false,
      ...storageBody(
        '<h1>Getting Started</h1><p>Install the app and open it from the page actions menu.</p>'
      ),
    },
    {
      number: 1,
      authorName: 'Sample User A',
      createdAt: hoursAgo(240),
      message: 'Page created',
      minorEdit: false,
      ...storageBody('<h1>Getting Started</h1><p>Initial draft.</p>'),
    },
  ],
};
