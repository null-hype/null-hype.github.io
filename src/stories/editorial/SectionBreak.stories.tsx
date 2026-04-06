import type { Meta, StoryObj } from '@storybook/react-vite';

import SectionBreak from '../../components/SectionBreak';
import { sectionBreakContent } from '../../data/editorialContent';
import { withEditorialFrame } from './storyFrame';

const meta = {
	title: 'Editorial/SectionBreak',
	component: SectionBreak,
	parameters: { layout: 'fullscreen' },
	decorators: [withEditorialFrame],
	tags: ['autodocs'],
} satisfies Meta<typeof SectionBreak>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: sectionBreakContent,
};

export const AlternateSection: Story = {
	args: {
		title: 'Terminal Briefing',
		eyebrow: 'Forward Projection',
		meta: 'Clearance Level: Delta-3',
	},
};
