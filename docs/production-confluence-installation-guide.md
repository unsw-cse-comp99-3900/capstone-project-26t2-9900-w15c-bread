# Dynamic History Production Confluence Installation Guide

This guide explains how a client or assessor can install the shared production
version of **Dynamic History** on an existing Confluence Cloud site. Installing
through the shared link does not require the source code, Node.js, npm, or the
Forge CLI.

## Application details

| Item | Value |
| --- | --- |
| Application | Dynamic History |
| Distribution status | Sharing |
| App owner | Weichen Wang |
| Company/Department | Dynamic History (Client Trial) |
| Supported Atlassian product | Confluence Cloud |
| Stores personal data | No |
| Customer support | 2954681526@qq.com |
| Privacy policy | [Dynamic History Privacy Policy](https://unsw-cse-comp99-3900.github.io/capstone-project-26t2-9900-w15c-bread/) |
| Terms of Service | Not provided |
| Production version deployed | 31 July 2026, 23:30:27 UTC |

## Before installation

- Sign in with an Atlassian account that is allowed to install applications on
  the target production Confluence site. A Confluence or organisation
  administrator may be required.
- Obtain approval from the owner of the target site before installing the app.
- Check the target site URL carefully and review the permissions displayed by
  Atlassian before confirming the installation.
- This installation link is for Confluence, not Jira, Bitbucket, or Compass.

## Installation steps

1. Sign in to Atlassian using the administrator account for the target
   Confluence site.
2. Open the [Install the Confluence app](https://developer.atlassian.com/console/install/2a3947b0-ca60-4cd0-8fda-772e242ff1d0?signature=AYABeIl%2FBcvHSAJyJq6C%2FW%2FW%2F08AAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4IOp8r3eKNYw8z2v%2FEq3%2FfvrZguoGsXpNSaDveR%2FF%2Fo0B%2Bib7FayRp%2FXiNYNfU9ieSAAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDL0ejxC9HrMoInfsRQIBEIA7Q3mArwX3Ft8sHVYaJmhO8C7eaJDMqqD0e0UZYYDoUtyIBhEVnSS5jg96%2Fim2kbfFRsleuEF7kX%2Bb6U8AB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHijmwVTMt6Oj3F%2B0%2B0cVrojrS8yZ9ktpdfDxqPMSIkvHAEa3f16vjcmHppAUWHQSmbMAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMXm67lx%2FlnzGgG0dCAgEQgDvmND8eQ9oiFR3A%2BdcPACCbJ9YOxD%2BsfP8GrC1rYEvRwH6uzDrUWntdf0gvje5euaPYi%2B0RjEq8JuBMkQAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeLKa7Dfn9BgbXaQmJGrkKztjV4vrreTkqr7wGwhqIYs5ARGvx05u6Rakt5dyAg5tHIoAAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAxsB8E8qpKzvr6WwEYCARCAO9CKGkdYH5Ot396tKfflS59tqBKGdEyp8aAV344HWfsjZKJLw83nU0AAsHJRuE0CghPPdX0NfyAZGbRBAgAAAAAMAAAQAAAAAAAAAAAAAAAAACLv99YHiD1YFQrM8qvomoj%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADIpiE%2BO1VkqZIY6YzgNIQa5mEMmTbiYNFzaBhwuNSUiRRokEsB2mgjN1RyqJkjvOHwKLNQWt04Vw2lLuWNidwHv%2B50%3D&product=confluence).
3. If Atlassian asks for a product or site, select the intended production
   **Confluence** site.
4. Review the application name, requested permissions, privacy policy, and
   other information displayed by Atlassian.
5. Select the available confirmation action, such as **Review**, **Accept &
   install**, or **Install app**. The exact wording may vary in Atlassian's
   interface.
6. Wait until Atlassian confirms that the installation has completed, then
   refresh Confluence.

## Confirm the installation

1. Open a Confluence page that has at least two published versions.
2. Open the page's content actions menu and select **Dynamic History**.
3. Confirm that the version timeline loads and that an earlier version can be
   selected for comparison.
4. Use a non-critical test page to verify restore and write-back behaviour.
   Review the reconstructed content carefully before publishing it.

Users must have permission to view the selected page. They must also have
permission to edit the page before Dynamic History can publish recovered
content or save a version comment.

## Troubleshooting

- **The target site is unavailable:** confirm that the signed-in Atlassian
  account is permitted to install applications on that site.
- **Administrator approval is requested:** send the request to the target
  site's administrator. A standard Confluence user may not be permitted to
  approve the installation.
- **The installation link is invalid or expired:** contact
  `2954681526@qq.com`. The app owner can generate a new link from the Forge
  distribution controls.
- **Dynamic History does not appear:** refresh Confluence, confirm that the app
  was installed on the correct site, and check the site's app administration
  page.
- **A permission or consent screen appears again:** ask the site administrator
  to review and approve the requested permissions. Do not bypass the site's
  application governance process.

[https://developer.atlassian.com/console/install/2a3947b0-ca60-4cd0-8fda-772e242ff1d0?signature=AYABeIl%2FBcvHSAJyJq6C%2FW%2FW%2F08AAAADAAdhd3Mta21zAEthcm46YXdzOmttczp1cy13ZXN0LTI6NzA5NTg3ODM1MjQzOmtleS83MDVlZDY3MC1mNTdjLTQxYjUtOWY5Yi1lM2YyZGNjMTQ2ZTcAuAECAQB4IOp8r3eKNYw8z2v%2FEq3%2FfvrZguoGsXpNSaDveR%2FF%2Fo0B%2Bib7FayRp%2FXiNYNfU9ieSAAAAH4wfAYJKoZIhvcNAQcGoG8wbQIBADBoBgkqhkiG9w0BBwEwHgYJYIZIAWUDBAEuMBEEDL0ejxC9HrMoInfsRQIBEIA7Q3mArwX3Ft8sHVYaJmhO8C7eaJDMqqD0e0UZYYDoUtyIBhEVnSS5jg96%2Fim2kbfFRsleuEF7kX%2Bb6U8AB2F3cy1rbXMAS2Fybjphd3M6a21zOmV1LXdlc3QtMTo3MDk1ODc4MzUyNDM6a2V5LzQ2MzBjZTZiLTAwYzMtNGRlMi04NzdiLTYyN2UyMDYwZTVjYwC4AQICAHijmwVTMt6Oj3F%2B0%2B0cVrojrS8yZ9ktpdfDxqPMSIkvHAEa3f16vjcmHppAUWHQSmbMAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMXm67lx%2FlnzGgG0dCAgEQgDvmND8eQ9oiFR3A%2BdcPACCbJ9YOxD%2BsfP8GrC1rYEvRwH6uzDrUWntdf0gvje5euaPYi%2B0RjEq8JuBMkQAHYXdzLWttcwBLYXJuOmF3czprbXM6dXMtZWFzdC0xOjcwOTU4NzgzNTI0MzprZXkvNmMxMjBiYTAtNGNkNS00OTg1LWI4MmUtNDBhMDQ5NTJjYzU3ALgBAgIAeLKa7Dfn9BgbXaQmJGrkKztjV4vrreTkqr7wGwhqIYs5ARGvx05u6Rakt5dyAg5tHIoAAAB%2BMHwGCSqGSIb3DQEHBqBvMG0CAQAwaAYJKoZIhvcNAQcBMB4GCWCGSAFlAwQBLjARBAxsB8E8qpKzvr6WwEYCARCAO9CKGkdYH5Ot396tKfflS59tqBKGdEyp8aAV344HWfsjZKJLw83nU0AAsHJRuE0CghPPdX0NfyAZGbRBAgAAAAAMAAAQAAAAAAAAAAAAAAAAACLv99YHiD1YFQrM8qvomoj%2F%2F%2F%2F%2FAAAAAQAAAAAAAAAAAAAAAQAAADIpiE%2BO1VkqZIY6YzgNIQa5mEMmTbiYNFzaBhwuNSUiRRokEsB2mgjN1RyqJkjvOHwKLNQWt04Vw2lLuWNidwHv%2B50%3D&product=confluence]: 
