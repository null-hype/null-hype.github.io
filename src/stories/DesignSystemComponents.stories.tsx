import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { 
  DossierHeader, 
  ColorSwatch, 
  TypographySpec, 
  RuleBlock, 
  RedactionBlock 
} from '../components/DesignSystemComponents';

const meta = {
  title: 'Design System/Components',
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ fontFamily: 'var(--font-meta)', color: 'var(--editorial-ink)' }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta;

export default meta;

export const Header: StoryObj<typeof DossierHeader> = {
  render: () => (
    <DossierHeader 
      title="The Curated Forensic" 
      subtitle="This design system rejects the 'hacker' clichés of terminal green and digital rain. Instead, it adopts the persona of a high-end, investigative editorial."
    />
  )
};

export const PaletteSwatch: StoryObj<typeof ColorSwatch> = {
  render: () => (
    <div style={{ display: 'grid', gap: '1rem', maxWidth: '400px' }}>
      <ColorSwatch 
        name="Accent: Cobalt Blue" 
        hex="#00327d" 
        variable="--editorial-accent" 
        desc="Primary highlighter or stamped accent." 
      />
    </div>
  )
};

export const TypographyPreview: StoryObj<typeof TypographySpec> = {
  render: () => (
    <TypographySpec 
      name="Display & Headlines" 
      font="var(--font-display)" 
      usage="These are your 'rule-breakers.' Headlines should utilize selective color shifts. Encourage Baseline Shifts to mimic manual typesetting errors." 
      preview="THE CURATED FORENSIC" 
    />
  )
};

export const DesignRules: StoryObj<typeof RuleBlock> = {
  render: () => (
    <div>
      <RuleBlock title="Do: Use 'Ink Bleed' Accents" type="do">
        Use the cobalt or red accents as small, asymmetrical blocks of color that "bleed" off the edge of the screen.
      </RuleBlock>
      <RuleBlock title="Don't: No Rounded Corners" type="dont">
        <code>0px</code> is the absolute rule. Any radius breaks the "raw" aesthetic.
      </RuleBlock>
      <RuleBlock title="The Layering Principle" type="rule">
        Stack <code>surface-container</code> tiers. A "Project Card" should be <code>surface_container_highest</code> sitting on a <code>surface</code> background.
      </RuleBlock>
    </div>
  )
};

export const RedactedText: StoryObj<typeof RedactionBlock> = {
  render: () => (
    <p style={{ fontSize: '1.25rem' }}>
      Hover over this text to reveal the secret: <RedactionBlock text="Project Tidelands was an inside job." />
    </p>
  )
};
