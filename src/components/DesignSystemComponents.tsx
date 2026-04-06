import React, { useState } from 'react';
import '../styles/editorial.css';

export const DossierHeader = ({ title, subtitle }: { title: string, subtitle: string }) => (
  <div style={{ border: '1px solid var(--editorial-outline, rgba(28,27,27,0.15))', padding: '2rem', marginBottom: '2rem', background: 'var(--editorial-surface-low)' }}>
    <p className="now-kicker" style={{ margin: 0, paddingLeft: '1rem', borderLeft: '2px solid var(--editorial-secondary)' }}>CREATIVE NORTH STAR</p>
    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', margin: '1rem 0', fontWeight: 900 }}>{title}</h1>
    <p style={{ fontFamily: 'var(--font-meta)', fontSize: '1.25rem', fontStyle: 'italic', margin: 0 }}>{subtitle}</p>
  </div>
);

export const ColorSwatch = ({ name, hex, variable, desc }: { name: string, hex: string, variable: string, desc: string }) => (
  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', padding: '1rem', background: 'var(--editorial-surface)', border: '1px solid var(--editorial-outline)' }}>
    <div style={{ width: '4rem', height: '4rem', backgroundColor: hex, border: '1px solid rgba(28,27,27,0.1)' }} />
    <div>
      <h3 style={{ margin: 0, fontFamily: 'var(--font-label)', fontSize: '0.85rem', textTransform: 'uppercase' }}>{name} ({hex})</h3>
      <code style={{ fontSize: '0.75rem', color: 'var(--editorial-secondary)' }}>{variable}</code>
      <p style={{ margin: '0.5rem 0 0 0', fontFamily: 'var(--font-meta)', fontSize: '0.9rem' }}>{desc}</p>
    </div>
  </div>
);

export const TypographySpec = ({ name, font, usage, preview }: { name: string, font: string, usage: string, preview: string }) => (
  <div style={{ marginBottom: '2rem', borderBottom: '1px solid var(--editorial-outline)', paddingBottom: '1rem' }}>
    <h3 style={{ fontFamily: 'var(--font-label)', fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{name} — {font}</h3>
    <p style={{ fontFamily: font, fontSize: '1.5rem', margin: '0.5rem 0', fontWeight: name === 'Display & Headlines' ? 900 : 400 }}>{preview}</p>
    <p style={{ fontFamily: 'var(--font-meta)', fontSize: '0.9rem', margin: 0 }}>{usage}</p>
  </div>
);

export const RuleBlock = ({ title, type, children }: { title: string, type: 'do' | 'dont' | 'rule', children: React.ReactNode }) => {
  const borderColor = type === 'do' ? 'var(--editorial-success)' : type === 'dont' ? 'var(--editorial-secondary)' : 'var(--editorial-ink)';
  return (
    <div style={{ borderLeft: `4px solid ${borderColor}`, padding: '1.5rem', background: 'var(--editorial-surface-low)', marginBottom: '1.5rem' }}>
      <h4 style={{ margin: '0 0 0.5rem 0', fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700 }}>{title}</h4>
      <div style={{ fontFamily: 'var(--font-meta)', fontSize: '0.95rem' }}>{children}</div>
    </div>
  );
};

export const RedactionBlock = ({ text }: { text: string }) => {
  const [revealed, setRevealed] = useState(false);
  return (
    <span 
      onMouseEnter={() => setRevealed(true)}
      onMouseLeave={() => setRevealed(false)}
      style={{ 
        backgroundColor: revealed ? 'transparent' : 'var(--editorial-ink)',
        color: revealed ? 'var(--editorial-ink)' : 'var(--editorial-ink)',
        padding: '0 0.2rem',
        cursor: 'crosshair',
        transition: 'background-color 0.2s ease',
        display: 'inline-block'
      }}
    >
      {text}
    </span>
  );
};
