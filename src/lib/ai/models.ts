import 'server-only';

import { google, type GoogleLanguageModelOptions } from '@ai-sdk/google';
import { groq, type GroqLanguageModelChatOptions } from '@ai-sdk/groq';

const provider = process.env.AI_PROVIDER === 'google' ? 'google' : 'groq';
const groqModel = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
const googleModel = process.env.GOOGLE_MODEL || 'gemini-2.5-flash';

export const providerName = provider;

export function chatModel() {
  return provider === 'google' ? google(googleModel) : groq(groqModel);
}

/** Voice needs fast first tokens, so reasoning is switched off or kept minimal. */
export const chatProviderOptions = {
  groq: {
    reasoningEffort: groqModel.startsWith('openai/gpt-oss') ? 'low' : 'none',
    // Qwen on Groq does not support strict json_schema; plain JSON mode is enough for our summaries.
    structuredOutputs: false,
  } satisfies GroqLanguageModelChatOptions,
  google: {
    thinkingConfig: googleModel.includes('gemini-2.5') ? { thinkingBudget: 0 } : { thinkingLevel: 'low' },
  } satisfies GoogleLanguageModelOptions,
};

/** Summaries run on a separate Groq model: Groq's free-tier token limits are per model, so the call keeps its budget. */
export function summaryModel() {
  return provider === 'google' ? google(googleModel) : groq(process.env.GROQ_SUMMARY_MODEL || 'openai/gpt-oss-20b');
}

export const summaryProviderOptions = {
  groq: { reasoningEffort: 'low', structuredOutputs: true } satisfies GroqLanguageModelChatOptions,
  google: chatProviderOptions.google,
};

export function transcriptionModel() {
  return groq.transcription(process.env.GROQ_TRANSCRIPTION_MODEL || 'whisper-large-v3-turbo');
}
