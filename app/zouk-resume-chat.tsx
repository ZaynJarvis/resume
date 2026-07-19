"use client";

import type { CSSProperties, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const ZOUK = {
  serverUrl: "https://zouk.zaynjarvis.com",
  workspaceId: "zayn",
  channel: "zayn",
  guestName: "resume-visitor",
} as const;

const BROWSER_ID_KEY = "folio.zouk.browser-id";

type ChatStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "sending"
  | "closed"
  | "error";

type ZoukMessage = {
  id: string;
  content: string;
  senderName: string;
  senderType: string;
  createdAt: string;
  channelName: string;
};

function createBrowserId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function getBrowserId() {
  if (typeof window === "undefined") return "";
  try {
    const current = window.localStorage.getItem(BROWSER_ID_KEY);
    if (current) return current;
    const next = createBrowserId();
    window.localStorage.setItem(BROWSER_ID_KEY, next);
    return next;
  } catch {
    return createBrowserId();
  }
}

function normalizeMessage(raw: Record<string, unknown> | null | undefined): ZoukMessage | null {
  if (!raw) return null;
  const id = String(raw.id ?? raw.messageId ?? "");
  if (!id) return null;
  return {
    id,
    content: String(raw.content ?? ""),
    senderName: String(raw.senderName ?? raw.sender_name ?? "unknown"),
    senderType: String(raw.senderType ?? raw.sender_type ?? "human"),
    createdAt: String(raw.createdAt ?? raw.timestamp ?? new Date().toISOString()),
    channelName: String(raw.channelName ?? raw.channel_name ?? ""),
  };
}

function mergeMessage(current: ZoukMessage[], next: ZoukMessage | null) {
  if (!next || next.senderType === "system" || next.senderName === "system") return current;
  if (current.some((message) => message.id === next.id)) return current;
  return [...current, next].slice(-80);
}

async function readJson(response: Response) {
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(body.error ?? `Zouk request failed (${response.status})`));
  }
  return body;
}

function websocketUrl(token: string) {
  const url = new URL("/ws", ZOUK.serverUrl);
  url.protocol = "wss:";
  url.searchParams.set("token", token);
  url.searchParams.set("workspaceId", ZOUK.workspaceId);
  return url.toString();
}

function publicResumeUrl() {
  if (typeof window === "undefined") return "https://resume.zaynjarvis.com/";
  return `${window.location.origin}${window.location.pathname}`;
}

function withResumeContext(message: string) {
  return [
    "<zouk-context>",
    `  <url>${publicResumeUrl()}</url>`,
    "  <surface>interactive-resume</surface>",
    "</zouk-context>",
    "",
    message.trim(),
  ].join("\n");
}

function visibleContent(content: string) {
  return content.replace(/^<zouk-context>[\s\S]*?<\/zouk-context>\s*/i, "").trim();
}

function MessageIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.5 15.5a3 3 0 0 1-3 3H9l-5.5 3V7a3.5 3.5 0 0 1 3.5-3.5h10a3.5 3.5 0 0 1 3.5 3.5Z" />
      <path d="M8 9h8M8 13h5" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m21 3-8.5 18-2.2-7.3L3 11.5 21 3Z" />
      <path d="m10.3 13.7 4.4-4.4" />
    </svg>
  );
}

