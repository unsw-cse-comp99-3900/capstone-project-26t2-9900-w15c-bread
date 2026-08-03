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
  commentsByVersion: {},
  currentUser: {
    accountId: 'mock-current-user',
    displayName: 'Sample User A',
  },
  versions: [
    {
      number: 6,
      authorName: 'Sample User A',
      createdAt: hoursAgo(1),
      message: 'Clarified setup steps',
      minorEdit: false,
      ...storageBody(
        [
          '<h1>Getting Started</h1>',
          '<p>Install the app from the Atlassian Marketplace and open Dynamic History from the page actions menu.</p>',
          '<p>Review the highlighted additions and removals before publishing major updates.</p>',
          '<ul><li>Open a Confluence page.</li><li>Select Dynamic History.</li><li>Compare any version with the current page.</li></ul>',
          '<ol><li>Choose a historical version.</li><li>Preview the restored draft.</li></ol>',
          '<ac:task-list><ac:task><ac:task-status>complete</ac:task-status><ac:task-body>Confirm the content owner.</ac:task-body></ac:task><ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>Publish after review.</ac:task-body></ac:task></ac:task-list>',
          '<table><tbody><tr><th>Area</th><th>Status</th></tr><tr><td>Timeline</td><td>Working</td></tr><tr><td>Diff</td><td>Improved</td></tr></tbody></table>',
          '<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">javascript</ac:parameter><ac:plain-text-body><![CDATA[const version = 6;\nconsole.log(version);]]></ac:plain-text-body></ac:structured-macro>',
          '<ac:structured-macro ac:name="info"><ac:parameter ac:name="title">Release note</ac:parameter><ac:rich-text-body><p>Use the preview before creating a Confluence draft.</p></ac:rich-text-body></ac:structured-macro>',
          '<blockquote><p>Keep restoration choices reviewable.</p></blockquote>',
          '<ac:structured-macro ac:name="jira-gadget" ac:macro-id="123e4567-e89b-12d3-a456-426614174000"><ac:parameter ac:name="url">https://example.atlassian.net/plugins/servlet/gadgets/ifr</ac:parameter></ac:structured-macro>',
        ].join('')
      ),
    },
    {
      number: 5,
      authorName: 'Sample User B',
      createdAt: hoursAgo(5),
      message: 'Fixed broken link',
      minorEdit: true,
      ...storageBody(
        [
          '<h1>Getting Started</h1>',
          '<p>Install the app from the Atlassian Marketplace and open Dynamic History from the page actions menu.</p>',
          '<p>Review the highlighted changes before publishing updates.</p>',
          '<ul><li>Open a Confluence page.</li><li>Select Dynamic History.</li></ul>',
          '<ol><li>Choose a historical version.</li></ol>',
          '<ac:task-list><ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>Confirm the content owner.</ac:task-body></ac:task></ac:task-list>',
          '<table><tbody><tr><th>Area</th><th>Status</th></tr><tr><td>Timeline</td><td>Working</td></tr><tr><td>Diff</td><td>Basic</td></tr></tbody></table>',
          '<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">javascript</ac:parameter><ac:plain-text-body><![CDATA[const version = 5;\nconsole.log(version);]]></ac:plain-text-body></ac:structured-macro>',
          '<ac:structured-macro ac:name="note"><ac:parameter ac:name="title">Release note</ac:parameter><ac:rich-text-body><p>Review the output before publishing.</p></ac:rich-text-body></ac:structured-macro>',
          '<blockquote><p>Keep restoration choices simple.</p></blockquote>',
        ].join('')
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
