import type { Meta, StoryObj } from '@storybook/react-vite';

import EpistemicFlag from '../../components/EpistemicFlag';
import { withEditorialFrame } from './storyFrame';

const meta = {
	title: 'Editorial/EpistemicFlag',
	component: EpistemicFlag,
	parameters: { layout: 'fullscreen' },
	decorators: [withEditorialFrame],
	tags: ['autodocs'],
} satisfies Meta<typeof EpistemicFlag>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Signal: Story = {
	args: {
		label: 'Probable',
		tone: 'signal',
	},
};

export const Accent: Story = {
	args: {
		label: 'Disputed',
		tone: 'accent',
	},
};