export function ZoukResumeChat({ accent }: { accent: string }) {
  const [open, setOpen] = useState(false);
  const [browserId] = useState(getBrowserId);
  const [token, setToken] = useState("");
  const [userName, setUserName] = useState(ZOUK.guestName);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<ZoukMessage[]>([]);
  const [composer, setComposer] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const connectPromiseRef = useRef<Promise<string> | null>(null);
  const target = `#${ZOUK.channel}`;

  const visibleMessages = useMemo(
    () => messages.filter((message) => message.senderType !== "system" && message.senderName !== "system"),
    [messages],
  );

  const loadHistory = useCallback(async (sessionToken: string) => {
    const response = await fetch(`${ZOUK.serverUrl}/api/messages`, {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "Content-Type": "application/json",
        "X-Workspace-Id": ZOUK.workspaceId,
        "X-Channel": target,
        "X-Limit": "60",
      },
      cache: "no-store",
    });
    const body = await readJson(response);
    const history = Array.isArray(body.messages) ? body.messages : [];
    setMessages(
      history
        .map((message) => normalizeMessage(message as Record<string, unknown>))
        .filter((message): message is ZoukMessage => Boolean(message && message.senderType !== "system")),
    );
  }, [target]);

  const connect = useCallback(async () => {
    if (token) return token;
    if (connectPromiseRef.current) return connectPromiseRef.current;
    const connection = (async () => {
      setStatus("connecting");
      setError("");
      const response = await fetch(`${ZOUK.serverUrl}/api/auth/embed-guest-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: ZOUK.workspaceId,
          channel: ZOUK.channel,
          name: ZOUK.guestName,
          browserId,
          picture: `${publicResumeUrl()}og.png`,
        }),
      });
      const body = await readJson(response);
      const nextToken = String(body.token ?? "");
      if (!nextToken) throw new Error("Zouk did not return a guest session.");
      const user = body.user as Record<string, unknown> | undefined;
      setToken(nextToken);
      setUserName(String(user?.name ?? ZOUK.guestName));
      await loadHistory(nextToken);
      setStatus("connected");
      return nextToken;
    })();
    connectPromiseRef.current = connection;
    try {
      return await connection;
    } catch (reason) {
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "Unable to connect to Zouk.");
      throw reason;
    } finally {
      connectPromiseRef.current = null;
    }
  }, [browserId, loadHistory, token]);

  useEffect(() => {
    if (!token) return;
    const socket = new WebSocket(websocketUrl(token));
    socket.onopen = () => setStatus((current) => current === "sending" ? current : "connected");
    socket.onclose = () => setStatus((current) => current === "error" ? current : "closed");
    socket.onerror = () => setError("Live replies were interrupted. You can still retry here.");
    socket.onmessage = (event) => {
      try {
        const packet = JSON.parse(event.data) as Record<string, unknown>;
        if ((packet.type === "message" || packet.type === "new_message") && packet.message) {
          const next = normalizeMessage(packet.message as Record<string, unknown>);
          if (next?.channelName === ZOUK.channel) {
            setMessages((current) => mergeMessage(current, next));
          }
        }
      } catch {
        // Zouk may send non-JSON heartbeat frames.
      }
    };
    return () => socket.close();
  }, [token]);

  useEffect(() => {
    if (!open) return;
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [open, visibleMessages.length]);

  const openChat = () => {
    setOpen(true);
    void connect().catch(() => undefined);
    window.setTimeout(() => inputRef.current?.focus(), 120);
  };

  const sendMessage = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const message = composer.trim();
    if (!message || status === "sending") return;
    setOpen(true);
    setStatus("sending");
    setError("");
    try {
      const sessionToken = await connect();
      const response = await fetch(`${ZOUK.serverUrl}/api/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
          "X-Workspace-Id": ZOUK.workspaceId,
        },
        body: JSON.stringify({ target, content: withResumeContext(message) }),
      });
      const body = await readJson(response);
      setMessages((current) => mergeMessage(
        current,
        normalizeMessage(body.message as Record<string, unknown> | undefined),
      ));
      setComposer("");
      setStatus("connected");
    } catch (reason) {
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "Message failed to send.");
    }
  };

  const chatStyle = { "--chat-accent": accent } as CSSProperties;
  const connectionLabel =
    status === "connecting"
      ? "Connecting"
      : status === "sending"
        ? "Sending"
        : status === "error"
          ? "Needs attention"
          : status === "connected"
            ? "Live"
            : "#zayn";

  return (
    <div className={`resume-chat${open ? " is-open" : ""}`} style={chatStyle}>
      {!open && (
        <button
          className="resume-chat-launcher"
          type="button"
          onClick={openChat}
          aria-label="Ask About Zayn"
          aria-expanded="false"
        >
          <MessageIcon />
          <span>Ask About Zayn</span>
        </button>
      )}

      {open && (
        <aside className="resume-chat-panel" aria-label="Ask About Zayn">
          <header className="resume-chat-header">
            <div>
              <span className="resume-chat-kicker">Interactive résumé</span>
              <h2>Ask About Zayn</h2>
            </div>
            <div className="resume-chat-header-actions">
              <span className={`resume-chat-status is-${status}`}>
                <i aria-hidden="true" />{connectionLabel}
              </span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close chat">×</button>
            </div>
          </header>

          <div className="resume-chat-messages" ref={scrollRef} aria-live="polite">
            {!visibleMessages.length && status === "connecting" && (
              <div className="resume-chat-empty">Opening a live line to <b>#zayn</b>…</div>
            )}
            {!visibleMessages.length && status !== "connecting" && (
              <div className="resume-chat-intro">
                <span>Not a PDF dead end.</span>
                <h3>Ask about the work behind the résumé.</h3>
                <p>Try “What did Zayn build for OpenViking?” or ask where his experience fits your team.</p>
              </div>
            )}
            {visibleMessages.map((message) => {
              const mine = message.senderName === userName;
              return (
                <article className={`resume-chat-message${mine ? " is-mine" : ""}`} key={message.id}>
                  {!mine && <span>{message.senderName}</span>}
                  <div>{visibleContent(message.content)}</div>
                </article>
              );
            })}
          </div>

          <form className="resume-chat-composer" onSubmit={sendMessage}>
            <textarea
              ref={inputRef}
              value={composer}
              onChange={(event) => setComposer(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              rows={1}
              placeholder="Ask about Zayn's work…"
              aria-label="Message #zayn"
            />
            <button
              type="submit"
              disabled={!composer.trim() || status === "sending"}
              aria-label="Send message to #zayn"
            >
              <SendIcon />
            </button>
            {error && (
              <div className="resume-chat-error" role="alert">
                <span>{error}</span>
                <button type="button" onClick={() => void connect().catch(() => undefined)}>Retry</button>
              </div>
            )}
          </form>
        </aside>
      )}
    </div>
  );
}
