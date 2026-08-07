# Dynamic History Installation Manual

## 1. Deployment model

Dynamic History is an Atlassian Forge application for Confluence Cloud. The
backend runs in the Forge-managed runtime and the Custom UI frontend is served
as a Forge static resource. It is therefore deployed with the Forge CLI rather
than started with `docker compose`.

The team must confirm that the course-approved Docker exception for this Forge
project is recorded in the final submission. If the exception has not yet been
confirmed, contact the tutor before submitting the report.

Marketplace publication is optional and is not required to install or hand over
the application. The procedure below deploys and installs the application
directly through Forge.

## 2. Prerequisites

Install or obtain access to the following:

- Git;
- Node.js 24.x and npm;
- Atlassian Forge CLI;
- an Atlassian account that has access to the Forge application declared in
  `manifest.yml`; and
- a Confluence Cloud site on which the installer has permission to install
  applications.

Install the Forge CLI if it is not already available:

```powershell
npm install --global @forge/cli
```

Authenticate the CLI with the Atlassian account that has access to the app:

```powershell
forge login
```

The `app.id` in `manifest.yml` identifies the existing team Forge application.
An installer who is not an authorised contributor cannot deploy that app. In
that case, an existing app owner must add the installer as a contributor, or the
handover owner must register a separate Forge application identity before
deploying the source code.

## 3. Obtain the source code

Clone the course-provided GitHub repository and enter the application root:

```powershell
git clone <course-repository-url>
cd capstone-project-26t2-9900-w15c-bread
```

For a handover or assessed installation, check out the final handover tag or the
commit hash recorded by the team:

```powershell
git checkout <handover-tag-or-commit>
```

The directory containing `manifest.yml` is the Forge application root. Run all
Forge validation, deployment, and installation commands from this directory.

## 4. Environment variables and secrets

Dynamic History does not require an application-specific `.env` file or custom
environment variables. Authentication is handled by `forge login`, and the
backend uses the invoking Confluence user's permissions through Forge.

Do not commit Atlassian API tokens, Forge credentials, cookies, passwords, or
other private credentials to the repository. The application requests the
following Confluence scopes through `manifest.yml`:

- `read:page:confluence`;
- `read:attachment:confluence`;
- `read:confluence-user`; and
- `write:page:confluence`.

Users must have permission to view a page to load its history and permission to
edit the page to publish recovered content or save a version comment.

## 5. Install dependencies

The repository contains two npm projects: the Forge resolver at the repository
root and the Custom UI frontend under `static/hello-world`.

From the repository root, install the resolver dependencies:

```powershell
npm install --legacy-peer-deps
```

Install the frontend dependencies:

```powershell
cd static/hello-world
npm install --legacy-peer-deps
```

On Windows, `npm.cmd` may be used instead of `npm` if PowerShell execution
policy prevents the npm PowerShell wrapper from running.

## 6. Build and verify the application

From `static/hello-world`, run the automated frontend test suite:

```powershell
node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand
```

Build the deployable Custom UI resource:

```powershell
npm run build
```

Return to the repository root and validate the Forge application:

```powershell
cd ../..
pwd
forge lint
```

The build output must exist at `static/hello-world/build`, because this is the
resource path declared in `manifest.yml`.

## 7. Deploy the application

For a normal handover or test installation, deploy to the Forge development
environment from the repository root:

```powershell
forge deploy --non-interactive -e development
```

Do not use `--no-verify`. If the frontend code changes later, rebuild
`static/hello-world` before deploying again.

## 8. Install the application on Confluence

For the first installation on a Confluence Cloud site, run:

```powershell
forge install --non-interactive --site <site>.atlassian.net --product confluence --environment development
```

If the application is already installed and its permissions or scopes have
changed, deploy first and then upgrade the installation:

```powershell
forge install --non-interactive --upgrade --site <site>.atlassian.net --product confluence --environment development
```

Replace `<site>` with the actual Confluence site name. Do not deploy or install
to the team or client site without the site owner's approval.

## 9. Open and use Dynamic History

After installation:

1. Open a Confluence page that has at least two published versions.
2. Open the page's content actions menu.
3. Select **Dynamic History**.
4. Select an earlier version from the timeline.
5. Review the differences in Inline or Side-by-side view.
6. Choose which historical or current content to use.
7. Review the reconstructed result.
8. Publish only after confirming the final content.

The invoking user must have the required page permissions. If the action does
not appear immediately after installation, refresh the Confluence page and
confirm that the correct site, product, and Forge environment were used.

## 10. Optional local frontend preview

The frontend can be opened locally with mock data for UI inspection. This does
not connect to a live Confluence page and does not replace Forge deployment
testing.

```powershell
cd static/hello-world
npm start
```

Open `http://localhost:3000` in a browser.

## 11. Troubleshooting

### The deployed interface is outdated

Rebuild the frontend and redeploy from the repository root:

```powershell
cd static/hello-world
npm run build
cd ../..
forge deploy --non-interactive -e development
```

### The installer cannot deploy the app ID

Confirm that the Atlassian account used by `forge login` is an authorised
contributor to the Forge application in `manifest.yml`. App ownership is
separate from GitHub repository access.

### Dynamic History cannot load or publish a page

Confirm that the user can view the page and, for publishing or version comments,
can edit the page. Also confirm that the application was installed with the
scopes currently declared in `manifest.yml`.

### Publishing is rejected after another user edits the page

Reload Dynamic History, select the latest page version, review the recovery
choices again, and retry. The rejection protects newer collaborative edits from
being overwritten.

### Forge reports a manifest or permission error

Run `forge lint` from the repository root. If scopes changed, deploy the updated
manifest and then run the Forge installation command with `--upgrade`.

## 12. Handover contents

The course-provided GitHub repository should contain, at minimum:

- the final source code and `manifest.yml`;
- this installation manual;
- the user guide;
- demo videos or other agreed demonstration materials;
- automated and manual testing information;
- known limitations and future-work notes; and
- the final handover commit hash or release tag.

The Marketplace submission, if pursued, should be treated as optional work and
must not block completion of the repository-based client handover.
