import type { Meta, StoryObj } from '@storybook/react-vite';

import BroadsheetStamp from '../../components/BroadsheetStamp';
import { broadsheetStampContent } from '../../data/broadsheetContent';
import { withEditorialFrame } from './storyFrame';

const meta = {
	title: 'Editorial/BroadsheetStamp',
	component: BroadsheetStamp,
	parameters: { layout: 'fullscreen' },
	decorators: [withEditorialFrame],
	tags: ['autodocs'],
} satisfies Meta<typeof BroadsheetStamp>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Accent: Story = {
	args: broadsheetStampContent,
};

export const Signal: Story = {
	args: {
		label: 'Intent',
		value: 'Reconnaissance',
		tone: 'signal',
	},
};
