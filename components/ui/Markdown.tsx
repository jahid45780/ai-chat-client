'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';
import hljs from 'highlight.js/lib/common';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character);
}

function CodeBlock({ children, language }: { children: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlighted = useMemo(() => {
    try {
      if (language) return hljs.getLanguage(language) ? hljs.highlight(children, { language, ignoreIllegals: true }).value : escapeHtml(children);
      return hljs.highlightAuto(children).value;
    } catch {
      return escapeHtml(children);
    }
  }, [children, language]);

  useEffect(() => () => { if (copyTimeout.current) clearTimeout(copyTimeout.current); }, []);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
      copyTimeout.current = setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return <div className="code-wrap">
    <div className="code-top"><span>{language || 'code'}</span><button onClick={() => void copyCode()} aria-label="Copy code">{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}</button></div>
    <pre><code className={`hljs${language ? ` language-${language}` : ''}`} dangerouslySetInnerHTML={{ __html: highlighted }} /></pre>
  </div>;
}

export function Markdown({ content }: { content: string }) {
  return <div className="prose-chat"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const text = String(children).replace(/\n$/, '');
      return match ? <CodeBlock language={match[1]}>{text}</CodeBlock> : <code className="inline-code" {...props}>{children}</code>;
    },
  }}>{content}</ReactMarkdown></div>;
}
