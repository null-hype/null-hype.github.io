import type { Meta, StoryObj } from '@storybook/react-vite';

import BroadsheetArchiveView from '../../components/BroadsheetArchiveView';
import { broadsheetArchiveViewContent } from '../../data/broadsheetContent';

const meta = {
	title: 'Editorial/BroadsheetArchiveView',
	component: BroadsheetArchiveView,
	parameters: { 
		layout: 'fullscreen',
		design: {
			type: 'iframe',
			url: '/broadsheet-archive.html',
		},
	},
	tags: ['autodocs'],
} satisfies Meta<typeof BroadsheetArchiveView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: broadsheetArchiveViewContent,
};
