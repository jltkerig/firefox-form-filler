FIREFOX FORM FILLER - VERSION 1.2.0

INSTALL / UPDATE
1. Open about:debugging#/runtime/this-firefox in Firefox 128 or newer.
2. For an already loaded add-on, use Reload to preserve its local profile.
3. Click Load Temporary Add-on and choose the new ZIP. You can alternatively
   extract it and select manifest.json.
4. Refresh application tabs to replace the old page controls.
5. Disable the original Tampermonkey userscript to avoid duplicate buttons.

This unsigned add-on lasts until Firefox restarts. Permanent installation in
standard Firefox requires Mozilla signing, which has not been performed.

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

CUSTOM DROPDOWNS
Supports standard dropdowns and common accessible combobox/listbox menus. For
custom menus, options are checked only after you confirm the preview. The add-on
selects a matching option within the linked menu. Unavailable, unrecognized or
unverified choices are reported for manual review. This does not guarantee
compatibility with every Workday or other ATS form.

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

Mozilla temporary installation instructions:
https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/

PROJECT BACKUPS
Private backups, profile exports, .env files, and generated packages must stay
out of Git. .gitignore does not remove previously tracked files or Git history.
The independent local backup is outside this project folder. It contains the
original personal defaults and must not be published.
