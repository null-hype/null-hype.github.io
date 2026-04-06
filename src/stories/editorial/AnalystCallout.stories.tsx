import type { Meta, StoryObj } from '@storybook/react-vite';

import AnalystCallout from '../../components/AnalystCallout';
import { analystCalloutContent } from '../../data/editorialContent';
import { withEditorialFrame } from './storyFrame';

const meta = {
	title: 'Editorial/AnalystCallout',
	component: AnalystCallout,
	parameters: { layout: 'fullscreen' },
	decorators: [withEditorialFrame],
	tags: ['autodocs'],
} satisfies Meta<typeof AnalystCallout>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Accent: Story = {
	args: analystCalloutContent,
};

export const Dark: Story = {
	args: {
		...analystCalloutContent,
		tone: 'dark',
		label: 'Signal Drift // 31-C',
	},
};
