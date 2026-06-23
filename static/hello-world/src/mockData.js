// Mock data used when the app runs outside Confluence (e.g. `npm start` / `forge tunnel`
// without a real page context). Lets you develop the UI without a live page.

const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();

export const mockData = {
  pageId: 'mock-page-123',
  pageTitle: 'Getting Started Guide (mock data)',
  versions: [
    { number: 6, authorName: 'Sample User A', createdAt: hoursAgo(1), message: 'Clarified setup steps', minorEdit: false },
    { number: 5, authorName: 'Sample User B', createdAt: hoursAgo(5), message: 'Fixed broken link', minorEdit: true },
    { number: 4, authorName: 'Sample User C', createdAt: hoursAgo(26), message: 'Added API reference section', minorEdit: false },
    { number: 3, authorName: 'Sample User A', createdAt: hoursAgo(72), message: '', minorEdit: false },
    { number: 2, authorName: 'Sample User C', createdAt: hoursAgo(120), message: 'Initial draft of overview', minorEdit: false },
    { number: 1, authorName: 'Sample User A', createdAt: hoursAgo(240), message: 'Page created', minorEdit: false },
  ],
};
