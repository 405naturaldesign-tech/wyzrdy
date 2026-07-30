---
name: integrated-ai
description: >
  Build AI-powered features on the injected Integrated AI building blocks
  (useIntegratedAi hook, chat component, Express stream route) to utilize LLM
  models inside the generated site — including AI-powered chat, assistants,
  text generation, and image generation/editing. Use when the user wants any
  feature powered by an LLM. Activation is enable_integrated_ai (handled by the
  coding agent) — this skill is for wiring and adapting the injected blocks, not
  provider/API-key setup.
---

# Integrated AI — build on the injected blocks

Integrated AI is a **platform-managed** capability: it lets the site query LLMs
and act on their responses, with provider auth, streaming, and history handled
for you — it is not limited to chat. When enabled it injects a ready-made chat +
image-generation **starter** (the hook, chat component, and Express stream route
below). Your job is to build on those blocks — restyle them, repurpose the hook
for non-chat text tasks, or compose your own UI on top — never to re-implement
the streaming protocol, the API client, or provider auth.

Use this skill when `<files_injected>` lists `use-integrated-ai.jsx` /
`integrated-ai-chat.jsx`, or the task asks for an AI chat / assistant / image
generator / image editor in the generated app.

## Prerequisite — must be enabled first

The building blocks below only exist after `enable_integrated_ai` has run (it
also pulls in Express + PocketBase). If `CODEBASE.md` has no Integrated AI
section and the files aren't present, the coding agent must call
`enable_integrated_ai` and wait for its result before importing any of them.
**Never ask the user for an OpenAI / Gemini / Anthropic / Azure API key** —
the platform has already provisioned credentials.

## ‼️ STEP 1 (MANDATORY): register the Express route

The injected `apps/api/src/routes/integrated-ai.js` is an **orphan** until you
register it. Nothing else does this for you. Skip it and every chat/image
request returns `{"error":"Route not found"}` and the whole feature is dead —
this is the single most common way Integrated AI ships broken.

`apps/api/src/routes/index.js` exports a factory. Add the import at the top and
the `router.use(...)` **inside** the function body, before `return router`:

```js
import { Router } from 'express';
import healthCheck from './health-check.js';
import integratedAiRouter from './integrated-ai.js';   // <-- ADD

const router = Router();

export default () => {
    router.get('/health', healthCheck);
    router.use('/integrated-ai', integratedAiRouter);   // <-- ADD (inside the factory)
    return router;
};
```

Keep `router.use(...)` **inside** the factory, next to `router.get('/health', ...)`
— that's where this codebase registers every route. (`router` is a module-scope
singleton, so a top-level `router.use(...)` after its declaration technically
mutates the same object too, but splitting registrations between the module body
and the factory is an easy way to get the order wrong — e.g. a `router.use(...)`
placed above `const router = Router()` throws. Keep all mounts in one place.)

**Verify after `reload_app`:**
```bash
curl -i -X POST http://localhost:3001/integrated-ai/stream
```
A 4xx from the route's own auth/validation means it's mounted (good). A 404
with `{"error":"Route not found"}` means it is NOT registered — fix index.js.

## ‼️ STEP 2 (MANDATORY): pick the access mode — login is ON by default

The injected `apps/api/src/routes/integrated-ai.js` ships with
`router.use(pocketbaseAuth)`, so **every** request to `/stream` is rejected with
`401 "Please sign in or create an account to use the chat."` unless it carries a
valid PocketBase session. This gates **both chat and image generation** —
`generate_image` runs *inside* `/stream`, so an image generator / editor (e.g. a
Toonify-style app) is login-gated exactly like a chatbot. Generated image
**files** are served at public URLs, but *triggering* a generation needs a
session. Decide ONE mode and wire it fully — leaving auth on without a login flow
ships the feature dead (every request 401s, UI looks built but does nothing).

