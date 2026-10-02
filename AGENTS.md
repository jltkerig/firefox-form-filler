# Project Protection Rules

These rules replace all earlier versions of these protection rules. Preserve existing unrelated project instructions.

## REPOSITORY AND PROJECT ACCESS

1. The only authorized GitHub repository is:
   https://github.com/jltkerig/firefox-form-filler

   Do not access any other GitHub repository, including private backup repositories.

2. This repository is intentionally public so future employers can review the project. Do not change its visibility.

3. Within C:\Users\Jamie\Desktop\Work-Jamie\python, local access is limited to:
   - firefox-form-filler
   - firefox-form-filler-private-backup
   - Additional folders created specifically for this project under these rules.

   Do not inspect, search, read, modify, move, or delete other project folders or their contents. Access to the python parent folder does not grant access to unrelated projects.

4. Do not access other repositories, accounts, or local folders outside the authorized scope without my explicit authorization identifying the exact repository, account, or folder. A new task does not grant unrestricted access.

5. Normal development tools and dependencies may be used for this project. Do not use them to inspect unrelated personal files or projects.

## FILE PROTECTION AND BACKUPS

6. Preserve existing functionality, files, and saved data except for the specific changes I authorize. Make focused edits. Do not rewrite unrelated parts of the project.

7. Before modifying existing files, back up their current state:
   - Commit and push publishable source code and documentation to the designated public repository.
   - Back up sensitive or excluded project files only to the designated independent local backup folder:
     C:\Users\Jamie\Desktop\Work-Jamie\python\firefox-form-filler-private-backup
   - If a file mixes source code with private information, preserve its original state only in the local backup. Never publish it merely to satisfy the backup requirement.
   - Include relevant uncommitted work and untracked files in the appropriate backup.
   - Verify that each required backup succeeded before editing.
   - If a required backup destination is not configured or verification fails, stop and tell me.

8. Normal backup commits, pushes, and syncs do not require separate confirmation when their destinations and contents are already authorized. Never force-push or resolve conflicts by discarding work without following the confirmation process below.

9. The PUBLIC repository may contain only source code, documentation, and sanitized sample data. Never publish:
   - Passwords, API keys, tokens, or credentials.
   - .env files or other secret configuration.
   - Private personal information.
   - Collected Facebook posts or private group content.
   - Real job-search datasets or private application records.

10. Keep credentials, .env files, and sensitive project data in an appropriately protected local backup. Do not upload them to another repository or service. Uploading personal datasets or collected Facebook content requires my explicit authorization for both the content and destination.

11. Identify files excluded from each backup. Never claim that GitHub protects files that were not included in a verified pushed commit. Adding a file to .gitignore does not remove previously tracked content or erase Git history.

## ONE-CONFIRMATION PROCESS

12. Require ONE SEPARATE, EXPLICIT CONFIRMATION before:
   - Deleting existing files or folders.
   - Erasing, truncating, resetting, or replacing saved data.
   - Removing existing functionality.
   - Replacing an entire existing file.
   - Running commands or scripts that discard existing work.
   - Force-pushing or rewriting Git history.
   - Deleting repositories, branches, or backups.

13. Follow this process:
   - List the exact affected files, folders, data, or Git references.
   - Explain the proposed action, its consequences, and the backup plan.
   - Ask for one explicit confirmation and wait for my reply.
   - After approval, create or reverify appropriate backups before performing the action.
   - Report the backup location or repository, branch, and commit ID, and explain how the affected work can be restored.
   - Perform only the approved action. No additional confirmation is required unless its scope changes.

14. The confirmation must be a separate user reply clearly approving the listed action and backup plan. Silence, elapsed time, unrelated previous approvals, and general requests such as “update,” “fix it,” or “clean up” do not count.

15. If the proposed action or affected files change after approval, present the revised scope and obtain a new confirmation. Approval applies only to the exact reviewed scope.

16. If the backups cannot preserve everything affected, stop until an additional appropriate backup has been created and verified. Do not expose private data to complete a backup.

17. Never bypass these rules through helper scripts, dependencies, build tools, cleanup commands, indirect commands, or permission changes.

18. Prefer archiving over permanent deletion. Moving existing files out of their original locations still requires the confirmation process. Never modify or delete independent backups outside the working project.

19. Do not weaken, remove, or override these protection rules without one separate, explicit confirmation. Identify the exact rule changes or task-specific exception being approved.

## BUG REVIEW AND VERIFICATION

20. When making code changes, inspect affected code and directly related functionality for bugs, regressions, error handling problems, and risks to saved data.

21. Run appropriate tests or checks when available. Clearly distinguish verified behavior from assumptions. Never claim that something works unless it was actually verified.

22. Fix bugs within the requested scope while following all backup and confirmation rules. Report unrelated bugs encountered during authorized work with their location, likely impact, and recommended fix. Do not inspect unrelated projects, rewrite unrelated code, or remove functionality to make a test pass.

23. If a bug could cause data loss, stop operations that could trigger it and explain the issue before proceeding. Never test destructive behavior against the real dataset; use a disposable copy within an authorized project-specific folder.

24. After completing a task, report changed files, verification results, and backup status. Clearly identify anything the backups do not cover.

25. During every project task, look for data leaks and security flaws in the affected code and directly related paths. Check how untrusted page content, saved answers, permissions, local storage, clipboard use, and build or release steps could expose private data or change application behavior. Verify concrete findings where practical, fix issues within the authorized scope under the backup and confirmation rules, and report any remaining risks with file locations and their likely impact. Do not describe a source review as a live security test.

These rules are instructions, not a technical guarantee. Repository access must also be restricted through account permissions and local filesystem permissions where available. Do not describe these instructions as making unauthorized access or data loss impossible.
