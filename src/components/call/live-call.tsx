'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Mic, PhoneOff, SendHorizontal, Square } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { endConversation } from '@/app/actions';
import { CallStatus, type CallPhase } from '@/components/call/call-status';
import { CapturedPanel } from '@/components/call/captured-panel';
import { Transcript } from '@/components/call/transcript';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { Language, Retailer } from '@/db/schema';
import { useInputSupport, useSpeechInput, type InputEngine, type ListenResult } from '@/hooks/use-speech-input';
import { unlockAudio, useSpeechOutput, type VoiceEngine } from '@/hooks/use-speech-output';
import { deriveCaptured, messageText } from '@/lib/agent/captured';
import type { AgentUIMessage } from '@/lib/agent/tools';
import type { ProductCardData } from '@/lib/catalogue';
import { cn } from '@/lib/utils';

export type CallSettings = {
  language: Language;
  /** null when this browser cannot capture speech: text-only call. */
  engine: InputEngine | null;
  /** Sarvam Bulbul, or the browser's own voice. */
  voice: VoiceEngine;
  handsFree: boolean;
  voiceReplies: boolean;
};

function listenErrorMessage(result: Extract<ListenResult, { error: string }>) {
  switch (result.error) {
    case 'no-speech':
      return null;
    case 'denied':
      return 'Microphone access is blocked. Allow it in the browser’s address bar, or type instead.';
    case 'no-mic':
      return 'No microphone found. Check that one is connected and not used by another app, or type instead.';
    case 'network':
      return 'The speech service could not be reached. Check your internet connection, or type instead.';
    case 'language':
      return 'This browser can’t recognise speech in this language. Type instead.';
    default:
      return `Speech recognition failed (${result.detail ?? 'unknown error'}). Try again, or type instead.`;
  }
}

