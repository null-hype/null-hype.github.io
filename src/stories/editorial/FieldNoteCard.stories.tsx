import type { Meta, StoryObj } from '@storybook/react-vite';

import FieldNoteCard from '../../components/FieldNoteCard';
import { fieldNoteCardContent } from '../../data/broadsheetContent';
import { withEditorialFrame } from './storyFrame';

const meta = {
	title: 'Editorial/FieldNoteCard',
	component: FieldNoteCard,
	parameters: { layout: 'fullscreen' },
	decorators: [withEditorialFrame],
	tags: ['autodocs'],
} satisfies Meta<typeof FieldNoteCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: fieldNoteCardContent,
};

export const Accent: Story = {
	args: {
		...fieldNoteCardContent,
		title: 'Historical Context',
		tone: 'accent',
	},
};
