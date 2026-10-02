# resume.zaynjarvis.com

An editorial resume site with a private, browser-local editing mode.

## Public view

The default route shows only the resume and an **Export PDF** action. Resume
content is server-rendered from the checked-in initial structure, then replaced
by a valid local draft when one exists in the current browser.

## Edit mode

Click **Edit**, enter the edit key, and the Worker will issue a short-lived,
HttpOnly edit session. Query parameters never open the editor automatically.
The key is stored as the Cloudflare Worker secret
`RESUME_EDIT_KEY`; it is never included in the client bundle.

Editing is intentionally best-effort and device-local. Drafts are validated and
saved as structured JSON in `localStorage` under
`folio-resume-versions-v1`. No resume edits are written to Cloudflare or GitHub.

## Development

```bash
npm install
npm run dev
npm test
```

Local edit authentication reads `.dev.vars`, which is ignored by Git.

## Deployment

The production Worker is configured in `wrangler.deploy.jsonc` and serves
`resume.zaynjarvis.com` as a Cloudflare Custom Domain.

```bash
npm run deploy
npx wrangler secret put RESUME_EDIT_KEY
```

GitHub Actions (`.github/workflows/deploy.yml`) builds, tests, and deploys every
push to `master`. It can also be run manually from the Actions tab. Dependencies,
including Wrangler, are installed from `package-lock.json`.

One-time setup:

1. Create a Cloudflare API token using the **Edit Cloudflare Workers** template,
   restricted to the account in `wrangler.deploy.jsonc` and the `zaynjarvis.com`
   zone (the deployment config includes a Custom Domain).
2. Add it as the repository Actions secret `CLOUDFLARE_API_TOKEN`.
3. Run **Deploy resume** from Actions, or re-run the failed setup run.

No token belongs in Git. Existing Worker secrets (including `RESUME_EDIT_KEY`)
remain on Cloudflare; `keep_vars` is enabled in the deployment config.

Reference: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
