import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Design System/Stitch References',
  render: () => <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>View the Design tab to see the Stitch design reference.</div>,
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const BroadsheetArchive: Story = {
  parameters: {
    design: {
      type: 'iframe',
      url: '/broadsheet-archive.html',
    },
  },
};

export const BroadsheetDispatch: Story = {
  parameters: {
    design: {
      type: 'iframe',
      url: '/broadsheet-dispatch.html',
    },
  },
};

export const BroadsheetFlagship: Story = {
  parameters: {
    design: {
      type: 'iframe',
      url: '/broadsheet-flagship.html',
    },
  },
};

export const ExpandedDossier: Story = {
  parameters: {
    design: {
      type: 'iframe',
      url: '/expanded-dossier.html',
    },
  },
};

export const FinalDesignSpec: Story = {
  parameters: {
    design: {
      type: 'iframe',
      url: '/final-design-spec.html',
    },
  },
};

export const InvestigativeDossier: Story = {
  parameters: {
    design: {
      type: 'iframe',
      url: '/investigative-dossier.html',
    },
  },
};

export const LegacyBankingKernels: Story = {
  parameters: {
    design: {
      type: 'iframe',
      url: '/legacy-banking-kernels.html',
    },
  },
};
