# Demo script: fmcg-voice

About 10 minutes: 4 minutes of explanation, 5 minutes of live demo, 1 minute to close.

Read the lines in quotes out loud. Lines starting with **Do:** are actions. Lines starting with **Show:** are what to point at.

**Before you start:** dev server running, browser hard-reloaded (Ctrl+Shift+R), microphone allowed, volume on. Open the app on the Call page. Keep the Catalogue and History pages ready in other tabs.

---

## Part 1: The explanation (about 4 minutes)

### 1. The problem (30 seconds)

"The task was to build a voice agent for an FMCG company."

"Retailers, like kirana shop owners, want to ask about products, prices and schemes. They also want to place orders and ask for follow-ups."

"Today a sales person does this on the phone. My prototype does it with an AI assistant in the browser."

### 2. What I built (30 seconds)

"The assistant is called Asha. She works for a fictional company called Sahyog Consumer Products."

"You can talk to her, and she talks back. She speaks English and Hindi."

"She answers from real data in a database. She records orders and follow-ups. At the end, the app writes a summary and saves the call."

"If voice does not work, you can type. That is the text fallback."

### 3. The tech stack (1 minute)

"The app is built with Next.js and TypeScript. The UI uses Tailwind and shadcn components."

"The data is in PostgreSQL. I use Drizzle ORM for the schema and queries."

"For speech, I use Sarvam AI. Sarvam is built for Indian languages."

"Speech to text uses Sarvam Saaras. I pass the product names as hints, so it hears brand names correctly."

"Text to speech uses Sarvam Bulbul, with a natural Indian voice called Simran. It works in English and Hindi."

"For the brain, I use an LLM on Groq, through the Vercel AI SDK. I can switch to Google Gemini with one setting."

"If Sarvam fails, there are backups: Groq Whisper for speech to text, and the browser's voice for speech."

### 4. How one turn works (1 minute)

"Let me explain what happens when the retailer speaks."

"One. The browser records the voice. It stops when the person is quiet for about one second."

"Two. The audio goes to Sarvam, and comes back as text."

"Three. The text goes to the AI agent on the server. The agent has the product list and the schemes in its instructions."

"Four. The agent can call tools. For example, record an order, or save a follow-up. The tools write to the database."

"Five. The reply goes to Sarvam, and comes back as audio. Asha speaks."

"Then the microphone opens again, like a phone call."

### 5. Two design choices (1 minute)

"First: prices are calculated in code, not by the AI. AI models can make maths mistakes. So the code calculates the total and the scheme discount, and the AI only reads it out."

"Second: the AI uses tools to save data while the call is happening. So the order appears on screen at once, and nothing depends on reading the transcript later."

---

## Part 2: The live demo (about 5 minutes)

### Step 1: Show the sample data (30 seconds)

**Do:** Open the Catalogue tab.

"This is the sample data. Ten products, in five categories."

**Show:** the prices, the stock column, the schemes.

"Some products are low on stock. The shampoo is out of stock. There are five schemes, like buy 10 cases, get 1 free."

### Step 2: Start the call (30 seconds)

**Do:** Go to the Call page.

"Here I can choose a retailer, or let Asha ask. I will let her ask."

**Show:** the language choice, speech recognition set to Sarvam, the voice set to Sarvam Simran, and hands-free.

**Do:** Click **Start call**.

"Asha speaks first, like a real call."

### Step 3: Identify the retailer (30 seconds)

**Say to Asha:** "Hi, this is Gupta General Store in Indore."

**Show:** the side panel now shows the retailer.

"She found the retailer in the database from the shop name."

### Step 4: Ask about a product (45 seconds)

**Say to Asha:** "What is the price of Chaiwala Gold tea 1 kg? Any scheme?"

**Show:** the product card under her reply.

"She answers from the database: the price and the scheme. A product card shows the details."

### Step 5: Place an order (1 minute)

**Say to Asha:** "Book 6 cases of that, and 2 cases of Crunchos bhujia."

**Show:** the order lines in the side panel, the scheme badge and the total.

"The order is saved while we talk. The 8 percent scheme is applied automatically, because the order is 5 cases or more."

"She may also suggest another product. That is a sales suggestion."

### Step 6: Out-of-stock product (30 seconds)

**Say to Asha:** "Do you have Kesar Glow shampoo?"

"It is out of stock. She says so, tells me when it is expected, and suggests something else."

### Step 7: Follow-up and goodbye (45 seconds)

**Say to Asha:** "Please send samples of the cream biscuits next week. That is all, thank you, bye."

"She saves the follow-up with a date, gives a short recap, and ends the call by herself."

### Step 8: The summary (45 seconds)

**Show:** the call detail page that opens.

"This is what the sales team sees. A summary, the outcome, the next step, the order with the total, the follow-ups, and the full transcript."

**Do:** Open the History page.

"All calls are saved here."

### Optional: Hindi (1 minute)

**Do:** Start a new call and choose हिन्दी.

**Say to Asha:** "नमस्ते, मैं खान ब्रदर्स किराना, लखनऊ से बोल रहा हूँ।"

"The same flow works in Hindi. The speech, the replies and the voice are all in Hindi. The summary stays in English for the sales team."

---

## Part 3: Closing (about 1 minute)

"To sum up: you can talk to the agent, and it talks back in English or Hindi. It answers from sample data, captures orders and follow-ups, and saves a summary at the end. You can also type."

"There are a few limits. The free AI tier can slow down some replies. The Hindi wording is sometimes not perfect."

"Next, I would stream the voice so Asha starts speaking faster, and add a product search tool for a big catalogue."

"Thank you. I am happy to show the code or answer questions."

---

## If something goes wrong

| Problem | What to say |
| --- | --- |
| Asha is slow | "This is the free-tier rate limit. A paid plan fixes it." Keep explaining while you wait. |
| The microphone does not work | "I will use the text fallback." Then type the same lines. |
| No sound | "Replies are always on screen too." Check that "Speak replies" is on. |
| Something breaks | Open History, show a finished call, and walk through the code. |
