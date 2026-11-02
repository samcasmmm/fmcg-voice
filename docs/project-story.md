# Project story: fmcg-voice

How to talk about this project in an interview: what it is, why it exists, how I built it, what went wrong, and what I learned. [interview-prep.md](interview-prep.md) has the code walkthrough and technical Q&A. This file is the story I tell out loud.

Answers are in the first person so I can practise saying them.

---

## 1. "Tell me about your project"

### 30-second version

> I built a browser-based AI voice agent for an FMCG company. A kirana shop owner talks to "Asha", a sales assistant, in English or Hindi. She answers questions about products, prices, schemes and stock, takes order enquiries and follow-up requests, and when the call ends the app writes a summary for the sales team. It's built in Next.js with Postgres, an LLM on Groq through the Vercel AI SDK, and Sarvam AI for Indian-language speech.

### 2-minute version

> The brief came from an FMCG scenario. A big consumer-goods company sells through thousands of small retailers, and its sales reps and telecallers spend a lot of time on repetitive calls: "What's the price of this?", "Is there a scheme?", "Book 5 cases." The company wanted a prototype voice agent that could handle those calls.
>
> So I built Asha. You open the app, pick a language and start a call. Asha greets you, and you just talk, hands-free, like a phone call. She looks up the retailer, quotes prices and schemes from the database, and when you order something she records it with a tool call. The price is calculated in code, not by the AI, so it's always correct. A side panel shows the order building up live. When you say bye, she ends the call, and a second model writes a summary, an outcome like "order enquiry" or "follow-up", and a next step. Everything is saved, and there's a history page to review past calls.
>
> The hardest parts were getting speech right for Indian names and Hindi, keeping the voice loop fast on free-tier APIs, and making it reliable, so every piece has a fallback and the demo doesn't break if one service fails.

---

## 2. Why this project exists

### The business problem

| Who | Their problem |
| --- | --- |
| **FMCG company** | Sells through lakhs of small kirana stores. Reps can't call every store often, and many calls are the same simple questions. |
| **Kirana retailer** | Wants quick answers on price, scheme and stock, often in Hindi or Hinglish, without waiting for the rep's visit. |
| **Sales team** | Needs a clean record of what each retailer wanted: orders, interest, callbacks, complaints. They don't want to listen to a whole call. |

### What the agent does for each of them

- **Retailer:** gets an instant answer in their own language, any time.
- **Sales team:** gets a structured summary, order lines with prices, and a list of follow-ups instead of a raw recording.
- **Company:** routine calls are handled automatically, so reps can spend their time on the calls that need a person.

### Why voice and not a chat app

Most kirana owners are busy at the counter. Talking is faster than typing, and many are more comfortable speaking Hindi than typing it. So voice was the core feature, and typing is the fallback.

### Where it came from

> It was a take-home assignment. The brief asked for a browser voice agent that answers product questions, captures orders and follow-ups, and saves a summary, using free AI tools. I treated it like a real product: I made up a fictional company, 10 products, 5 schemes and 6 retailers so I could test real conversations end to end.

---

## 3. What it does: one call, start to end

1. The retailer picks a language (English or Hindi) and clicks **Start call**.
2. Asha greets them and the mic opens automatically.
3. *"Hi, this is Gupta General Store in Indore."* She finds the shop in the database.
4. *"Chaiwala Gold tea 1 kg ka rate kya hai?"* She quotes ₹482 and mentions the 8% scheme. A product card appears.
5. *"Book 6 cases."* She records the order with a tool. The code calculates ₹31,927.68 after the scheme, and the side panel updates.
6. *"Send samples of the cream biscuits next week."* She saves a follow-up.
7. *"That's all, bye."* She recaps, says goodbye and ends the call.
8. The app writes the summary, outcome and next step, and opens the call detail page.

---

## 4. How I built it

### My approach, in order

1. **Read the brief and fix the scope.** I wrote down every requirement and turned each one into a feature (see [requirements.md](requirements.md)). I decided early: fictional data, India, rupees, English and Hindi.
2. **Data model first.** Products, schemes, retailers, conversations, captured items, follow-ups. Once the tables were right, the agent's tools were easy to design.
3. **Text agent before voice.** I got the agent working by typing first: prompt, tools, pricing, summary. If the brain doesn't work in text, voice only makes it harder to debug.
4. **Voice with browser APIs.** The first version used the browser's own speech recognition and voice, because they are free.
5. **Replaced speech with Sarvam.** Browser speech was bad at Indian brand names and Hindi, so I switched to Sarvam AI and kept the browser as a fallback (see challenge 1).
6. **Hardening.** Fallbacks, error messages, rate-limit handling, unit tests, and end-to-end checks in Chrome.
7. **Docs.** README, approach, detailed docs and a demo script.

