/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  RESUME_EDIT_KEY?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

const EDIT_SESSION_COOKIE = "folio_edit_session";
const EDIT_SESSION_TTL_SECONDS = 60 * 60 * 12;
const textEncoder = new TextEncoder();

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      ...init.headers,
    },
  });

const toBase64Url = (bytes: ArrayBuffer) => {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
};

const fromBase64Url = (value: string) => {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "=",
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

async function importSigningKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function createEditSession(secret: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + EDIT_SESSION_TTL_SECONDS;
  const payload = String(expiresAt);
  const key = await importSigningKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(payload));
  return `${payload}.${toBase64Url(signature)}`;
}

async function hasValidEditSession(request: Request, secret?: string) {
  if (!secret) return false;
  const cookie = request.headers.get("cookie") ?? "";
  const value = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${EDIT_SESSION_COOKIE}=`))
    ?.slice(EDIT_SESSION_COOKIE.length + 1);
  if (!value) return false;

  const [expiresAt, signature] = value.split(".");
  if (!expiresAt || !signature || Number(expiresAt) <= Math.floor(Date.now() / 1000)) {
    return false;
  }

  const key = await importSigningKey(secret);
  try {
    return crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(signature),
      textEncoder.encode(expiresAt),
    );
  } catch {
    return false;
  }
}

async function handleEditSession(request: Request, env: Env) {
  if (request.method === "GET") {
    return json({ authorized: await hasValidEditSession(request, env.RESUME_EDIT_KEY) });
  }

  if (request.method === "DELETE") {
    return json(
      { authorized: false },
      {
        headers: {
          "set-cookie": `${EDIT_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`,
        },
      },
    );
  }

  if (request.method !== "POST" || !env.RESUME_EDIT_KEY) {
    return json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { key?: unknown } | null;
  if (typeof body?.key !== "string" || body.key !== env.RESUME_EDIT_KEY) {
    return json({ error: "Invalid edit key" }, { status: 401 });
  }

  const token = await createEditSession(env.RESUME_EDIT_KEY);
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return json(
    { authorized: true },
    {
      headers: {
        "set-cookie": `${EDIT_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${EDIT_SESSION_TTL_SECONDS}${secure}`,
      },
    },
  );
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/edit-session") {
      return handleEditSession(request, env);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
