import type { Meta, StoryObj } from '@storybook/react-vite';

import InlineFigure from '../../components/InlineFigure';
import { inlineFigureContent } from '../../data/editorialContent';
import { withEditorialFrame } from './storyFrame';

const meta = {
	title: 'Editorial/InlineFigure',
	component: InlineFigure,
	parameters: { layout: 'fullscreen' },
	decorators: [withEditorialFrame],
	tags: ['autodocs'],
} satisfies Meta<typeof InlineFigure>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: inlineFigureContent,
};

export const AlternateCaption: Story = {
	args: {
		...inlineFigureContent,
		plateLabel: 'Plate 2.4',
		caption:
			'Placeholder systems map showing how dense informal routes overtake the visible administrative border once institutional capacity thins.',
	},
};
