import type { Meta, StoryObj } from '@storybook/react-vite';

import EpistemicFrame from '../../components/EpistemicFrame';
import { epistemicFrameContent } from '../../data/editorialContent';
import { withEditorialFrame } from './storyFrame';

const meta = {
	title: 'Editorial/EpistemicFrame',
	component: EpistemicFrame,
	parameters: { layout: 'fullscreen' },
	decorators: [withEditorialFrame],
	tags: ['autodocs'],
} satisfies Meta<typeof EpistemicFrame>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: epistemicFrameContent,
};

export const ExpandedContract: Story = {
	args: {
		...epistemicFrameContent,
		flags: [...epistemicFrameContent.flags, { label: 'Method Note', tone: 'accent' as const }],
		boundaries: [
			...epistemicFrameContent.boundaries,
			'Not a claim that every regional shock belongs inside the same explanatory frame.',
		],
	},
};
