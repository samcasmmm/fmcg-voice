# fmcg-voice: detailed project documentation

A browser-based AI voice agent that lets FMCG retailers talk to a sales assistant. The retailer can ask about products, prices, schemes and stock, place order enquiries, and request follow-ups. When the call ends, the app writes a summary, decides an outcome, and saves everything for the sales team.

The company, brands, products, retailers and phone numbers are fictional. The company is called **Sahyog Consumer Products** and the assistant is called **Asha**.

For setup steps, see the [README](../README.md). For the original brief, see [requirements.md](requirements.md).

---

## 1. Requirement coverage

| Requirement from the brief | How it is met |
| --- | --- |
| Speak with an AI assistant in the browser and hear spoken replies | Sarvam Saaras turns speech into text; Sarvam Bulbul turns replies into speech (voice: Simran). Hands-free by default, so the mic reopens after each reply, like a phone call. |
| Text fallback if voice is not supported | The text box is always visible. If no speech input is possible, the call runs as text only. If audio playback fails, replies stay on screen and the browser voice is tried. |
| Answer questions on products, prices, schemes and availability from sample data | The agent's instructions include the live catalogue and active schemes from Postgres. It is told to use only that data. |
| Capture product interest, quantities and follow-ups | The agent calls tools that write to the database: `recordItem`, `removeItem`, `recordFollowUp`. A live side panel shows what was captured. |
| Generate a summary and save details and outcome at the end | The End call button (or the agent, after saying goodbye) triggers a summary. A second model writes it in English, with an outcome and a next step. The transcript, items and follow-ups are saved. |
| Simple interface to start, interact and review | Three screens: Call (`/`), History (`/history` and `/history/[id]`), and Catalogue (`/catalogue`). |

---

## 2. Technology stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16 (App Router, React 19, TypeScript) | One codebase for the UI, the API routes and server actions. Server components read the database directly. |
| UI | Tailwind CSS v4, shadcn/ui (Radix) | Accessible ready-made components, quick to style. |
| Database | PostgreSQL (Neon in development), Drizzle ORM | Typed schema and queries, SQL migrations checked into the repo. |
| AI framework | Vercel AI SDK 7 | One API for streaming, tool calling and structured output across providers; `useChat` on the client. |
| Chat model | Groq `qwen/qwen3.8-27b` (default) or Google `gemini-2.5-flash` | Fast and free tier available. Switch with `AI_PROVIDER`. |
| Summary model | Groq `openai/gpt-oss-20b` | Separate model, so the summary does not share the chat model's rate limit. |
| Speech-to-text | Sarvam Saaras v4, with Groq Whisper as backup | Built for Indian English, Hindi and Hinglish. Accepts product names as hints. |
| Text-to-speech | Sarvam Bulbul v4-flash, with the browser voice as backup | Natural Indian voices in English and Hindi. |
| Package manager and tests | Bun, `bun test` | Fast installs; built-in test runner. |

---

## 3. Architecture

```
 BROWSER                                           SERVER (Next.js)
 ───────                                           ────────────────
 Mic ─► record + silence detection ──► POST /api/transcribe ──► Sarvam Saaras
                                            (Groq Whisper if Sarvam fails)
                    text ◄──────────────────────┘
   │
   ▼
 useChat (AI SDK) ─────────────────► POST /api/chat
   ▲                                   1. load conversation from Postgres
   │  streamed reply + tool results    2. build instructions (catalogue, schemes, retailer)
   └───────────────────────────────    3. streamText(model, tools)
                                        4. tools write order lines / follow-ups to Postgres
                                        5. save the updated transcript
   │
   ▼
 reply text ─────────────────────────► POST /api/speech ──► Sarvam Bulbul (MP3)
 audio plays ◄─────────────────────────┘    (browser voice if Sarvam fails)

 End call ─► server action ─► summary model ─► save summary + outcome ─► /history/[id]
```

### One conversation turn, step by step

1. **Listen.** The browser records the retailer with `MediaRecorder`. A silence detector stops the recording 1.2 seconds after they stop talking.
2. **Transcribe.** The audio goes to `/api/transcribe`, which calls Sarvam Saaras v4 in the call's language (`en-IN` or `hi-IN`), passing all product names as `keyterms`. If Sarvam fails, the server retries the same audio with Groq Whisper.
3. **Think.** The text is sent with `useChat` to `/api/chat`. Only the newest message is sent; the server loads the full history from Postgres.
4. **Act.** The model answers, and may call tools: identify the retailer, record an order line, record a follow-up, or end the call. Tool results stream back to the browser.
5. **Speak.** The reply text goes to `/api/speech`. The first sentence is requested on its own so audio starts quickly; the rest is fetched in parallel and played in order.
6. **Loop.** In hands-free mode, the mic opens again. The retailer can also interrupt Asha by tapping the mic, or type instead.

