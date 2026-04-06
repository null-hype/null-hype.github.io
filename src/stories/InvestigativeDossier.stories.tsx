import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

const DossierPreview = () => (
  <div style={{ padding: '4rem', fontFamily: 'var(--font-meta, sans-serif)', background: 'var(--editorial-bg, #fcf9f8)', color: 'var(--editorial-ink, #1c1b1b)', minHeight: '100vh' }}>
    <h1 style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: '2.5rem', marginBottom: '1.5rem', fontWeight: 900 }}>Investigative Dossier Styleguide</h1>
    <p style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
      The original Storybook components have been cleared to make way for the new "Curated Forensic" aesthetic.
    </p>
    <p style={{ fontSize: '1.25rem', borderLeft: '4px solid var(--editorial-secondary, #ff3b30)', paddingLeft: '1rem', background: 'var(--editorial-surface-low, rgba(252, 249, 248, 0.7))', padding: '1rem' }}>
      Please open the <strong>Design</strong> tab in the addons panel below to view the interactive Stitch design generated for this styleguide.
    </p>
  </div>
);

const meta = {
  title: 'Design System/Investigative Dossier Preview',
  component: DossierPreview,
  parameters: {
    layout: 'fullscreen',
    design: {
      type: 'iframe',
      url: '/investigative-dossier.html',
    },
  },
} satisfies Meta<typeof DossierPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
