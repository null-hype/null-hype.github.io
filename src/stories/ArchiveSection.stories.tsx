import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArchiveSection } from '../components/ArchiveSection';
import { archiveEntries } from '../data/editorialContent';

const meta = {
  title: 'Dossier/Components/ArchiveSection',
  component: ArchiveSection,
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
} satisfies Meta<typeof ArchiveSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    entries: archiveEntries,
  },
};
