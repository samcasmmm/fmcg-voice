'use client';

import { Phone } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { startConversation } from '@/app/actions';
import { LiveCall, type CallSettings } from '@/components/call/live-call';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { Language, Retailer } from '@/db/schema';
import { useInputSupport, type InputEngine } from '@/hooks/use-speech-input';
import { unlockAudio, useSpeechOutputSupported, type VoiceEngine } from '@/hooks/use-speech-output';
import type { AgentUIMessage } from '@/lib/agent/tools';
import type { ProductCardData } from '@/lib/catalogue';

const UNSELECTED = 'ask';

type Session = { id: string; messages: AgentUIMessage[]; settings: CallSettings; retailer: Retailer | null };

export function CallExperience({
  retailers,
  catalogue,
  sarvam,
}: {
  retailers: Retailer[];
  catalogue: ProductCardData[];
  /** Whether the server has a Sarvam API key. */
  sarvam: boolean;
}) {
  const [session, setSession] = useState<Session | null>(null);

  if (session) {
    return (
      <LiveCall
        conversationId={session.id}
        initialMessages={session.messages}
        settings={session.settings}
        retailer={session.retailer}
        catalogue={catalogue}
        onEnded={() => setSession(null)}
      />
    );
  }
  return <CallSetup retailers={retailers} sarvam={sarvam} onStarted={setSession} />;
}

