import type { Meta, StoryObj } from '@storybook/react-vite';

import CounterargumentPanel from '../../components/CounterargumentPanel';
import { withEditorialFrame } from './storyFrame';

const meta = {
	title: 'Editorial/CounterargumentPanel',
	component: CounterargumentPanel,
	parameters: { layout: 'fullscreen' },
	decorators: [withEditorialFrame],
	tags: ['autodocs'],
} satisfies Meta<typeof CounterargumentPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		body: 'Assumes the placeholder sequence can be read as coherent control. A stricter reading might reduce it to a series of unrelated local survivals.',
	},
};

export const LongerCritique: Story = {
	args: {
		title: 'Red Team Counterargument',
		body: 'The apparent pattern could be an artifact of narrative compression. When the cases are decomposed by regime type, patronage structure, and economic constraint, the similarities may weaken faster than the rhetoric suggests.',
	},
};