### Tech stack in one line each

| Piece | Choice | Why, in one line |
| --- | --- | --- |
| App | Next.js + TypeScript | UI and API in one codebase |
| UI | Tailwind + shadcn/ui | Quick, clean, accessible components |
| Database | PostgreSQL + Drizzle | Typed queries, real migrations |
| AI | Vercel AI SDK + Groq | Streaming and tool calling, fast free tier, provider is switchable |
| Speech | Sarvam Saaras (in), Bulbul (out) | Built for Indian accents, Hindi and Hinglish |
| Tests | `bun test` | Pricing and product matching |

---

## 5. Challenges I faced

Tell these as **Situation → Problem → What I did → Result**. Pick two or three good ones; don't list all of them.

### Challenge 1: Speech recognition didn't understand Indian product names

- **Situation:** The products have made-up Indian brand names like "Khetsona Chakki Atta".
- **Problem:** Browser speech recognition and Whisper heard them wrong. Whisper heard "Khetsona Chakki Atta" as "Ketsuna at a". If the name is wrong, the whole order is wrong.
- **What I did:** I switched to Sarvam Saaras, which is trained on Indian speech, and sent all the product names as `keyterms` (hints). I also added Hindi and colloquial aliases to the prompt ("aata", "chai patti") and told the model to match generously.
- **Result:** Sarvam got the brand names right in testing. Whisper stays as an automatic backup.
- **Lesson:** Pick the tool for the user. A general model isn't always the best one for Indian users.

### Challenge 2: Some replies took 60 seconds (rate limit)

- **Situation:** I was on Groq's free tier.
- **Problem:** Some turns suddenly took a full minute. At first I thought the model was slow.
- **What I did:** I read the response headers and found the real cause: 8,000 tokens per minute per model. A turn that records an order uses two model calls, and every call resends the prompt. So I made the prompt smaller (about 1,000 tokens), turned off the model's reasoning, and moved the end-of-call summary to a **different model**, because the limit is per model.
- **Result:** Normal turns are back to a few seconds, and ending a call doesn't wait for the chat model's limit. The UI shows a "taking longer" note if the limit is hit.
- **Lesson:** Measure before you guess. The headers told me exactly what was wrong.

### Challenge 3: A fallback hid a bug

- **Situation:** I had Whisper as a backup if Sarvam failed.
- **Problem:** Everything looked fine, but Sarvam was failing on **every** request, and Whisper was quietly doing all the work. The browser labels recordings `audio/webm;codecs=opus`, and Sarvam only accepts `audio/webm`.
- **What I did:** I found it only by reading the server log. I fixed it by sending the plain media type, and made sure fallbacks are logged.
- **Result:** Sarvam works as the main engine.
- **Lesson:** Fallbacks are good for users but can hide bugs from you. Always log when a fallback runs.

### Challenge 4: The browser blocked Asha's voice

- **Situation:** Asha speaks first, with a greeting.
- **Problem:** Browsers block audio that doesn't come from a user click. The greeting plays after a server round trip, so the browser no longer counts it as part of the click, and it stayed silent.
- **What I did:** The **Start call** click now "unlocks" audio right away, before the server call. If audio is still blocked, the browser voice reads it, and the text is always on screen.
- **Lesson:** Browser rules (autoplay, mic permission) are part of the design, not an afterthought.

### Challenge 5: Interruptions caused race conditions

- **Situation:** The call is hands-free: Asha speaks, then the mic opens. The retailer can also interrupt her (barge-in).
- **Problem:** If the retailer interrupted, the old reply could still finish and open the mic again, so two listening sessions were fighting each other.
- **What I did:** Each turn gets a number (a `turn` ref). Every new turn increases it. Before any step continues, it checks "am I still the current turn?" If not, it stops.
- **Result:** Interrupting is clean. Old work never continues after a new turn starts.
- **Lesson:** Async UI needs a way to cancel stale work. A simple counter is often enough.

### Challenge 6: The AI got prices wrong