---

## 4. Voice pipeline

### Speech-to-text

| Engine | When used | Notes |
| --- | --- | --- |
| Sarvam Saaras v4 | Default | Recorded audio, max 30 s per turn. Product names sent as `keyterms`. In testing it heard "Khetsona Chakki Atta" and "Dhoop detergent" correctly. |
| Groq Whisper (`whisper-large-v3-turbo`) | Automatic server-side backup if Sarvam fails; also selectable | Gets a text hint with the product names. |
| Browser Web Speech API | Optional | Free, but depends on the browser vendor's service. If it is unavailable, the call switches to Sarvam automatically. |

### Text-to-speech

| Engine | When used | Notes |
| --- | --- | --- |
| Sarvam Bulbul v4-flash | Default | Voice `simran_en_sales` (English) or `simran_hi_sales` (Hindi). MP3, 24 kHz. About 1 to 1.5 s per reply. |
| Browser `speechSynthesis` | Backup, or selectable | Used for whatever was not spoken if Sarvam fails or audio is blocked. Hindi depends on the voices installed on the device. |

### Turn-taking

- Asha speaks first (a greeting stored with the conversation).
- **Hands-free:** after each reply, the mic opens automatically. **Push-to-talk:** tap the mic for each turn.
- **Barge-in:** tapping the mic while Asha speaks stops her and starts listening.
- Every new turn invalidates the previous one, so an interrupted reply cannot trigger stale listening.
- Browsers only allow audio after a user gesture, so the **Start call** click unlocks audio playback up front.

### Error handling

Each failure shows a specific message: microphone blocked, no microphone found, network problem, or the raw error code. "Heard nothing" is not treated as an error.

---

## 5. The AI agent

### Instructions (system prompt)

Built fresh on every request in `src/lib/agent/prompt.ts`. It contains:

- The persona, today's date, and who the caller is (if known).
- Speaking rules: 1 to 3 short sentences, no lists or markdown (the text is read aloud), and reply in the call's language.
- Fact rules: use only the catalogue and schemes below; never invent prices, stock or delivery dates; orders are enquiries the sales team confirms.
- Tool rules: when to record an order, interest or follow-up; confirm order lines using the tool result; suggest one related product after an order; end the call after the goodbye.
- The catalogue (10 products) and the active schemes, in a compact table.

### Tools

| Tool | What it does |
| --- | --- |
| `identifyRetailer` | Finds the retailer by phone number, or by the distinctive words of the spoken shop name (ignores words like "store" or "kirana"). Links the retailer to the call, or saves the spoken name as a new lead. |
| `recordItem` | Adds or replaces an order line (with quantity) or a product interest. Prices it on the server. |
| `removeItem` | Removes a cancelled product. |
| `recordFollowUp` | Saves a callback, rep visit, samples request, credit query or complaint, with a date if given. |
| `endCall` | Ends the call. The tool loop stops here, so Asha says goodbye only once. |

### Pricing is done in code, not by the model

`src/lib/pricing.ts` calculates every order line: units, gross value at the retailer price (PTR), and the best active scheme for that quantity. It supports three scheme types: percent off, flat rupees off per block of cases, and free cases per block. The model reads back the computed result. This avoids arithmetic mistakes.

Example: 6 cases of Chaiwala Gold Tea 1 kg = 72 packs × ₹482 = ₹34,704, minus 8% (CHAI-8) = **₹31,927.68**.

### Model settings

- Reasoning is switched off (Qwen) or kept low, because voice needs fast replies.
- At most 5 model steps per turn, and the loop stops after `endCall`.
- Messages are validated against the tool schemas (`validateUIMessages`) before every model call.

---

## 6. End of call and summary

1. The call ends when the retailer clicks **End call**, or when the agent calls `endCall` after saying goodbye.
2. A server action (`endConversation`) collects the transcript, order lines, interests and follow-ups.
3. The summary model returns structured output: a 2 to 4 sentence English summary, an outcome, and a next step.
4. Outcomes: `order_enquiry`, `follow_up`, `interested`, `not_interested`, `no_outcome`.
5. If the model call fails, a rule-based fallback picks the outcome from the captured data.
6. The browser goes to the call detail page.

---

## 7. Data model

