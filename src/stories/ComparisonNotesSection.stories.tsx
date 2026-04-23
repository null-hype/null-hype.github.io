import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ComparisonNotesSection } from '../components/ComparisonNotesSection';
import { comparisonNotes } from '../data/editorialContent';

const meta = {
  title: 'Dossier/Components/ComparisonNotesSection',
  component: ComparisonNotesSection,
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
} satisfies Meta<typeof ComparisonNotesSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    notes: comparisonNotes,
  },
};
