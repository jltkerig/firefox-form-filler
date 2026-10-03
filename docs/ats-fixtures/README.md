# Sanitized ATS regression fixtures

This directory stores structural examples used to reproduce form-filling failures without retaining applicants' answers or identities.

Fixture rules:

- Use invented hostnames ending in `.example` and synthetic labels.
- Never include entered values, resumes, names, email addresses, phone numbers, cookies, tokens, complete page HTML, or private group content.
- Keep only control types, normalized labels, relevant ARIA attributes, and a short failure reason.
- Review every exported failure report manually before converting it into a committed fixture. Private `*.private.json` reports remain excluded from Git.
- Add a regression assertion before changing production matching behavior for a fixture.

Run `node scripts/check-ats-fixtures.mjs` to validate the fixture privacy contract and structure.
