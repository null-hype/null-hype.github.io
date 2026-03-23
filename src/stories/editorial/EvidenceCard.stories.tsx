import type { Meta, StoryObj } from '@storybook/react-vite';

import EvidenceCard from '../../components/EvidenceCard';
import { evidenceCards } from '../../data/editorialContent';
import { withEditorialFrame } from './storyFrame';

const meta = {
	title: 'Editorial/EvidenceCard',
	component: EvidenceCard,
	parameters: { layout: 'fullscreen' },
	decorators: [withEditorialFrame],
	tags: ['autodocs'],
} satisfies Meta<typeof EvidenceCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Metric: Story = {
	args: evidenceCards[0],
};

export const Quote: Story = {
	args: evidenceCards[1],
};

export const Signal: Story = {
	args: evidenceCards[2],
};
