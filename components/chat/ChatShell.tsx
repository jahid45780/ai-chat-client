'use client';

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { ArrowUpRight, Copy, Edit3, Menu, Mic, MicOff, Pause, Play, Plus, RotateCcw, Send, Square, Volume2 } from 'lucide-react';
import { ChatSidebar } from '@/components/sidebar/ChatSidebar';
import { Protected } from '@/components/layout/Protected';
import { Markdown } from '@/components/ui/Markdown';
import { chatApi } from '@/lib/api/chat';
import { API_URL, errorMessage, fetchWithSession } from '@/lib/api/client';
import { Conversation, Message } from '@/types';
import { BrandMark } from '@/components/ui/BrandMark';
import { VoiceMode } from '@/components/chat/VoiceMode';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';

export function ChatShell() {
  const params = useParams<{ conversationId?: string }>();
  const id = params?.conversationId;
  return <Protected><ChatApp key={id || 'new'} id={id} /></Protected>;
}

function ChatApp({ id }: { id?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [loaded, setLoaded] = useState(!id);
  const [unavailable, setUnavailable] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const requestActive = useRef(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const voiceActive = useRef(false);
  const recognitionMode = useRef<'composer' | 'voice' | null>(null);
  const composerBase = useRef('');
  const voiceRequest = useRef(false);
  const speech = useTextToSpeech();
  const stopSpeech = speech.stop;
  const { supported: speechInputSupported, listening, error: speechError, setError: setSpeechError, start: startRecognition, stop: stopRecognition, cancel: cancelRecognition } = useSpeechRecognition(
    transcript => {
      if (recognitionMode.current === 'composer') setText([composerBase.current, transcript].filter(Boolean).join(' '));
      if (recognitionMode.current === 'voice') setVoiceTranscript(transcript);
    },
    transcript => {
      if (recognitionMode.current === 'composer') {
        setText([composerBase.current, transcript].filter(Boolean).join(' '));
        recognitionMode.current = null;
      } else if (recognitionMode.current === 'voice') {
        recognitionMode.current = null;
        if (!voiceActive.current) return;
        setVoiceTranscript(transcript);
        setVoiceState('thinking');
        voiceRequest.current = true;
        void stream('send', transcript, undefined, response => {
          voiceRequest.current = false;
          if (voiceActive.current) {
            const started = speech.speak(response, 'voice-mode', () => {
            if (voiceActive.current) {
              setVoiceState('listening');
              recognitionMode.current = 'voice';
              if (!startRecognition()) setVoiceState('idle');
            }
          });
            if (!started) setVoiceState('idle');
          }
        });
      }
    },
    message => {
      setVoiceError(message);
      setVoiceState('idle');
    },
  );

  useEffect(() => () => { voiceActive.current = false; cancelRecognition(); stopSpeech(); abort.current?.abort(); }, [cancelRecognition, stopSpeech]);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    Promise.all([chatApi.get(id), chatApi.messages(id)])
      .then(([current, history]) => {
        if (alive) {
          setConversation(current);
          setMessages(history);
        }
      })
      .catch(error => {
        if (axios.isAxiosError(error) && error.response?.status === 404) setUnavailable(true);
        setNotice(errorMessage(error));
      })
      .finally(() => { if (alive) setLoaded(true); });
    return () => {
      alive = false;
      abort.current?.abort();
    };
  }, [id]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function stream(mode: 'send' | 'regenerate' | 'edit', content?: string, messageId?: string, onComplete?: (response: string) => void) {
    if (requestActive.current) return;
    requestActive.current = true;
    setBusy(true);
    setNotice('');
    let current = conversation;
    let assistantId: string | null = null;
    const controller = new AbortController();
    abort.current = controller;
    try {
      current ??= await chatApi.create();
      if (controller.signal.aborted) {
        setConversation(current);
        if (mode === 'send' && content) setText(content);
        window.dispatchEvent(new Event('apc:conversations-updated'));
        if (!id) router.replace(`/chat/${current._id}`);
        return;
      }
      setConversation(current);
      assistantId = `pending-${Date.now()}`;
      setMessages(previous => [
        ...(mode === 'regenerate' && previous.at(-1)?.role === 'assistant' ? previous.slice(0, -1) : previous),
        ...(mode === 'send' ? [{ _id: `local-${Date.now()}`, conversation: current!._id, role: 'user' as const, content: content!, createdAt: new Date().toISOString() }] : []),
        { _id: assistantId!, conversation: current!._id, role: 'assistant', content: '', createdAt: new Date().toISOString() },
      ]);
      const response = await fetchWithSession(`${API_URL}/ai/stream`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: current._id, content, messageId, mode }), signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || 'Unable to generate a response');
      }
      if (!response.body) throw new Error('Streaming is not supported by this browser');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let completed = false;
      let assistantResponse = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() || '';
          for (const event of events) {
            const line = event.split('\n').find(item => item.startsWith('data:'));
            if (!line) continue;
            const data = JSON.parse(line.slice(5)) as { type: string; content?: string; message?: string };
            if (data.type === 'chunk') {
              assistantResponse += data.content || '';
              setMessages(previous => previous.map(message => message._id === assistantId ? { ...message, content: message.content + (data.content || '') } : message));
            }
            if (data.type === 'done') completed = true;
            if (data.type === 'error') throw new Error(data.message || 'AI generation failed');
          }
        }
      } finally {
        if (!completed) await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
      if (!controller.signal.aborted && !completed) throw new Error('The connection ended before the response completed. Retry the response.');
      if (!controller.signal.aborted) {
        setMessages(await chatApi.messages(current._id));
        setConversation(await chatApi.get(current._id));
        if (completed && assistantResponse.trim()) onComplete?.(assistantResponse);
      }
      window.dispatchEvent(new Event('apc:conversations-updated'));
      if (!id) router.replace(`/chat/${current._id}`);
    } catch (error) {
      if (onComplete && voiceRequest.current) { voiceRequest.current = false; setVoiceState('idle'); }
      if (assistantId) setMessages(previous => previous.filter(message => message._id !== assistantId));
      if (!controller.signal.aborted) setNotice(errorMessage(error));
      if (current) {
        if (mode === 'regenerate' && !controller.signal.aborted) {
          try { setMessages(await chatApi.messages(current._id)); } catch { /* Keep the user's local conversation visible. */ }
        }
        window.dispatchEvent(new Event('apc:conversations-updated'));
        if (!id) router.replace(`/chat/${current._id}`);
      }
    } finally {
      if (onComplete && voiceRequest.current) { voiceRequest.current = false; setVoiceState('idle'); }
      setBusy(false);
      abort.current = null;
      requestActive.current = false;
    }
  }

  function send(event?: FormEvent) {
    event?.preventDefault();
    const value = text.trim();
    if (!value || busy) return;
    setText('');
    if (area.current) area.current.style.height = 'auto';
    void stream('send', value);
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  function toggleComposerVoice() {
    setVoiceError('');
    setSpeechError('');
    if (listening && recognitionMode.current === 'composer') { stopRecognition(); return; }
    composerBase.current = text.trim();
    recognitionMode.current = 'composer';
    if (!startRecognition()) recognitionMode.current = null;
  }

  function openVoiceMode() {
    voiceActive.current = true;
    setVoiceError('');
    setSpeechError('');
    setVoiceTranscript('');
    setVoiceOpen(true);
    if (speech.activeId) speech.stop();
    recognitionMode.current = 'voice';
    setVoiceState('listening');
    if (!startRecognition()) setVoiceState('idle');
  }

  function toggleVoiceModeListening() {
    setVoiceError('');
    setSpeechError('');
    if (listening && recognitionMode.current === 'voice') { stopRecognition(); return; }
    voiceActive.current = true;
    recognitionMode.current = 'voice';
    setVoiceState('listening');
    if (!startRecognition()) setVoiceState('idle');
  }

  function closeVoiceMode() {
    voiceActive.current = false;
    recognitionMode.current = null;
    cancelRecognition();
    speech.stop();
    setVoiceOpen(false);
    setVoiceState('idle');
  }

  function playMessage(message: Message) {
    if (speech.activeId === message._id) speech.togglePause();
    else speech.speak(message.content, message._id);
  }

  async function edit(message: Message) {
    const updated = window.prompt('Edit your message', message.content);
    if (updated?.trim()) {
      setMessages(previous => previous.filter(item => new Date(item.createdAt) <= new Date(message.createdAt)).map(item => item._id === message._id ? { ...item, content: updated.trim() } : item));
      void stream('edit', updated.trim(), message._id);
    }
  }

  return <div className="chat-layout">
    <div className={`sidebar-overlay ${open ? 'visible' : ''}`} onClick={() => setOpen(false)} />
    <div className={`sidebar-wrap ${open ? 'drawer-open' : ''}`}><ChatSidebar onClose={() => setOpen(false)} /></div>
    <main className="chat-main">
      <header className="chat-header">
        <button className="icon-button mobile-only" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
        <span className="header-title">{conversation?.title || 'BROKEN AI'}</span>
        <span className="model-badge">{conversation?.model || 'AI assistant'}</span>
        <button className="icon-button desktop-only" onClick={() => router.push('/chat')} aria-label="New chat"><Plus size={18} /></button>
      </header>
      {!loaded ? <div className="message-loader"><span className="spinner" />Loading conversation…</div> : unavailable ? <section className="message-scroll empty"><div className="welcome"><h1>Conversation unavailable</h1><p>{notice || 'This conversation may have been deleted or is not accessible.'}</p><button className="primary-button" onClick={() => router.push('/chat')}>Start a new chat</button></div></section> : <>
        <section className={`message-scroll ${messages.length === 0 ? 'empty' : ''}`} aria-live="polite">
          {!messages.length ? <div className="welcome"><div className="welcome-icon"><BrandMark /></div><div className="welcome-kicker">A workspace for ideas</div><h1>What are you working on?</h1><p>Ask a question, explore an idea, or get help with a task.</p><div className="suggestions">{['Explain a complex idea simply', 'Help me write something', 'Debug a piece of code', 'Brainstorm some ideas'].map(suggestion => <button key={suggestion} onClick={() => setText(suggestion)}>{suggestion}<ArrowUpRight size={15}/></button>)}</div></div> : messages.map((message, index) => <article className={`message ${message.role}`} key={message._id}>
            <div className="message-avatar">{message.role === 'user' ? 'Y' : <BrandMark className="message-mark"/>}</div>
            <div className="message-body"><div className="message-label">{message.role === 'user' ? 'You' : 'BROKEN AI'}</div>
              {message.role === 'assistant' ? <Markdown content={message.content} /> : <p className="user-text">{message.content}</p>}
              <div className="message-tools">{message.role === 'assistant' && message.content && <>{speech.supported && <><button className={speech.activeId === message._id ? 'is-speaking' : ''} onClick={() => playMessage(message)} aria-label={speech.activeId === message._id ? (speech.paused ? 'Resume speech' : 'Pause speech') : 'Read response aloud'} title={speech.activeId === message._id ? (speech.paused ? 'Resume speech' : 'Pause speech') : 'Read response aloud'}>{speech.activeId === message._id ? (speech.paused ? <Play size={14} /> : <Pause size={14} />) : <Volume2 size={14} />}</button>{speech.activeId === message._id && <button onClick={speech.stop} aria-label="Stop speaking" title="Stop speaking"><Square size={12} /></button>}</>}<button onClick={() => void navigator.clipboard.writeText(message.content)} aria-label="Copy response"><Copy size={14} /></button>{index === messages.length - 1 && !busy && <button onClick={() => void stream('regenerate')} aria-label="Regenerate response"><RotateCcw size={14} /></button>}</>}{message.role === 'user' && !busy && <><button onClick={() => void edit(message)} aria-label="Edit message"><Edit3 size={14} /></button>{index === messages.length - 1 && <button onClick={() => void stream('regenerate')} aria-label="Retry response"><RotateCcw size={14} /></button>}</>}</div>
            </div>
          </article>)}
          {busy && <div className="working"><span className="pulse-dot" />Thinking…</div>}
          <div ref={bottom} />
        </section>
        <div className="composer-wrap">
          {notice && <div className="error-banner" role="alert">{notice} <button onClick={() => setNotice('')}>Dismiss</button><button onClick={() => void stream('regenerate')}>Retry response</button></div>}
          <form className="composer" onSubmit={send}>
            <div className="composer-fields">
            <textarea ref={area} value={text} maxLength={20000} onChange={event => { setText(event.target.value); event.target.style.height = 'auto'; event.target.style.height = `${Math.min(event.target.scrollHeight, 180)}px`; }} onKeyDown={keyDown} placeholder="Message BROKEN AI…" rows={1} aria-label="Write a message" disabled={busy} />
              <div className="composer-tools"><div className="voice-shortcuts"><button className={`voice-input-button ${listening && recognitionMode.current === 'composer' ? 'active' : ''}`} type="button" onClick={toggleComposerVoice} disabled={busy} aria-label={listening && recognitionMode.current === 'composer' ? 'Stop voice input' : 'Start voice input'} title={listening && recognitionMode.current === 'composer' ? 'Stop voice input' : 'Start voice input'}>{listening && recognitionMode.current === 'composer' ? <MicOff size={16} /> : <Mic size={16} />}</button><button className="voice-mode-button" type="button" onClick={openVoiceMode} disabled={busy} aria-label="Open voice mode"><Mic size={14} /><span>Voice mode</span></button></div>{listening && recognitionMode.current === 'composer' && <span className="voice-listening" aria-live="polite"><i />Listening...</span>}{(speechError || voiceError) && !voiceOpen && <span className="voice-inline-error" role="status">{speechError || voiceError}</span>}</div>
            </div>
            {busy ? <button className="send-button stop-button" type="button" onClick={() => { cancelRecognition(); abort.current?.abort(); }} aria-label="Stop generation"><Square size={15} fill="currentColor" /></button> : <button className="send-button" type="submit" disabled={!text.trim()} aria-label="Send message"><Send size={17} /></button>}
          </form>
          <p className="composer-note">AI can make mistakes. Verify important information.</p>
        </div>
      </>}
    </main>
    <VoiceMode open={voiceOpen} state={voiceState} transcript={voiceTranscript} error={voiceError || speechError} supported={speechInputSupported} speechPaused={speech.paused} onClose={closeVoiceMode} onListen={toggleVoiceModeListening} onStopSpeech={() => { speech.stop(); setVoiceState('idle'); }} onToggleSpeech={speech.togglePause} />
  </div>;
}