| Table | Contents |
| --- | --- |
| `products` | SKU, name, brand, category, pack size, units per case, MRP, retailer price (PTR), stock status, colloquial and Hindi aliases, description |
| `schemes` | Code, title, type (percent off, flat off, free cases), target product or category, minimum cases, value, valid until |
| `retailers` | Shop name, owner, phone, town, area, preferred language |
| `conversations` | Retailer (or spoken name for a new lead), language, status, outcome, summary, next step, full transcript (JSONB), start and end time |
| `captured_items` | One row per product per call: order or interest, quantity, unit, applied scheme, estimated value, free cases |
| `follow_ups` | Type, due date, notes |

**Sample data:** 10 products in 5 categories (staples, beverages, personal care, home care, snacks), 5 schemes, 6 retailers in different cities. Two products are low on stock and one is out of stock, so those conversations can be demonstrated.

---

## 8. Screens

| Screen | What it shows |
| --- | --- |
| **Call** (`/`) | Setup: retailer (optional), language (English or Hindi), speech recognition engine, Asha's voice, hands-free. Then the same page becomes the live call: status (speaking, listening, thinking), transcript with product cards, mic, text box, End call, and a side panel with the retailer, order lines and total, interests and follow-ups. |
| **History** (`/history`) | Every call with date, retailer, outcome, number of order lines, estimated value and follow-ups. |
| **Call detail** (`/history/[id]`) | Summary and next step, order table with schemes and total, interests, follow-ups, and the full transcript. |
| **Catalogue** (`/catalogue`) | All products with prices, margin, stock and schemes, plus the scheme list. |

### Product cards

When Asha names a product (answering a question, suggesting something, offering an alternative, listing a category), a card appears under her reply. It shows the image, name, pack size, price per pack and per case, MRP and margin, stock and scheme. A card appears only on a product's first mention in the call.

Cards come from matching product names in the reply text against the catalogue (brand, product word, then pack size). This needs no extra model call, which matters on a rate-limited free tier. Images are read from `public/products/<SKU>.webp` (or `.png`/`.jpg`); without one, a category tile is shown.

---

## 9. Project structure

```
src/
  app/
    (app)/            Call, History, Call detail and Catalogue pages, plus the shared header
    api/chat/         The agent: streams replies and runs tools
    api/transcribe/   Speech-to-text (Sarvam, Whisper backup)
    api/speech/       Text-to-speech (Sarvam)
    actions.ts        Server actions: start and end a conversation
  components/call/    Setup, live call, transcript, status, captured panel
  hooks/              Speech input (recording, silence detection) and speech output (playback)
  lib/agent/          Prompt, tools, summary, captured-state helper
  lib/ai/             Model selection (Groq / Google) and the Sarvam client
  lib/                Pricing, product matching, catalogue and conversation queries, formatting
  db/                 Drizzle schema, client, seed script
drizzle/              SQL migrations
docs/                 Requirements, approach, this document, interview prep, demo script
```

---

## 10. Quality and testing

- **Unit tests** (`bun test`, 15 tests): pricing and scheme selection, and product-name matching (including Hindi replies).
- **End-to-end checks in Chrome:** a typed English call, a voice loop with a simulated microphone (Sarvam both ways), automatic switching when browser speech recognition fails, product cards, ending a call and returning to a fresh setup.
- **API checks:** a Hindi conversation (retailer match, misheard product name, order, single goodbye), Sarvam speech in English and Hindi.
- TypeScript strict mode, ESLint, and a production build.

---

## 11. Assumptions

- All business data is fictional.
- Quantities are in cases unless the retailer says pieces or packs.
- Prices quoted to retailers are PTR. MRP and margin are mentioned only when asked.
- Captured orders are enquiries. The sales team confirms the final order, price and delivery.
- One best scheme applies per order line.
- The agent understands English, Hindi and Hinglish, and replies in the language chosen for the call. Summaries are always in English.
- No login: this is a single-tenant prototype, not a production telecalling system.

---

## 12. Known limitations

| Limitation | Effect | Way out |
| --- | --- | --- |
| Groq free tier: 8,000 tokens per minute per model | A turn that records something can wait up to a minute | Paid tier, or `AI_PROVIDER=google` |
| Qwen's Hindi wording | Understandable, but sometimes the wrong word | A stronger model for Hindi calls |
| Sarvam REST speech-to-text is 30 s per request | Very long turns are cut | Sarvam streaming API |
| Text-to-speech starts after the reply is complete | About 1 to 2 s of silence before Asha speaks | Stream speech while the reply is generated |
| Catalogue sits in the prompt | Fine for 10 products, not for thousands | A product search tool |

---

## 13. Next steps

- Stream text-to-speech sentence by sentence while the reply is still generating.
- Use Sarvam's streaming speech-to-text for lower latency.
- Add a product search tool for a large catalogue, and reorder suggestions from past orders.
- Add login, and a sales-team view of follow-ups due today.
- Add scripted conversation tests that run against the agent.