function CallSetup({
  retailers,
  sarvam,
  onStarted,
}: {
  retailers: Retailer[];
  sarvam: boolean;
  onStarted: (session: Session) => void;
}) {
  const recorderSupport = useInputSupport();
  const support = { ...recorderSupport, sarvam: sarvam && recorderSupport.sarvam };
  const browserVoice = useSpeechOutputSupported();
  const [retailerId, setRetailerId] = useState(UNSELECTED);
  const [language, setLanguage] = useState<Language>('en');
  const [engineChoice, setEngineChoice] = useState<InputEngine>('sarvam');
  const [voiceChoice, setVoiceChoice] = useState<VoiceEngine>('sarvam');
  const [handsFree, setHandsFree] = useState(true);
  const [pending, startTransition] = useTransition();

  // Fall back to whichever capture method this browser supports.
  const engine: InputEngine | null = support[engineChoice]
    ? engineChoice
    : (['sarvam', 'browser', 'whisper'] as const).find((option) => support[option]) ?? null;
  const voice: VoiceEngine | null = sarvam ? voiceChoice : browserVoice ? 'browser' : null;
  const retailer = retailers.find((r) => String(r.id) === retailerId) ?? null;

  function chooseRetailer(value: string) {
    setRetailerId(value);
    const chosen = retailers.find((r) => String(r.id) === value);
    if (chosen) setLanguage(chosen.language);
  }

  function start() {
    // Must run inside the click: lets Asha's greeting play once the call connects.
    unlockAudio();
    startTransition(async () => {
      try {
        const { id, messages } = await startConversation({ retailerId: retailer?.id ?? null, language });
        onStarted({
          id,
          messages: messages as AgentUIMessage[],
          retailer,
          settings: { language, engine, voice: voice ?? 'browser', handsFree, voiceReplies: voice !== null },
        });
      } catch {
        toast.error('Could not start the call. Check the database connection and try again.');
      }
    });
  }

  return (
    <div className='mx-auto flex max-w-xl flex-col gap-8 py-6'>
      <div className='flex flex-col gap-2'>
        <h1 className='font-condensed text-4xl leading-none font-extrabold tracking-[-0.01em] text-balance'>
          Call the sales assistant
        </h1>
        <p className='text-muted-foreground text-pretty'>
          Talk to Asha about products, prices, schemes and stock. She notes order enquiries and follow-ups, and saves a
          summary when the call ends.
        </p>
      </div>

      <div className='flex flex-col gap-6 rounded-lg border bg-card p-5 sm:p-6'>
        <div className='flex flex-col gap-2'>
          <Label htmlFor='retailer'>Retailer</Label>
          <Select value={retailerId} onValueChange={chooseRetailer}>
            <SelectTrigger id='retailer' className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSELECTED}>Not selected: Asha will ask</SelectItem>
              {retailers.map((r) => (
                <SelectItem key={r.id} value={String(r.id)}>
                  {r.shopName} · {r.ownerName}, {r.town}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='flex flex-col gap-2'>
          <Label id='language-label'>Language</Label>
          <ToggleGroup
            type='single'
            variant='outline'
            value={language}
            onValueChange={(value) => value && setLanguage(value as Language)}
            aria-labelledby='language-label'
            className='w-full'
          >
            <ToggleGroupItem value='en' className='flex-1'>
              English
            </ToggleGroupItem>
            <ToggleGroupItem value='hi' className='flex-1' lang='hi'>
              हिन्दी
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className='flex flex-col gap-2'>
          <Label id='engine-label'>Speech recognition</Label>
          <ToggleGroup
            type='single'
            variant='outline'
            value={engine ?? ''}
            onValueChange={(value) => value && setEngineChoice(value as InputEngine)}
            aria-labelledby='engine-label'
            className='w-full'
          >
            <ToggleGroupItem value='sarvam' className='flex-1' disabled={!support.sarvam}>
              Sarvam
            </ToggleGroupItem>
            <ToggleGroupItem value='browser' className='flex-1' disabled={!support.browser}>
              Browser
            </ToggleGroupItem>
            <ToggleGroupItem value='whisper' className='flex-1' disabled={!support.whisper}>
              Whisper
            </ToggleGroupItem>
          </ToggleGroup>
          <p className='text-sm text-muted-foreground'>
            {engine === null
              ? 'This browser can’t capture speech. You can still type.'
              : engine === 'sarvam'
                ? 'Sarvam Saaras: built for Indian English, Hindi and Hinglish. Falls back to Whisper if unavailable.'
                : engine === 'browser'
                  ? 'Free and instant. Works best in Chrome or Edge.'
                  : 'Groq Whisper transcription. Works in any modern browser.'}
          </p>
        </div>

        <div className='flex flex-col gap-2'>
          <Label id='voice-label'>Asha&rsquo;s voice</Label>
          <ToggleGroup
            type='single'
            variant='outline'
            value={voice ?? ''}
            onValueChange={(value) => value && setVoiceChoice(value as VoiceEngine)}
            aria-labelledby='voice-label'
            className='w-full'
          >
            <ToggleGroupItem value='sarvam' className='flex-1' disabled={!sarvam}>
              Sarvam (Simran)
            </ToggleGroupItem>
            <ToggleGroupItem value='browser' className='flex-1' disabled={!browserVoice}>
              Browser voice
            </ToggleGroupItem>
          </ToggleGroup>
          <p className='text-sm text-muted-foreground'>
            {voice === 'sarvam'
              ? 'Natural Indian voice from Sarvam Bulbul, in English and Hindi. Falls back to the browser voice if unavailable.'
              : voice === 'browser'
                ? 'Uses a voice installed on this device; quality varies, especially for Hindi.'
                : 'This browser can’t play speech. Replies stay on screen.'}
          </p>
        </div>

        {engine && (
          <div className='flex items-center justify-between gap-4'>
            <div className='flex flex-col gap-0.5'>
              <Label htmlFor='setup-hands-free'>Hands-free</Label>
              <p className='text-sm text-muted-foreground'>The mic opens automatically after Asha speaks.</p>
            </div>
            <Switch id='setup-hands-free' checked={handsFree} onCheckedChange={setHandsFree} />
          </div>
        )}

        <Button size='lg' onClick={start} disabled={pending} className='h-12 text-base'>
          <Phone aria-hidden='true' />
          {pending ? 'Connecting…' : 'Start call'}
        </Button>
      </div>
    </div>
  );
}
