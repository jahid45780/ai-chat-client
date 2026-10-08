'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechResult = { transcript: string };
type SpeechRecognitionResult = ArrayLike<SpeechResult> & { isFinal: boolean };
type SpeechRecognitionEvent = { resultIndex: number; results: ArrayLike<SpeechRecognitionResult> };
type SpeechRecognitionErrorEvent = { error: string };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionConstructor = new () => Recognition;

function getRecognitionConstructor(): RecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  const speechWindow = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
}

export function useSpeechRecognition(onTranscript: (value: string) => void, onComplete: (value: string) => void, onFailure: (message: string) => void) {
  const [supported] = useState(Boolean(getRecognitionConstructor()));
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recognition = useRef<Recognition | null>(null);
  const callback = useRef(onTranscript);
  const complete = useRef(onComplete);
  const failure = useRef(onFailure);
  const finalText = useRef('');
  const discard = useRef(false);
  const sessionFailed = useRef(false);

  useEffect(() => { callback.current = onTranscript; complete.current = onComplete; failure.current = onFailure; }, [onTranscript, onComplete, onFailure]);

  useEffect(() => {
    const Constructor = getRecognitionConstructor();
    if (!Constructor) return;
    const instance = new Constructor();
    instance.lang = navigator.language || 'en-US';
    instance.continuous = false;
    instance.interimResults = true;
    instance.onresult = event => {
      const pieces: string[] = [];
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal && result[0]?.transcript) pieces.push(result[0].transcript.trim());
      }
      finalText.current = pieces.join(' ').trim();
      const displayed = Array.from({ length: event.results.length }, (_, index) => event.results[index]?.[0]?.transcript?.trim() || '').filter(Boolean).join(' ').trim();
      callback.current(displayed);
    };
    instance.onerror = event => {
      sessionFailed.current = true;
      let message = '';
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed' || event.error === 'audio-capture') message = 'Microphone permission is required for voice input.';
      else if (event.error === 'no-speech') message = 'No speech was detected. Try again.';
      else if (event.error !== 'aborted') message = 'Voice input stopped unexpectedly. Please try again.';
      setError(message);
      if (message) failure.current(message);
      setListening(false);
    };
    instance.onend = () => {
      setListening(false);
      if (!discard.current && finalText.current) complete.current(finalText.current);
      else if (!discard.current && !sessionFailed.current) {
        const message = 'No speech was detected. Try again.';
        setError(message);
        failure.current(message);
      }
      discard.current = false;
    };
    recognition.current = instance;
    return () => {
      discard.current = true;
      instance.onresult = null;
      instance.onerror = null;
      instance.onend = null;
      instance.abort();
      recognition.current = null;
    };
  }, []);

  const start = useCallback(() => {
    setError('');
    finalText.current = '';
    sessionFailed.current = false;
    discard.current = false;
    if (!recognition.current) {
      setError("Voice input isn't supported in this browser.");
      return false;
    }
    try {
      recognition.current.start();
      setListening(true);
      return true;
    } catch {
      setError('Voice input could not start. Please try again.');
      setListening(false);
      return false;
    }
  }, []);

  const stop = useCallback(() => {
    if (!recognition.current || !listening) return;
    try { recognition.current.stop(); } catch { setListening(false); }
  }, [listening]);

  const cancel = useCallback(() => {
    discard.current = true;
    finalText.current = '';
    try { recognition.current?.abort(); } catch { /* Browser may already have ended recognition. */ }
    setListening(false);
  }, []);

  return { supported, listening, error, setError, start, stop, cancel };
}