export function LiveCall({
  conversationId,
  initialMessages,
  settings,
  retailer,
  catalogue,
  onEnded,
}: {
  conversationId: string;
  initialMessages: AgentUIMessage[];
  settings: CallSettings;
  retailer: Retailer | null;
  catalogue: ProductCardData[];
  /** Resets the call screen; Next keeps this page mounted (hidden) after navigating away. */
  onEnded: () => void;
}) {
  const router = useRouter();
  const { language } = settings;
  const [engine, setEngine] = useState(settings.engine);
  const [phase, setPhase] = useState<CallPhase>('idle');
  const [slow, setSlow] = useState(false);
  const [handsFree, setHandsFree] = useState(settings.handsFree && engine !== null);
  const [voiceReplies, setVoiceReplies] = useState(settings.voiceReplies);
  const [draft, setDraft] = useState('');

  const output = useSpeechOutput();
  const input = useSpeechInput(language);
  const support = useInputSupport();

  // Each new turn bumps this token, so an interrupted speak/listen does not carry on with stale work.
  const turn = useRef(0);
  const ended = useRef(false);
  const latest = useRef({ handsFree, voiceReplies });
  const onReply = useRef<(message: AgentUIMessage) => void>(() => {});

  const [transport] = useState(
    () =>
      new DefaultChatTransport<AgentUIMessage>({
        api: '/api/chat',
        // History lives in the database; send only the newest message.
        prepareSendMessagesRequest: ({ id, messages }) => ({ body: { id, message: messages.at(-1) } }),
      }),
  );

  const { messages, sendMessage, status, stop } = useChat<AgentUIMessage>({
    id: conversationId,
    messages: initialMessages,
    transport,
    onFinish: ({ message, isAbort, isError }) => {
      if (!isAbort && !isError) onReply.current(message);
    },
    onError: (error) => {
      setPhase('idle');
      toast.error(error.message || 'Asha could not respond. Please try again.');
    },
  });

  const captured = useMemo(() => deriveCaptured(messages), [messages]);

  async function takeTurn(using: InputEngine | null = engine) {
    if (!using || ended.current) return setPhase('idle');
    const myTurn = ++turn.current;
    setPhase('listening');
    const result = await input.listen(using);
    if (myTurn !== turn.current || ended.current) return;
    if ('text' in result) return send(result.text);

    // Browser recognition depends on the vendor's cloud service and language packs; Whisper does not.
    const browserUnavailable =
      using === 'browser' && (result.error === 'network' || result.error === 'language' || result.detail === 'unsupported');
    if (browserUnavailable && support.sarvam) {
      setEngine('sarvam');
      toast.info('Browser speech recognition isn’t available here, so I switched to Sarvam. Please say that again.');
      return takeTurn('sarvam');
    }
    setPhase('idle');
    const message = listenErrorMessage(result);
    if (message) toast.error(message);
  }

  function send(text: string) {
    const clean = text.trim();
    if (!clean || ended.current) return;
    turn.current++;
    output.cancel();
    input.abort();
    setPhase('thinking');
    void sendMessage({ text: clean });
  }

  async function respond(message: AgentUIMessage) {
    const myTurn = ++turn.current;
    const text = messageText(message);
    if (text && latest.current.voiceReplies && output.supported) {
      setPhase('speaking');
      await output.speak(text, language, settings.voice);
      if (myTurn !== turn.current) return;
    }
    if (message.parts.some((part) => part.type === 'tool-endCall')) return finish();
    if (latest.current.handsFree) return takeTurn();
    setPhase('idle');
  }

  async function finish() {
    if (ended.current) return;
    ended.current = true;
    turn.current++;
    output.cancel();
    input.abort();
    void stop();
    setPhase('ending');
    try {
      await endConversation(conversationId);
      // One transition: the summary page appears and the hidden call screen resets to a fresh setup together.
      startTransition(() => {
        router.push(`/history/${conversationId}`);
        onEnded();
      });
    } catch {
      ended.current = false;
      setPhase('idle');
      toast.error('Could not save the call summary. Try ending the call again.');
    }
  }

  function toggleVoiceReplies(on: boolean) {
    setVoiceReplies(on);
    if (!on) output.cancel();
  }

  function toggleHandsFree(on: boolean) {
    setHandsFree(on);
    if (on && phase === 'idle') void takeTurn();
  }

  function onMic() {
    unlockAudio();
    if (phase === 'listening') return input.stop();
    output.cancel();
    void takeTurn();
  }

  useEffect(() => {
    latest.current = { handsFree, voiceReplies };
    onReply.current = (message) => void respond(message);
  });

  // Asha opens the call. Deferred so React's dev double-mount does not cut the greeting off.
  useEffect(() => {
    const opening = initialMessages.at(-1);
    const timer = setTimeout(() => opening?.role === 'assistant' && onReply.current(opening), 150);
    return () => clearTimeout(timer);
  }, [initialMessages]);

  useEffect(() => {
    if (phase !== 'thinking') return;
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [phase]);

  const busy = status === 'submitted' || status === 'streaming' || phase === 'ending';
  const listening = phase === 'listening';

  return (
    <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]'>
      <section
        aria-label='Call with Asha'
        className='flex h-[calc(100dvh-9.5rem)] min-h-[30rem] flex-col rounded-lg border bg-card'
      >
        <header className='flex items-center justify-between gap-4 border-b px-5 py-3'>
          <CallStatus phase={phase} slow={slow} />
          <Button variant='destructive' onClick={finish} disabled={phase === 'ending'}>
            <PhoneOff aria-hidden='true' />
            End call
          </Button>
        </header>

        <div className='flex min-h-0 flex-1 flex-col px-5'>
          <Transcript messages={messages} interim={input.interim} catalogue={catalogue} />
        </div>

        <footer className='flex flex-col gap-3 border-t p-3 sm:p-4'>
          <form
            className='flex items-center gap-2'
            onSubmit={(event) => {
              event.preventDefault();
              unlockAudio();
              send(draft);
              setDraft('');
            }}
          >
            {engine && (
              <Button
                type='button'
                size='icon-lg'
                onClick={onMic}
                disabled={busy}
                aria-label={listening ? 'Stop listening' : 'Speak'}
                aria-pressed={listening}
                className={cn('size-11 shrink-0 rounded-full', listening && 'bg-live text-white hover:bg-live/85')}
              >
                {listening ? <Square aria-hidden='true' /> : <Mic aria-hidden='true' />}
              </Button>
            )}
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={language === 'hi' ? 'संदेश लिखें…' : 'Type a message…'}
              aria-label='Message'
              autoComplete='off'
              disabled={phase === 'ending'}
              className='h-11 text-base'
            />
            <Button
              type='submit'
              size='icon-lg'
              variant='outline'
              disabled={busy || !draft.trim()}
              aria-label='Send message'
              className='size-11 shrink-0'
            >
              <SendHorizontal aria-hidden='true' />
            </Button>
          </form>

          <div className='flex flex-wrap items-center gap-x-6 gap-y-2 text-sm'>
            {engine ? (
              <div className='flex items-center gap-2'>
                <Switch id='hands-free' checked={handsFree} onCheckedChange={toggleHandsFree} />
                <Label htmlFor='hands-free'>Hands-free</Label>
              </div>
            ) : (
              <p className='text-muted-foreground'>Voice input isn&rsquo;t available in this browser. Type instead.</p>
            )}
            {output.supported && (
              <div className='flex items-center gap-2'>
                <Switch id='voice-replies' checked={voiceReplies} onCheckedChange={toggleVoiceReplies} />
                <Label htmlFor='voice-replies'>Speak replies</Label>
              </div>
            )}
            <p className='ml-auto text-muted-foreground'>
              {language === 'hi' ? 'हिन्दी' : 'English'}
              {engine && ` · ${{ sarvam: 'Sarvam', browser: 'Browser', whisper: 'Whisper' }[engine]} speech`}
            </p>
          </div>
        </footer>
      </section>

      <CapturedPanel captured={captured} fallbackRetailer={retailer} />
    </div>
  );
}
