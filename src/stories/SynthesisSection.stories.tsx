import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SynthesisSection } from '../components/SynthesisSection';
import { synthesisContent, watchlistContent } from '../data/editorialContent';

const meta = {
  title: 'Dossier/Components/SynthesisSection',
  component: SynthesisSection,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="editorial-page" style={{ padding: '2rem 0' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SynthesisSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    synthesisContent,
    watchlistContent,
  },
};
