'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function useTextToSpeech() {
  const [supported] = useState(typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const onEnd = useRef<(() => void) | undefined>(undefined);
  const sequence = useRef(0);

  useEffect(() => {
    return () => {
      sequence.current += 1;
      window.speechSynthesis?.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    sequence.current += 1;
    onEnd.current = undefined;
    window.speechSynthesis?.cancel();
    setActiveId(null);
    setPaused(false);
  }, []);

  const speak = useCallback((text: string, id: string, after?: () => void) => {
    if (!('speechSynthesis' in window) || !text.trim()) return false;
    sequence.current += 1;
    const current = sequence.current;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    onEnd.current = after;
    utterance.onend = () => {
      if (current !== sequence.current) return;
      const done = onEnd.current;
      onEnd.current = undefined;
      setActiveId(null);
      setPaused(false);
      done?.();
    };
    utterance.onerror = () => {
      if (current !== sequence.current) return;
      onEnd.current = undefined;
      setActiveId(null);
      setPaused(false);
    };
    setActiveId(id);
    setPaused(false);
    window.speechSynthesis.speak(utterance);
    return true;
  }, []);

  const togglePause = useCallback(() => {
    if (!('speechSynthesis' in window) || !activeId) return;
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setPaused(false);
    } else {
      window.speechSynthesis.pause();
      setPaused(true);
    }
  }, [activeId]);

  return { supported, activeId, paused, speak, stop, togglePause };
}
