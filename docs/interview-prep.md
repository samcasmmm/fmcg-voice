# Interview prep: fmcg-voice

Your study notes for explaining and defending the project. Read [details.md](details.md) first for the full picture; this file covers how the code works, why each choice was made, likely questions, and what to do if something breaks during the demo.

---

## 1. The project in 30 seconds

> I built a browser voice agent for an FMCG company. A kirana retailer talks to "Asha", an AI sales assistant. She answers questions about products, prices, schemes and stock from a Postgres database, records order enquiries and follow-ups using tool calls, and at the end the app writes a summary and outcome for the sales team. Speech runs through Sarvam AI in English and Hindi, the brain is an LLM on Groq through the Vercel AI SDK, and everything is built in Next.js.

---

## 2. Numbers to remember

| Fact | Value |
| --- | --- |
| Sample data | 10 products, 5 categories, 5 schemes, 6 retailers |
| Chat model | Groq `qwen/qwen3.8-27b` (Gemini 2.5 Flash as an option) |
| Summary model | Groq `openai/gpt-oss-20b` |
| Speech-to-text | Sarvam Saaras v4, about 0.2 s per turn in testing |
| Text-to-speech | Sarvam Bulbul v4-flash, voice Simran, about 1 to 1.5 s per reply |
| Silence detection | Stops recording 1.2 s after speech ends; gives up after 8 s of no speech |
| Agent loop | Max 5 steps per turn; stops after `endCall` |
| Prompt size | About 1,000 tokens (catalogue included) |
| Groq free limit | 8,000 tokens per minute per model |
| Sarvam cost | STT ₹0.49 per minute; TTS ₹10 per 10,000 characters; ₹100 free credit |
| Tests | 15 unit tests (pricing and product matching) |
| Example price check | 6 cases of Chaiwala Gold Tea 1 kg: 72 × ₹482 = ₹34,704, minus 8% = ₹31,927.68 |

---

## 3. Walk through the code

Know these files. If asked "show me how X works", open the file listed.

| Question | File | What to point at |
| --- | --- | --- |
| How does a call start? | `src/components/call/call-experience.tsx`, `src/app/actions.ts` | `start()` unlocks audio, calls the `startConversation` server action, which creates the row with Asha's greeting. |
| How does the voice loop work? | `src/components/call/live-call.tsx` | `respond()` speaks the reply, then `takeTurn()` listens, then `send()` posts the text. The `turn` ref cancels stale work. |
| How is speech recorded? | `src/hooks/use-speech-input.ts` | `listenRecorded()`: `MediaRecorder` plus an `AnalyserNode` that measures loudness (RMS) to detect silence. |
| How is speech played? | `src/hooks/use-speech-output.ts` | `speakWithSarvam()`: first sentence alone, rest in parallel, played in order; leftovers go to `speakWithBrowser()`. |
| Where is Sarvam called? | `src/lib/ai/sarvam.ts` | `sarvamTranscribe()` (multipart, `keyterms`) and `sarvamSpeak()` (JSON, base64 MP3). |
| What is the agent told? | `src/lib/agent/prompt.ts` | `buildInstructions()`: rules plus the catalogue table and schemes. |
| What can the agent do? | `src/lib/agent/tools.ts` | Five tools with Zod input schemas; each writes to Postgres. |
| How does the chat API work? | `src/app/api/chat/route.ts` | Load history, validate, `streamText` with tools, stream back, save on finish. |
| How is price calculated? | `src/lib/pricing.ts` | `priceLine()` picks the scheme worth the most to the retailer. |
| How is the summary made? | `src/lib/agent/summarize.ts` | `generateText` with `Output.object` and a Zod schema; rule-based fallback. |
| How do product cards work? | `src/lib/product-mentions.ts`, `src/components/call/transcript.tsx` | Brand, then product word, then pack size; each product shown once per call. |
| Where is the data model? | `src/db/schema.ts` | Six tables; `conversations.messages` is JSONB. |

---

## 4. Design decisions and why

**Why tool calling instead of parsing the transcript afterwards?**
The model decides, in context, what the retailer actually committed to, and the data is saved the moment it is said. The side panel updates live, and the agent can confirm using real computed values.

**Why calculate prices in code?**
LLMs make arithmetic mistakes. Prices and schemes are business rules, so they live in a tested function. The model only reads the result back.

**Why put the catalogue in the prompt instead of a search tool?**
With 10 products it is about 1,000 tokens, and it saves a tool round trip on every product question, which keeps voice replies fast. With thousands of products I would add a search tool.

**Why does the server own the conversation history?**
The client sends only the newest message. The server loads history from Postgres and validates it, so a client cannot rewrite past turns or fake tool results.

**Why Sarvam for speech?**
It is built for Indian accents, Hindi and Hinglish, and accepts product names as recognition hints. In my test it got "Khetsona Chakki Atta" right; Whisper heard "Ketsuna at a". Bulbul gives a natural Indian voice in both languages, which browser voices do not.

**Why keep Whisper and the browser voice?**
So a demo never fails on one provider. If Sarvam fails, the same recording is retried with Whisper. If Sarvam audio fails, the browser voice speaks the rest.

