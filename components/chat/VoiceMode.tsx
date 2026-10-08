'use client';

import { AudioLines, Mic, MicOff, Pause, Play, Square, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

export function VoiceMode({ open, state, transcript, error, supported, speechPaused, onClose, onListen, onStopSpeech, onToggleSpeech }: {
  open: boolean;
  state: VoiceState;
  transcript: string;
  error: string;
  supported: boolean;
  speechPaused: boolean;
  onClose: () => void;
  onListen: () => void;
  onStopSpeech: () => void;
  onToggleSpeech: () => void;
}) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);
  if (!open) return null;
  const labels: Record<VoiceState, string> = { idle: 'Tap the microphone to speak', listening: 'Listening...', thinking: 'Thinking...', speaking: speechPaused ? 'Speech paused' : 'Speaking...' };
  return <div className="voice-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="voice-panel" role="dialog" aria-modal="true" aria-labelledby="voice-mode-title">
      <button className="icon-button voice-close" onClick={onClose} aria-label="Close voice mode"><X size={19} /></button>
      <div className={`voice-orbit ${state}`} aria-hidden="true"><span /><span /><span /><div className="voice-orbit-core"><AudioLines size={28} /></div></div>
      <div className="voice-kicker">BROKEN AI · VOICE MODE</div>
      <h2 id="voice-mode-title">{labels[state]}</h2>
      <p className="voice-description">Speak naturally. Your words use the same secure chat and conversation history.</p>
      <div className="voice-transcript" aria-live="polite">{transcript || (state === 'idle' ? 'Your recognized words will appear here.' : '')}</div>
      {error && <p className="voice-error" role="alert">{error}</p>}
      <div className="voice-controls">
        {state === 'speaking' ? <>
          <button className="voice-secondary" onClick={onToggleSpeech} aria-label={speechPaused ? 'Resume speech' : 'Pause speech'}>{speechPaused ? <Play size={17} /> : <Pause size={17} />}{speechPaused ? 'Resume' : 'Pause'}</button>
          <button className="voice-primary" onClick={onStopSpeech} aria-label="Stop speaking"><Square size={17} fill="currentColor" />Stop</button>
        </> : <button className={`voice-primary ${state === 'listening' ? 'recording' : ''}`} onClick={state === 'listening' ? onListen : onListen} aria-label={state === 'listening' ? 'Stop voice input' : 'Start voice input'} disabled={state === 'thinking'}>
          {state === 'listening' ? <MicOff size={19} /> : <Mic size={19} />}{state === 'listening' ? 'Stop listening' : state === 'thinking' ? 'Thinking...' : 'Start speaking'}
        </button>}
      </div>
      {!supported && <p className="voice-footnote">Voice input isn&apos;t supported in this browser. Text chat is still available.</p>}
      <p className="voice-footnote">Microphone access is only used while listening.</p>
    </section>
  </div>;
}
