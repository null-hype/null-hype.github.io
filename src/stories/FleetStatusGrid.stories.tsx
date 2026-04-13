import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { FleetStatusGrid, type TidelaneSlot } from '../components/FleetStatusGrid';

const dummySlots: TidelaneSlot[] = Array.from({ length: 39 }, (_, i) => ({
	id: `TL-${String(i + 1).padStart(3, '0')}`,
	moon: Math.floor(i / 3) + 1,
	phase: (['waxing', 'full', 'waning'][i % 3] as any),
	status: (['pool', 'sea', 'rain'][Math.floor(Math.random() * 3)] as any),
	label: `Agent Slot ${i + 1}`,
}));

const meta = {
	title: 'Broadsheet/Fleet Status Grid',
	component: FleetStatusGrid,
	parameters: {
		layout: 'fullscreen',
	},
	tags: ['autodocs'],
} satisfies Meta<typeof FleetStatusGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		slots: dummySlots,
	},
};

export const ActiveOnly: Story = {
	args: {
		slots: dummySlots.map(s => ({ ...s, status: 'sea' })),
		title: 'ACTIVE AGENTS',
	},
};
