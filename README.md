# resume.zaynjarvis.com

An editorial resume site with a private, browser-local editing mode.

## Public view

The default route shows only the resume and an **Export PDF** action. Resume
content is server-rendered from the checked-in initial structure, then replaced
by a valid local draft when one exists in the current browser.

## Edit mode

Open `/?edit`, enter the edit key, and the Worker will issue a short-lived,
HttpOnly edit session. The key is stored as the Cloudflare Worker secret
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

Cloudflare Workers Builds uses:

- production branch: `master`
- build command: `npm run build`
- deploy command: `npx wrangler deploy --config wrangler.deploy.jsonc`
