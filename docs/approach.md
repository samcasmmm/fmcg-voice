# Technical approach and assumptions

## Architecture

```
Browser (Next.js client)                          Server (Next.js route handlers / server actions)
───────────────────────                           ───────────────────────────────────────────────
Mic ─► Web Speech API ──────┐                     POST /api/transcribe ─► Groq Whisper
   └─► MediaRecorder + VAD ─┴─► text ─┐
Keyboard ─────────────────────────────┤
                                      ▼
                         useChat (AI SDK) ──────► POST /api/chat
                                      ▲              │ load history from Postgres
                                      │              │ streamText(model, instructions, tools)
         speechSynthesis ◄── reply ◄──┘              │ tools write to Postgres
                                                     ▼ save messages on finish
Side panel ◄── tool results in the message stream

End call ─► server action ─► generateText(Output.object) ─► summary + outcome ─► /history/[id]
```

**Stack:**
- Next.js 16 (App Router, Cache Components) and TypeScript
- Tailwind CSS v4 and shadcn/ui
- Drizzle ORM on PostgreSQL
- Vercel AI SDK 7, with Groq and Google providers

## Key decisions

**The voice runs in the browser, and the model runs on the server.**
- Speech-to-text defaults to the free Web Speech API.
- Groq Whisper is the fallback for browsers without it, and gives better accuracy. It records with a simple silence detector (RMS threshold, 1.2s of silence ends the turn).
- Text-to-speech uses `speechSynthesis`, picking an `en-IN` or `hi-IN` voice. It speaks sentence by sentence to work around Chrome cutting off long utterances, with a timeout in case the "ended" event never fires.

**Turn-taking works like a phone call.**
- Asha speaks first.
- In hands-free mode, the mic reopens after each reply. Push-to-talk is a toggle.
- Tapping the mic while Asha is talking interrupts her (barge-in).
- Each new turn invalidates the previous one, so an interrupted reply can't trigger stale listening.

**Tool calling captures the data instead of parsing the transcript.** The agent has five tools:

| Tool | What it does |
| --- | --- |
| `identifyRetailer` | Fuzzy match by phone number or the distinctive words of a shop name |
| `recordItem` | Adds or updates an order line or product interest; prices it on the server |
| `removeItem` | Removes a line the retailer cancels |
| `recordFollowUp` | Saves a callback, rep visit, samples, credit query or complaint |
| `endCall` | Ends the call after the goodbye |

**Prices are computed by code, not by the model.**
- `recordItem` computes the value at the retailer price (PTR) and applies the best active scheme: percent off, flat off per block, or free cases.
- The model reads back the result, which avoids arithmetic mistakes.
- The live side panel is rebuilt from tool results already in the message stream, so it needs no extra requests.

**Product cards come from matching product names, not from a tool.**
- Each reply is matched against the catalogue: a brand followed by a product word, narrowed to one SKU by a pack size ("Chaiwala Gold Tea 1 kg"). Each product's card appears only on its first mention in the call.
- The prompt asks Asha to name products in full, suggest one related product after an order line, and list a category's products when asked.
- A `showProducts` tool would cost an extra model call per turn on a rate-limited free tier; matching costs nothing, is deterministic, and replays the same on the history page.
- Images come from `public/products/<SKU>.*` when present, otherwise a category tile.

**The catalogue is in the prompt.**
- With 10 SKUs, the whole catalogue and scheme list fit in about 1k tokens.
- That makes answers instant, with no lookup round trip.
- At real scale, this would become a `searchProducts` tool backed by full-text or vector search.

**The server owns the conversation.**
- The client sends only the newest message. History is loaded from Postgres, validated against the tool schemas (`validateUIMessages`), and saved when the stream ends.
- A call can't be continued once it has ended.

**Summaries are structured output.**
- At the end of the call, `generateText` with `Output.object` produces an English summary, an outcome (`order_enquiry`, `interested`, `follow_up`, `not_interested` or `no_outcome`) and a next step.
- It runs on a separate Groq model, so it doesn't share the conversation model's per-minute token limit.
- If the model call fails, a rule-based fallback derives the outcome from the captured data.

**The provider is switchable.** `AI_PROVIDER=groq|google` picks Groq (`qwen/qwen3.8-27b`) or Gemini (`gemini-2.5-flash`). Reasoning is turned off or set to minimal, because voice needs fast first tokens.

## Data model

| Table | Holds |
| --- | --- |
| `products` | SKU, pack size, units per case, MRP, retailer price, stock status, colloquial and Hindi aliases |
| `schemes` | Target product or category, type, minimum cases, value, validity date |
| `retailers` | Shop, owner, phone, town, area, preferred language |
| `conversations` | Retailer (or the spoken name of a new lead), language, status, outcome, summary, next steps, full message history (JSONB) |
| `captured_items` | One row per product per call: order or interest, quantity, unit, applied scheme, estimated value, free cases |
| `follow_ups` | Type, due date, notes |

## Assumptions

- **All business data is fictional:** the company, the brands, ten SKUs, five schemes, six retailers, and phone numbers in the obviously fake `90000 000xx` pattern.
- **Prices:** quantities are in cases unless the retailer says pieces or packs. Prices quoted to retailers are PTR; MRP and margin are mentioned only when asked.
- **Orders:** captured orders are *enquiries*. The sales team confirms the final order, price and delivery. The agent never promises delivery dates.
- **Schemes:** they apply per product line, and only the single best active scheme is applied to each line.
- **Language:** the agent understands English, Hindi and Hinglish, but replies in the language chosen for the call. Summaries are always in English, for the sales team.
- **No authentication:** this is a single-tenant prototype, not a production telecalling system.

## What I'd do next

- Stream text-to-speech by sentence while the reply is still generating, to cut perceived latency.
- Use server-side neural TTS for consistent Hindi voices across devices.
- Add a product search tool and embeddings for a large catalogue.
- Run the retailer's previous orders through a reorder-suggestion tool.
- Add auth and a sales-team dashboard for follow-ups due today.
- Add scripted conversation evaluations against the agent. Pricing and scheme selection already have unit tests (`bun test`).