- **Situation:** Orders have schemes: percent off, flat off per block of cases, or free cases.
- **Problem:** LLMs are bad at arithmetic. A wrong price in a sales call is a real business problem.
- **What I did:** All pricing lives in one tested function (`priceLine`). The `recordItem` tool calls it and returns the result, and the model only reads the number back. It also picks the scheme that saves the retailer the most.
- **Result:** The panel, database and summary always show correct values. Unit tests cover the scheme types.
- **Lesson:** Let the AI decide *what* the retailer wants. Let code handle *rules and numbers*.

### Challenge 7: Asha said goodbye twice

- **Problem:** After the model called `endCall`, the agent loop ran one more step and the model said goodbye again.
- **What I did:** The loop stops as soon as `endCall` is called (`stopWhen: hasToolCall('endCall')`), and is capped at 5 steps per turn.
- **Lesson:** Agent loops need clear stop conditions.

### Challenge 8: Voice felt slow

- **Problem:** Waiting for the full reply to be turned into speech left a long silence.
- **What I did:** The first sentence is sent to text-to-speech on its own, and the rest is fetched in parallel and played in order. Asha starts talking after one sentence's delay.
- **What's next:** Stream speech while the reply is still being generated.

### Smaller ones (if asked for more)

- **Shop name matching:** "Gupta General Store" and "Gupta Kirana" should match the same shop. I match on the distinctive words and ignore common words like "store" and "kirana".
- **Product cards:** I wanted a card whenever Asha names a product. A tool would cost an extra model call each turn, so I match product names in the reply text instead. It's free, predictable, and works the same on the history page.
- **Security of history:** The browser sends only the new message. The server loads and validates the history, so nobody can fake old turns or tool results.

---

## 6. What I learned

- **Split the work between AI and code.** AI is good at understanding messy speech and intent. Code is better for prices, rules and data. Tool calling connects the two.
- **Build text first, then voice.** It's much easier to debug the agent without audio in the way.
- **Every external service fails sometimes.** Each step has a backup: Sarvam → Whisper, Sarvam voice → browser voice, voice → typing.
- **Measure, don't guess.** Response headers, server logs and timing showed the real problems.
- **Latency matters more in voice than in chat.** One extra second of silence feels broken on a call. That drove choices like putting the catalogue in the prompt and turning reasoning off.

---

## 7. Common follow-up questions

**Q: What was your role? Did you use AI tools?**
> I built it on my own. The brief allowed AI coding assistants and I used them, mostly to write boilerplate and UI faster. The decisions were mine: the data model, tool design, pricing in code, the fallback chain, and switching to Sarvam. I tested everything and I can explain every part.

**Q: What are you most proud of?**
> That it works as a real conversation, in Hindi too, and doesn't fall apart when something fails. And that the numbers the sales team sees are always correct, because pricing is in code, not in the model.

**Q: What would you do differently if you started again?**
> I'd add logging for fallbacks from day one; that would have caught the Sarvam bug sooner. I'd also test with a Hindi speaker earlier, because Hindi quality depends a lot on the model.

**Q: How did you decide what to build first?**
> I mapped each requirement from the brief to a feature, then built the core loop first: data, agent, tools, summary in text. Voice came after that, then polish. Nice-to-haves like product cards came last.

**Q: How long did it take?**
> About a few days of focused work. *(Adjust to your real number.)*

**Q: Is it production-ready?**
> No, and it isn't meant to be. It's a prototype. For production I'd add login, a real phone line through a provider like Exotel or Twilio, streaming speech, a paid model tier, and a product search tool for a big catalogue. The agent, tools and database design would stay the same.

**Q: What's the biggest weakness?**
> The free-tier rate limit can make some turns slow, and the model can still say something slightly wrong in a sentence, even though the stored numbers are correct. I'd fix the first with a paid tier and the second with a check that compares spoken prices with the catalogue.

**Q: How would this help the business, in numbers?**
> I didn't measure business numbers, because it's a prototype. In a real rollout I'd track calls handled without a rep, order enquiries captured per day, follow-ups completed on time, and how often the sales team had to correct a summary.

---

## 8. Quick cheat sheet

| If they ask... | Say... |
| --- | --- |
| What is it? | A voice sales assistant for kirana retailers, in English and Hindi. |
| Who is it for? | Retailers who call, and the sales team who reads the summaries. |
| Why voice? | Retailers are busy at the counter, and many prefer speaking Hindi to typing. |
| Core idea? | The AI understands, tools record, code calculates. |
| Hardest problem? | Indian names in speech recognition, and the rate limit. |
| Best decision? | Prices in code, not in the model. |
| Biggest lesson? | Log your fallbacks, or they hide bugs. |
| Next step? | Stream speech for lower latency, then a real phone line. |
