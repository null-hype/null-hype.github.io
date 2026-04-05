import type { Meta, StoryObj } from '@storybook/react-vite';

import BroadsheetDispatchView from '../../components/BroadsheetDispatchView';
import { broadsheetDispatchViewContent } from '../../data/broadsheetContent';

const meta = {
	title: 'Editorial/BroadsheetDispatchView',
	component: BroadsheetDispatchView,
	parameters: { 
		layout: 'fullscreen',
		design: {
			type: 'iframe',
			url: '/broadsheet-dispatch.html',
		},
	},
	tags: ['autodocs'],
} satisfies Meta<typeof BroadsheetDispatchView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: broadsheetDispatchViewContent,
};