**Why a separate summary model?**
Groq's free-tier limit is per model. Using a different model for the summary means ending a call does not wait for the chat model's limit to reset.

**Why match product names for cards instead of a "show products" tool?**
A tool would cost an extra model call per turn, which is slow and uses the rate limit. Matching is free, deterministic, and replays the same on the history page.

**Why hands-free with barge-in?**
It feels like a real phone call: no button presses needed, but the retailer can still interrupt.

**Why Next.js and the Vercel AI SDK?**
One codebase for UI and API. The AI SDK gives streaming, tools, structured output and a React hook, and switching between Groq and Gemini is one environment variable.

---

## 5. Likely questions and answers

**Q: What happens if the model makes up a price?**
The prompt says to use only the catalogue, and order totals come from the pricing function, not the model. The side panel and summary use database values. The model can still misspeak in free text; for production I would add a check that compares spoken prices with the catalogue.

**Q: How do you know the retailer is who they say they are?**
I don't, in this prototype. `identifyRetailer` matches a phone number or shop name. In production the call would come from a known phone number, or there would be OTP verification.

**Q: How does Hindi work?**
The call has a language. Speech-to-text uses `hi-IN`, the prompt tells the model to reply in Hindi (Devanagari script, brand names in English), and text-to-speech uses the Hindi Simran voice. The summary is always in English for the sales team.

**Q: What if two products sound alike, or speech recognition mishears?**
Speech recognition gets product names as hints. The prompt includes aliases ("aata", "chai patti") and tells the model to match generously. Order lines must use a SKU from the catalogue; an unknown SKU returns an error the model can recover from.

**Q: What is the latency of one turn?**
Silence detection takes 1.2 s, speech-to-text about 0.2 s, the model about 1 to 2 s (more if a tool runs), and speech about 1 s before audio starts. Roughly 3 to 5 seconds in total. The rate limit can add up to a minute on the free tier.

**Q: How would you scale this?**
A product search tool instead of the catalogue in the prompt; streaming speech both ways; a paid model tier; queue the summary in the background; add auth and multi-tenant data.

**Q: How would you turn this into a real telecalling system?**
Connect a telephony provider (for example SIP, or Exotel or Twilio for India) and use streaming speech APIs over WebSockets instead of browser recording. The agent, tools and database stay the same.

**Q: How did you test it?**
Unit tests for pricing and product matching. Scripted end-to-end runs in Chrome over the DevTools protocol, including a fake microphone to test the voice loop. API-level runs of English and Hindi conversations.

**Q: What was the hardest problem?**
Pick one you can tell well:
- *The Groq rate limit:* turns took 60 seconds. I measured it from the response headers (8,000 tokens per minute), shrank the prompt, and moved summaries to a separate model.
- *A silent fallback hid a bug:* Sarvam rejected the browser's `audio/webm;codecs=opus` type, and the Whisper fallback quietly covered it. I only found it by reading the server log, then fixed the media type.
- *Autoplay:* browsers block audio without a user gesture, and the greeting plays after a server round trip. The Start call click now unlocks audio.

**Q: Why not use a realtime speech-to-speech model?**
It would be lower latency, but harder to control: I want tool calls, database writes and a predictable pipeline I can explain and test. This design also lets each part (speech, model, voice) be swapped independently.

**Q: What would you improve first?**
Stream text-to-speech while the reply is being generated, so Asha starts speaking sooner. Then streaming speech-to-text.

---

## 6. Weak points to be honest about

- **Free-tier rate limit:** some turns can pause. Say it, and explain the fix (paid tier or switching provider).
- **Hindi quality from Qwen:** understandable, but sometimes the wrong word.
- **The Gemini option has not been tested end to end:** the code path exists. Run one call with `AI_PROVIDER=google` before the interview if you plan to use it.
- **No login or security model:** it is a prototype by design.
- **The model can still say something wrong in free text:** totals are computed, but the spoken sentence is generated.

---

## 7. Before the interview checklist

1. `bun install`, then make sure `.env` has `DATABASE_URL`, `GROQ_API_KEY` and `SARVAM_API_KEY`.
2. Restart the dev server cleanly: delete `.next`, then `bun dev`. Hard-reload the browser (Ctrl+Shift+R).
3. Do one full voice call in Chrome in English and one in Hindi. Allow the microphone.
4. Check Sarvam credits in the Sarvam dashboard.
5. Optional: `bun run db:seed` for clean history. This deletes all calls, so do one sample call afterwards so History is not empty.
6. Keep the History page with a finished call ready as a backup.
7. Have the catalogue page open in a tab to show the sample data.

---

## 8. If something breaks during the demo

| Problem | What to do and say |
| --- | --- |
| Asha takes long to reply | "This is the free-tier rate limit on Groq, about 8,000 tokens a minute. A paid tier or switching the provider removes it." Keep talking while it loads, or switch to typing. |
| Microphone does not work | Type instead: "The text fallback is part of the requirement." Check the browser's mic permission. |
| No audio from Asha | Turn on "Speak replies", check the volume, or show the transcript: "Replies are always on screen too." |
| Wrong product heard | Show that the agent asks again or corrects, or type it. Mention that speech gets product names as hints. |
| App error | Show a finished call on the History page and the code walkthrough instead. |
