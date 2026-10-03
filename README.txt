FIREFOX FORM FILLER - VERSION 1.4.0

SIGNED RELEASE AND AUTOMATIC UPDATES
After the repository owner authorizes publishing a signed XPI and configures
the release workflow, download the signed .xpi from this repository's Releases
page. In Firefox Add-ons Manager, choose Install Add-on From File and select it.
The extension checks the HTTPS updates.json feed for higher signed versions.
Pushing source code by itself does not install or update an extension.

Release setup for the repository owner:
1. Obtain an explicit exception to AGENTS.md rules 9 and 10 for publishing
   signed XPI release assets and storing Mozilla signing credentials in this
   repository's protected Actions secrets. Keep a separate protected local
   backup of those credentials. Never place them in source, issues, or logs.
2. Create Mozilla Add-ons developer API credentials. Add the issuer and secret
   as Actions secrets AMO_JWT_ISSUER and AMO_JWT_SECRET. Set the repository
   Actions variable PUBLISH_SIGNED_XPI to true only after that approval.
3. Push a new manifest.json version to main. The workflow packages only the
   extension files, submits them to Mozilla for unlisted signing, creates a
   GitHub release with the signed XPI, and publishes its URL and SHA-256 hash
   in updates.json. Each later release needs a higher manifest version.
4. Install the signed XPI once. Temporary add-ons loaded through about:debugging
   do not provide a durable installation or automatic updates.

Before replacing a temporary installation that contains answers, preserve
those answers separately. Firefox can clear extension storage when an add-on
is removed; this project's file backup does not include Firefox storage.

The source code and documentation are already on GitHub. Signing requires
Mozilla's service and can be delayed by review. The workflow does not publish
an XPI until the repository variable and signing credentials are configured.

TEMPORARY DEVELOPMENT INSTALL
1. Open about:debugging#/runtime/this-firefox in Firefox 128 or newer.
2. For an already loaded add-on, use Reload to preserve its local profile.
3. Click Load Temporary Add-on and choose the new ZIP. You can alternatively
   extract it and select manifest.json.
4. Refresh application tabs to replace the old page controls.
5. Disable the original Tampermonkey userscript to avoid duplicate buttons.

This unsigned development add-on lasts until Firefox restarts. Permanent
installation in standard Firefox requires Mozilla signing.

WHITELIST
Click the JK toolbar icon and choose Whitelist this website. The floating
Review & Fill button appears on that exact HTTPS hostname. Remove this
website removes its registration and access. Expand Whitelisted websites
to see the list. A redirect to another hostname needs separate permission.

FIELD MEMORY - NEW IN 1.2.0
Click or focus a normal form field on a whitelisted application page. A small
round + button appears beside the field. Click it to open the field-memory menu.

- Remember this field: saves the question/field identity and the answer that is
  currently entered or selected. If the field is empty, the add-on asks what
  value should be remembered.
- Update this field: replaces the saved answer with the field's current value.
- Remove this field: deletes only that learned question/answer mapping.

A remembered field shows a green round checkmark button instead of +. Learned
answers are stored locally in Firefox under extension storage and are considered
before the built-in matching rules during Review & Fill. Matching uses the
question/label plus stable field information such as name, id, placeholder and
control type, so the same wording can often be reused on another application.

For safety, field memory refuses password, file-upload, full Social Security,
bank/routing, payment-card, PIN/security-code, driver's-license and passport-
number fields. The existing explicitly configured SSN last-four behavior remains
separate from field memory.

PREVIEW BEFORE FILLING
Click Review & Fill. The preview lists recognized questions and proposed
answers, including learned answers. Uncheck anything to skip, then click Fill
selected answers. Nothing is filled merely by opening the preview. Existing
answers are preserved.

EDIT MY PROFILE
Choose Edit my profile in the extension menu. New installations start with blank answers. Edit contact information, application
answers, employment history and education, then Save profile. Answers are
stored locally in Firefox, not synchronized or uploaded to a service. Blank
optional answers are skipped. Learned fields are stored separately, so removing
a learned field does not alter the main profile.

PRIVATE PROFILE BACKUP AND MIGRATIONS - NEW IN 1.4.0
The options page can export the profile, remembered fields and compatibility
setting as a versioned private JSON file. Imports validate the schema and show
a summary before the separate Apply this import button replaces local data.
Rejected or cancelled imports do not change storage. Keep exports private: they
contain saved answers. Storage migrations run before the options page saves.

BITWARDEN COMPATIBILITY MODE - NEW IN 1.4.0
Enable this option when Bitwarden manages sign-in credentials. Firefox Form
Filler then hides its field-memory control around username, password, one-time-
code and sign-in controls while continuing to handle application fields.

FAILURE REPORTS AND ATS FIXTURES - NEW IN 1.4.0
The review window can save a local privacy-safe failure report. It includes
only hostname, normalized label, control type, failure reason and a small
allowlist of relevant ARIA attributes. It never includes the entered answer,
cookies, extension storage or full page HTML. Review reports before sharing.
Sanitized synthetic regression fixtures live under docs/ats-fixtures.

PERMISSION AND SPA RESILIENCE - NEW IN 1.4.0
Removing site access in Firefox now unregisters matching stale content scripts.
A throttled observer restores only the Review & Fill launcher when a trusted
single-page application replaces its page body; it does not scan or fill fields.

CUSTOM DROPDOWNS
Supports standard dropdowns and common accessible combobox/listbox menus. For
custom menus, options are checked only after you confirm the preview. The add-on
selects a matching option within the linked menu. Unavailable, unrecognized or
unverified choices are reported for manual review. This does not guarantee
compatibility with every Workday or other ATS form.

MODERN FORM SAFETY
Review & Fill also checks accessible open Shadow DOM fields, with firm scan
limits so unusually large pages cannot trigger unbounded traversal. Filled
native controls are checked again after a short delay so React-style controlled
inputs that revert are reported for manual review instead of counted as filled.

Visible embedded application frames are reported in Needs attention. The add-on
does not silently access a third-party frame: its hostname must be reviewed and
trusted separately. Filling inside embedded frames remains manual for now.

RESULTS / NEEDS ATTENTION
After applying, see the filled count and fields needing review. Click an
attention item to scroll to and focus that field. The review hides so you can
answer it. Click Review & Fill again when ready to continue. Copy saved answers
opens the summary, skills, contact, job and school panel.

LIMITATIONS / PRIVACY
The extension never clicks Next or Submit. Uploaded resume files, embedded
frames, specialized controls and structured records can still need manual entry.
Filled values can be read by a website immediately, before submission. The
source contains blank defaults. Enter personal answers only through Edit my
profile; they are saved in this Firefox profile, not in the project or GitHub.
Existing saved profiles and learned answers are preserved by this cleanup.
Local extension storage is not an encrypted vault. There are no analytics,
remote code dependencies or external upload services.

VALIDATION
JavaScript syntax, manifest JSON, package references and ZIP integrity were
checked in the build environment. Live Firefox/ATS interaction was not available
for automated browser testing, so test the new field-memory control on a sample
application before relying on it for a large batch of applications.

The repository includes docs/large-form-test.html, a synthetic page that creates
1,500 fields, an open Shadow DOM section, an embedded same-origin form and a
25,000-option dropdown. Use it only as a disposable performance fixture; it
contains no saved answers or real application data.

Mozilla temporary installation instructions:
https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/

PROJECT BACKUPS
Private backups, profile exports, .env files, and generated packages must stay
out of Git. .gitignore does not remove previously tracked files or Git history.
The independent local backup is outside this project folder. It contains the
original personal defaults and must not be published.