### PUBLIC — anyone uses it WITHOUT an account
**Only when the user explicitly asks for no login / public access** (e.g. "no
login", "no sign-up", "free for everyone", "anyone can use it") — this applies to
image generators/editors too, which are login-gated by default like everything
else. If the user didn't mention access, do NOT use this mode; default to
LOGIN-REQUIRED. When the user did ask for public, remove BOTH lines from
`apps/api/src/routes/integrated-ai.js` (keep rate limiting + the `/stream`
handler):
```js
import { pocketbaseAuth } from '../middleware/pocketbase-auth.js';   // delete
router.use(pocketbaseAuth);                                          // delete
```

### LOGIN-REQUIRED — members-only / per-user history / paywall
Keep `router.use(pocketbaseAuth)`. ‼️ Then you **MUST** build a working PocketBase
sign-in flow in the SAME build — a `LoginPage` and `SignupPage` using
`pb.collection('users').create(...)` / `pb.collection('users').authWithPassword(...)`,
plus a visible way in (login/sign-up button in the header, or a `ProtectedRoute`
around the feature). Without it the middleware is on but no one can obtain a
session → every request 401s. Per-user chat history requires this mode.

### If the request is unclear
Default to **LOGIN-REQUIRED** — keep `router.use(pocketbaseAuth)` and ship the
PocketBase sign-in flow (LoginPage/SignupPage) in the SAME build. This holds for
ANY Integrated AI app, including image/photo generators and editors — not just
chatbots. Only go **PUBLIC** when the user explicitly asks for it ("no login",
"no sign-up", "free for everyone", "anyone can use it", "public"). **Always state
in your final reply which mode shipped** — and if it's login-required, that
visitors must sign up to use it (and can ask to make it public).

**Never edit `apps/api/src/middleware/pocketbase-auth.js`** (read-only) — toggle
access only by adding/removing `router.use(pocketbaseAuth)` in the route file.

## Do not scaffold — the injected blocks are canonical

Import and compose these; do not recreate them, duplicate their exports, or
call the AI backend directly.

| File | What it is | You |
|---|---|---|
| `apps/web/src/hooks/use-integrated-ai.jsx` | The hook: streaming, history, image extraction | **use it** |
| `apps/web/src/components/integrated-ai-chat.jsx` | A ready chat UI (text + image upload + render) | use or restyle |
| `apps/web/src/lib/integratedAiClient.js` | `/hcgi/api` client (SSE + fetch) | don't bypass |
| `apps/api/src/routes/integrated-ai.js` | Express `POST /stream` route | register (above) |
| `apps/api/src/api/integrated-ai.js` | Server proxy → AI backend, PocketBase persistence | don't edit |
| `apps/api/src/constants/prompts.js` | The system prompt sent to the model | edit to change behavior |

PocketBase collections `_integratedAiMessages` (chat history) and
`_integratedAiImages` (uploaded/generated image storage) are created by the
injected migrations — don't redefine them.

## The hook API — `useIntegratedAi()`

```jsx
import { useIntegratedAi } from '@/hooks/use-integrated-ai';

const { messages, isStreaming, isLoadingHistory, sendMessage, clearMessages } = useIntegratedAi();
```

| Field | Type | Notes |
|---|---|---|
| `messages` | `Message[]` | Full conversation, oldest first. Re-render off this. |
| `isStreaming` | `boolean` | A response is in flight — disable the composer / show a spinner. |
| `isLoadingHistory` | `boolean` | History is loading from PocketBase on mount. |
| `sendMessage` | `(text: string, images?: File[]) => Promise<void>` | Send a user turn. `images` are raw `File` objects (e.g. from an `<input type="file">`); they upload as multipart and become the user message's image refs. |
| `clearMessages` | `() => void` | Clear the in-memory transcript. |

### Message shape

```ts
type Message = {
  role: 'user' | 'assistant',
  content: string,        // text — streams in incrementally for assistant turns
  images?: string[],      // IMAGE URLs (strings), ready for <img src=...>
};
```

**`images` are always URL strings, on both roles** — user-uploaded photos and
AI-generated images alike. The hook handles all parsing; you never touch raw
SSE or JSON. Just render `message.images`.

## Rendering — text + an image gallery

The injected chat component already does this. For a custom UI, render
`content` as text and `images` as `<img>`:

```jsx
{messages.map((m, i) => (
  <div key={i} className={m.role === 'user' ? 'user' : 'assistant'}>
    {m.content && <p>{m.content}</p>}
    {m.images?.map((url, j) => (
      <img key={j} src={url} alt="" loading="lazy" />
    ))}
  </div>
))}
```

For an **image-generator gallery** (no chat bubbles), flatten every assistant
`images[]` into a grid, newest first, optionally pairing each with the
preceding user prompt:

```jsx
const gallery = [];
for (let i = 0; i < messages.length; i++) {
  const m = messages[i];
  if (m.role !== 'assistant' || !m.images?.length) continue;
  const prompt = messages[i - 1]?.role === 'user' ? messages[i - 1].content : '';
  for (const url of m.images) gallery.push({ url, prompt });
}
gallery.reverse(); // newest first
```

Send a prompt with `sendMessage(promptText)`; the generated image arrives on
the next assistant message's `images[]`.

## The `generate_image` capability

The model decides when to call it from the user's text — you don't invoke it
directly. It can **generate** (text → image) and **edit** (image(s) → image).
What it supports, so you can build the right UI affordances:

- **Editing / multi-image merge:** when the user uploads photos (pass them via
  `sendMessage(text, files)`), the model can use them as references — e.g.
  "make this chair fit this room", or merge two images. Build an upload control
  (`<input type="file" accept="image/*" multiple>`) and pass the `File`s.
- **Aspect ratios:** `1:1`, `16:9`, `9:16`, `4:3`, `3:4`.
- **Resolution:** `1K` (default), `2K`, `4K`.

You don't pass these as arguments — the model infers them from the prompt. To
expose them in UI, fold them into the prompt text (e.g. append "16:9, 4K").

## Wire format (reference — for debugging only)

You should not parse this yourself; the hook does. Included so you can read the
stream when debugging. The Express route streams snake_case SSE frames:

```text
data: {"type":"content","data":{"role":"assistant","agent_name":"integrated_ai","content":"..."},"metadata":{"agent_name":"integrated_ai"}}
data: {"type":"tool_result","data":{"tool_call_id":"...","tool_name":"generate_image","content":"https://<site>/hcgi/platform/.../image.png"},"metadata":{"agent_name":"integrated_ai"}}
data: {"type":"completed","data":{"content":"[COMPLETED]"}}
```

Key fields the hook keys off: a `tool_result` frame with
`data.tool_name === "generate_image"` carries the image **URL directly** in
`data.content` (already unwrapped server-side — it is a bare URL string, not
JSON). `content` frames carry streaming text in `data.content`. An `error`
frame carries the message in `data.content`. The path prefix `/hcgi/api` (API)
and `/hcgi/platform` (PocketBase/files) are the site's reverse-proxy routes —
image URLs come back fully qualified and render as-is.

## Checklist

Final gate for the things that silently ship the feature broken:

- [ ] Registered `integrated-ai.js` in `apps/api/src/routes/index.js` (the #1 gotcha)
- [ ] `reload_app` + curled `/integrated-ai/stream` to confirm the route is mounted
- [ ] Picked an access mode: login-required (default — kept `router.use(pocketbaseAuth)`) **with** a working LoginPage/SignupPage shipped in the same build, **or** PUBLIC (removed `router.use(pocketbaseAuth)`) only because the user explicitly asked for it — never auth-on with no login flow
- [ ] Stated the access mode in the final reply
