# Dynamic History - Client Handover

**Document date:** 15 August 2026  
**Final source baseline:** [`93f53dc48c6f151b49d264fb884c114b4686ccea`](https://github.com/unsw-cse-comp99-3900/capstone-project-26t2-9900-w15c-bread/commit/93f53dc48c6f151b49d264fb884c114b4686ccea)

## 1. Purpose

This document provides a single entry point to the Dynamic History handover
materials. The course-provided GitHub repository is the source of truth for the
final source code and supporting documentation. Normal users should install the
shared production app using the installation link below; they do not need to
deploy the application from source.

## 2. GitHub Repository and Handover Files

| Item | Location | Purpose |
| --- | --- | --- |
| Course GitHub repository | [Dynamic History repository](https://github.com/unsw-cse-comp99-3900/capstone-project-26t2-9900-w15c-bread) | Complete source code and handover materials |
| Final source baseline | [Commit `93f53dc`](https://github.com/unsw-cse-comp99-3900/capstone-project-26t2-9900-w15c-bread/commit/93f53dc48c6f151b49d264fb884c114b4686ccea) | Fixed reference for the final source handover |
| Technical overview | [`README.md`](https://github.com/unsw-cse-comp99-3900/capstone-project-26t2-9900-w15c-bread/blob/main/README.md) | Features, architecture, local setup, testing, deployment, security, and known limitations |
| Forge configuration | [`manifest.yml`](https://github.com/unsw-cse-comp99-3900/capstone-project-26t2-9900-w15c-bread/blob/main/manifest.yml) | Forge module, app identity, runtime, resource path, and permission scopes |
| Production installation guide | [`docs/production-confluence-installation-guide.md`](https://github.com/unsw-cse-comp99-3900/capstone-project-26t2-9900-w15c-bread/blob/main/docs/production-confluence-installation-guide.md) | Shared-link installation steps and production release record |
| Bilingual user guide | [`docs/user-guide-content.md`](https://github.com/unsw-cse-comp99-3900/capstone-project-26t2-9900-w15c-bread/blob/main/docs/user-guide-content.md) | English and Chinese instructions with screenshots |
| Privacy policy | [Dynamic History Privacy Policy](https://unsw-cse-comp99-3900.github.io/capstone-project-26t2-9900-w15c-bread/) | Privacy and data-handling information |

The documentation links point to the repository's `main` branch so that later
handover-only corrections remain accessible. The source baseline above remains
the fixed reference for the submitted application source.

## 3. Recommended Installation

Dynamic History is shared as a production Forge app for Confluence Cloud. A
Confluence or organisation administrator should open the link below and select
the intended Confluence site:

[Install Dynamic History on Confluence](https://developer.atlassian.com/console/install/2a3947b0-ca60-4cd0-8fda-772e242ff1d0?signature=AYABeIl%2FBcvHSAJyJq6C%2FW%2FW%2F08AAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4IOp8r3eKNYw8z2v%2FEq3%2FfvrZguoGsXpNSaDveR%2FF%2Fo0B%2Bib7FayRp%2FXiNYNfU9ieSAAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDL0ejxC9HrMoInfsRQIBEIA7Q3mArwX3Ft8sHVYaJmhO8C7eaJDMqqD0e0UZYYDoUtyIBhEVnSS5jg96%2Fim2kbfFRsleuEF7kX%2Bb6U8AB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHijmwVTMt6Oj3F%2B0%2B0cVrojrS8yZ9ktpdfDxqPMSIkvHAEa3f16vjcmHppAUWHQSmbMAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMXm67lx%2FlnzGgG0dCAgEQgDvmND8eQ9oiFR3A%2BdcPACCbJ9YOxD%2BsfP8GrC1rYEvRwH6uzDrUWntdf0gvje5euaPYi%2B0RjEq8JuBMkQAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeLKa7Dfn9BgbXaQmJGrkKztjV4vrreTkqr7wGwhqIYs5ARGvx05u6Rakt5dyAg5tHIoAAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAxsB8E8qpKzvr6WwEYCARCAO9CKGkdYH5Ot396tKfflS59tqBKGdEyp8aAV344HWfsjZKJLw83nU0AAsHJRuE0CghPPdX0NfyAZGbRBAgAAAAAMAAAQAAAAAAAAAAAAAAAAACLv99YHiD1YFQrM8qvomoj%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADIpiE%2BO1VkqZIY6YzgNIQa5mEMmTbiYNFzaBhwuNSUiRRokEsB2mgjN1RyqJkjvOHwKLNQWt04Vw2lLuWNidwHv%2B50%3D&product=confluence)

The shared installation does not require the source code, Node.js, npm, the
Forge CLI, or Forge contributor access. Detailed installation checks are in the
[production installation guide](https://github.com/unsw-cse-comp99-3900/capstone-project-26t2-9900-w15c-bread/blob/main/docs/production-confluence-installation-guide.md).

## 4. Release Record

| Item | Value |
| --- | --- |
| Forge app ID | `2a3947b0-ca60-4cd0-8fda-772e242ff1d0` |
| Distribution status | Sharing |
| Shared environment | Production |
| Last production deployment shown in the Developer Console | 1 August 2026, 08:17:17 UTC |
| Final repository source baseline | `93f53dc48c6f151b49d264fb884c114b4686ccea` |

The shared production deployment predates the final repository source baseline.
The Share Link therefore provides the last production-deployed client-trial
build, while the GitHub baseline is the final source handover and includes later
source and documentation changes.

## 5. Start Using Dynamic History

1. Open a Confluence page that has at least two published versions.
2. Open the page's content actions menu and select **Dynamic History**.
3. Select an earlier version and review the changes in Inline or Side-by-side
   view.
4. Choose which current or historical changes to keep.
5. Review the reconstructed page before selecting **Publish to Current Page**.

Opening the review dialog does not update Confluence. The original page changes
only after the user explicitly publishes the reconstructed result.

## 6. Source Deployment and Maintenance

Source deployment is not recommended for normal client installation. Future
maintainers can find the current setup, test, build, and Forge deployment
commands in [`README.md`](https://github.com/unsw-cse-comp99-3900/capstone-project-26t2-9900-w15c-bread/blob/main/README.md).
Deploying the existing Forge app identity also requires contributor access to
the app; GitHub access alone is not sufficient.

## 7. Support

**App owner:** Weichen Wang  
**Support email:** 2954681526@qq.com

If the installation link is invalid or has been replaced, contact the app owner
for the current approved link.
