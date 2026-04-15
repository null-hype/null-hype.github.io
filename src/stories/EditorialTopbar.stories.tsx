import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { EditorialTopbar } from '../components/EditorialTopbar';
import { topNavItems } from '../data/editorialContent';

const meta = {
  title: 'Dossier/Components/EditorialTopbar',
  component: EditorialTopbar,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="editorial-page" style={{ minHeight: '100px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EditorialTopbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    navItems: topNavItems,
  },
};

export const CustomBrand: Story = {
  args: {
    brandText: 'TIDELANDS',
    actionText: 'INQUIRE',
    navItems: [
      { label: 'ARCHIVE', href: '#' },
      { label: 'DOSSIERS', href: '#', active: true },
      { label: 'LABS', href: '#' },
      { label: 'STUDIO', href: '#' },
    ],
  },
};
