import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { EditorialFooter } from '../components/EditorialFooter';
import { footerLinks } from '../data/editorialContent';

const meta = {
  title: 'Dossier/Components/EditorialFooter',
  component: EditorialFooter,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="editorial-page">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EditorialFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    links: footerLinks,
  },
};
