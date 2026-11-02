# fmcg-voice

A browser-based AI voice agent for FMCG retailer engagement. A kirana retailer talks to **Asha**, the sales assistant of a fictional company (Sahyog Consumer Products). Asha answers questions about products, prices, schemes and stock, captures order enquiries and follow-ups, and saves a summary and outcome when the call ends.

- **Voice in:** [Sarvam](https://www.sarvam.ai) Saaras speech-to-text by default, with browser speech recognition and Groq Whisper as alternatives. Typing always works as a fallback.
- **Voice out:** Sarvam Bulbul text-to-speech (voice: Simran) by default, with the browser's own voice as a fallback.
- **Product cards:** every product Asha names (answers, suggestions, out-of-stock alternatives, category lists) appears as a card in the chat with its prices, stock and scheme.
- **Languages:** English and Hindi.
- **Screens:** start and run a call (`/`), call history (`/history`, `/history/[id]`), and the sample catalogue (`/catalogue`).

## Documentation

| Document | For |
| --- | --- |
| [docs/details.md](docs/details.md) | Full project documentation: architecture, voice pipeline, agent, data model, screens, testing, limits |
| [docs/approach.md](docs/approach.md) | Short technical approach and assumptions |
| [docs/demo-script.md](docs/demo-script.md) | 10-minute talk and live demo script |
| [docs/interview-prep.md](docs/interview-prep.md) | Code walkthrough, design decisions, likely questions |
| [docs/project-story.md](docs/project-story.md) | How to explain the project: why it exists, how it was built, challenges and lessons |
| [docs/requirements.md](docs/requirements.md) | The original brief and project decisions |

## Requirements

- [Bun](https://bun.sh) 1.3+ and Node.js 22+
- PostgreSQL 15+ (local or hosted, e.g. Neon)
- A [Groq API key](https://console.groq.com/keys) (free tier works) and a [Sarvam API key](https://dashboard.sarvam.ai) (new accounts get ₹100 of free credits). A [Google AI Studio key](https://aistudio.google.com/apikey) is optional.
- Any modern browser with a microphone. Browser speech recognition (optional) needs Chrome or Edge.

## Setup

```bash
bun install
cp .env.example .env        # then fill in DATABASE_URL and GROQ_API_KEY
bun run db:setup            # create tables and load the demo data
bun dev                     # http://localhost:3000
```

`bun run db:seed` resets the database to the demo data at any time. It deletes all calls.

**Product images (optional):** put a square photo per product in `public/products/`, named by SKU (e.g. `SCP-TEA-1K.webp`; `.png` and `.jpg` also work). Products without one show a category tile.

### Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | | PostgreSQL connection string |
| `AI_PROVIDER` | no | `groq` | `groq` or `google` |
| `GROQ_API_KEY` | yes | | Chat (when `AI_PROVIDER=groq`) and Whisper speech-to-text fallback |
| `SARVAM_API_KEY` | recommended | | Speech-to-text and text-to-speech. Without it, the app uses Whisper and the browser voice |
| `GOOGLE_GENERATIVE_AI_API_KEY` | if `google` | | Gemini |
| `GROQ_MODEL` | no | `qwen/qwen3.8-27b` | Conversation model |
| `GROQ_SUMMARY_MODEL` | no | `openai/gpt-oss-20b` | End-of-call summary model |
| `GROQ_TRANSCRIPTION_MODEL` | no | `whisper-large-v3-turbo` | Whisper model |
| `GOOGLE_MODEL` | no | `gemini-2.5-flash` | Gemini model |
| `SARVAM_STT_MODEL` | no | `saaras:v4` | Sarvam speech-to-text model |
| `SARVAM_TTS_MODEL` | no | `bulbul:v4-flash` | Sarvam text-to-speech model |
| `SARVAM_SPEAKER_EN` / `SARVAM_SPEAKER_HI` | no | `simran_en_sales` / `simran_hi_sales` | Sarvam voices |

## Demo script

1. Open `/`. Leave the retailer unselected, choose English, and click **Start call**. Allow microphone access.
2. Say: *"Hi, this is Gupta General Store in Indore."* Asha identifies the retailer.
3. *"What's the price of Chaiwala Gold tea 1 kg? Any scheme?"* She quotes ₹482 per pack and the 8% scheme.
4. *"Book 6 cases of that and 2 cases of Crunchos bhujia."* Both lines appear in the side panel, with the scheme applied.
5. *"Do you have Kesar Glow shampoo?"* It's out of stock; she offers to note your interest.
6. *"Send samples of the cream biscuits next week. That's all, bye."* She recaps, says goodbye and ends the call.
7. You land on the call summary. `/history` lists every call.

For Hindi, choose **हिन्दी** or pick a Hindi-speaking retailer (e.g. Khan Brothers Kirana).

## Known limits

- **Groq free-tier rate limit:** 8,000 tokens per minute per model. A turn that records something uses two model calls, so a fast-paced call can pause for up to a minute. The UI shows a "taking longer" note when this happens. A paid Groq plan or `AI_PROVIDER=google` avoids it.
- **Sarvam credits:** speech-to-text costs ₹0.49 per minute and text-to-speech ₹10 per 10,000 characters, so the ₹100 free credit covers plenty of demo calls. When it runs out, the app falls back to Whisper and the browser voice.
- **Hindi quality depends on the model.** Qwen's Hindi is understandable but sometimes picks the wrong word. The browser-voice fallback depends on the voices installed on the device.

## Scripts

| Script | What it does |
| --- | --- |
| `bun dev` | Development server |
| `bun run build` / `bun start` | Production build and server |
| `bun run lint` | ESLint |
| `bun test` | Unit tests (pricing and schemes) |
| `bun run db:generate` | Generate a migration from `src/db/schema.ts` |
| `bun run db:migrate` | Apply migrations |
| `bun run db:seed` | Reset to demo data |
| `bun run db:setup` | Migrate and seed |
| `bun run db:studio` | Drizzle Studio |
