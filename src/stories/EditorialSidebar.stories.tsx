import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { EditorialSidebar } from '../components/EditorialSidebar';
import { sideRailItems } from '../data/editorialContent';

const meta = {
  title: 'Dossier/Components/EditorialSidebar',
  component: EditorialSidebar,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="editorial-page" style={{ minHeight: '100vh', display: 'flex' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EditorialSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    navItems: sideRailItems,
  },
};

export const CustomReference: Story = {
  args: {
    brandMark: 'TID',
    reference: 'Project ID: A-742_VOID',
    navItems: [
      { label: 'Sector', href: '#' },
      { label: 'Tools', href: '#' },
      { label: 'Location', href: '#' },
      { label: 'Personnel', href: '#' },
    ],
  },
};
