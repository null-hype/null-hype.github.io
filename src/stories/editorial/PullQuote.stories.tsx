import type { Meta, StoryObj } from '@storybook/react-vite';

import PullQuote from '../../components/PullQuote';
import { pullQuoteContent } from '../../data/editorialContent';
import { withEditorialFrame } from './storyFrame';

const meta = {
	title: 'Editorial/PullQuote',
	component: PullQuote,
	parameters: { layout: 'fullscreen' },
	decorators: [withEditorialFrame],
	tags: ['autodocs'],
} satisfies Meta<typeof PullQuote>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: pullQuoteContent,
};

export const WithAttribution: Story = {
	args: {
		quote:
			'The archive does not close the argument; it widens the surface area where the next contradiction can appear.',
		attribution: 'Field note, placeholder dossier',
	},
};
