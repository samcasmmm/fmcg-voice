# Requirements: AI-Powered Voice Agent for FMCG Retailer Engagement

## Business scenario

A large FMCG company wants to use an AI-powered voice agent to interact with retailers, answer product-related queries, explain pricing and schemes, capture order enquiries, and record follow-up requirements.

The goal is a working prototype that simulates this experience.

## Key requirements

1. **Browser-based voice agent**: the user speaks with an AI assistant and receives spoken responses. A text-based fallback is available if voice features are not supported.
2. **Product Q&A**: the assistant answers retailer questions about products, prices, schemes, and availability using sample business data.
3. **Capture**: the assistant captures product interest, requested quantities, and follow-up requirements.
4. **Summary and persistence**: at the end of the interaction, the application generates a summary and saves the conversation details and outcome.
5. **Interface**: a simple UI to start a conversation, interact with the AI agent, and review previous interactions.

## Tools and technology (from brief)

Any stack is allowed. Free AI tools, open-source models, libraries, and AI coding assistants may be used. Suggested options: Google AI Studio/Gemini API, Hugging Face, Ollama, and browser-based speech recognition and text-to-speech, or equivalent alternatives.

## Scope and assumptions (from brief)

This is a prototype, not a production telecalling system. Fictional FMCG products, sample prices, mock retailer records, and reasonable business assumptions are acceptable.

## Expected submission

- Source code
- Setup instructions
- A working demonstration
- A brief explanation of the technical approach and assumptions

Be prepared to demonstrate the application and explain the implementation during the interview.

**Assessed on:** practical development skills, AI integration, problem-solving, code quality, and the ability to translate a business requirement into a working application.

---

## Project decisions

| Area | Decision |
| --- | --- |
| Framework | Next.js (App Router, TypeScript, `src/` dir) |
| Package manager | bun |
| UI | Tailwind CSS v4 + shadcn/ui (Radix primitives, neutral base color) |
| Database | PostgreSQL via `DATABASE_URL` (developed against local Postgres 17, then Neon) |
| Data access | Drizzle ORM + `pg` (node-postgres), migrations via drizzle-kit |
| LLM | Vercel AI SDK 7. `AI_PROVIDER=groq` (default, `qwen/qwen3.8-27b`) or `google` (`gemini-2.5-flash`). Summaries on `openai/gpt-oss-20b` |
| Speech-to-text | Switchable: browser Web Speech API (default) or Groq Whisper |
| Text-to-speech | Browser `speechSynthesis` |
| Text fallback | Always available typed input |
| Locale | India; prices in ₹ INR; fictional FMCG brand; kirana retailers |
| Languages | English + Hindi (the agent understands and replies in Hindi/Hinglish) |
| Retailer identification | Optional pre-select from the mock retailer list; otherwise the agent asks for shop name/phone and looks it up |
| Catalogue | 1 fictional company, 10 SKUs, 5 schemes, 6 retailers |
| Screens | Start call (turns into the live call in place), history + detail, catalogue |
| Turn-taking | Hands-free by default, push-to-talk toggle |
| Call end | End call button, or the agent ends it after the goodbye; LLM summary + outcome saved |
