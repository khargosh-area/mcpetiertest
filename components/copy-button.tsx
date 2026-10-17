'use client';

import { useState } from 'react';
import { IconCopy, IconCheck } from './icons';

export default function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const area = document.createElement('textarea');
      area.value = value;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button className="btn sm ghost" onClick={copy} type="button">
      {copied ? <IconCheck width={13} height={13} /> : <IconCopy width={13} height={13} />}
      {copied ? 'Copied' : label}
    </button>
  );
}
