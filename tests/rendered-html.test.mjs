import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker;
}

const testEnv = (extra = {}) => ({
  ASSETS: {
    fetch: async () => new Response("Not found", { status: 404 }),
  },
  ...extra,
});

const testContext = {
  waitUntil() {},
  passThroughOnException() {},
};

async function render() {
  const worker = await loadWorker();

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    testEnv(),
    testContext,
  );
}

test("server-renders the public resume without editor chrome", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Folio — Resume Studio<\/title>/i);
  assert.match(html, /Export PDF/);
  assert.match(html, />Edit</);
  assert.match(html, /Zhiheng Liu/);
  assert.match(html, /Software Engineer III · AI &amp; Context Systems/);
  assert.match(html, /OpenViking/);
  assert.doesNotMatch(html, /Resume editor|Shape the story|Duplicate version/);
  assert.doesNotMatch(html, /Unlock the editor/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("edit sessions require the Worker secret and use an HttpOnly cookie", async () => {
  const worker = await loadWorker();
  const env = testEnv({ RESUME_EDIT_KEY: "test-edit-key" });

  const denied = await worker.fetch(
    new Request("https://resume.example/api/edit-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "wrong" }),
    }),
    env,
    testContext,
  );
  assert.equal(denied.status, 401);

  const unlocked = await worker.fetch(
    new Request("https://resume.example/api/edit-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "test-edit-key" }),
    }),
    env,
    testContext,
  );
  assert.equal(unlocked.status, 200);
  const setCookie = unlocked.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /folio_edit_session=/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.doesNotMatch(setCookie, /test-edit-key/);

  const cookie = setCookie.split(";")[0];
  const session = await worker.fetch(
    new Request("https://resume.example/api/edit-session", {
      headers: { cookie },
    }),
    env,
    testContext,
  );
  assert.equal(session.status, 200);
  assert.deepEqual(await session.json(), { authorized: true });
});

test("keeps editing local and includes A4 print rules", async () => {
  const [page, css, layout, packageJson, deployment] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../wrangler.deploy.jsonc", import.meta.url), "utf8"),
  ]);

  assert.match(page, /localStorage\.setItem/);
  assert.match(page, /window\.print\(\)/);
  assert.match(page, /Duplicate version/);
  assert.match(page, /Add impact bullet/);
  assert.match(page, /scrollHeight \/ 1123/);
  assert.match(page, /INITIAL_RESUME_REVISION/);
  assert.match(page, /saved draft/);
  assert.match(page, /Audemars Piguet green/);
  assert.match(page, /Tiffany blue/);
  assert.match(page, /accent: "#315B52"/);
  assert.match(page, /bodySize: 12/);
  assert.match(page, /bodySize}px/);
  assert.match(page, /ZoukResumeChat/);
  assert.match(page, /\.\/zouk-resume-chat/);
  assert.match(page, /density: "open"/);
  assert.doesNotMatch(page, /wantsEdit|searchParams\.has\("edit"\)/);
  assert.match(css, /@page\s*\{[\s\S]*size:\s*A4/i);
  assert.match(css, /@media\s+print/i);
  assert.match(css, /width:\s*210mm/i);
  assert.match(css, /min-height:\s*297mm/i);
  assert.match(css, /@media\s*\(max-width:\s*900px\)[\s\S]*\.resume-page\s*\{[\s\S]*width:\s*100%/i);
  assert.match(css, /@media\s*\(max-width:\s*680px\)[\s\S]*\.resume-section\s*\{[\s\S]*display:\s*block/i);
  assert.match(css, /@media\s*\(min-width:\s*901px\)[\s\S]*\.is-public \.paper-stage\s*\{[\s\S]*padding-bottom:\s*0/i);
  assert.match(css, /\.resume-page\s*\{[\s\S]*min-height:\s*1123px/i);
  assert.match(css, /@media\s*\(max-width:\s*680px\)[\s\S]*\.is-public \.topbar\s*\{[\s\S]*display:\s*none/i);
  assert.match(layout, /og\.png/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(deployment, /"run_worker_first":\s*false/);
});

test("connects the interactive resume to the configured Zouk channel", async () => {
  const chat = await readFile(new URL("../app/zouk-resume-chat.tsx", import.meta.url), "utf8");

  assert.match(chat, /https:\/\/zouk\.zaynjarvis\.com/);
  assert.match(chat, /channel: "zayn"/);
  assert.match(chat, /workspaceId: "zayn"/);
  assert.match(chat, /embed-guest-session/);
  assert.match(chat, /\/api\/messages/);
  assert.match(chat, /new WebSocket/);
  assert.match(chat, /Ask About Zayn/);
});
