import type { Meta, StoryObj } from '@storybook/react-vite';

import ArchiveEntry from '../../components/ArchiveEntry';
import { archiveEntries } from '../../data/editorialContent';
import { withEditorialFrame } from './storyFrame';

const meta = {
	title: 'Editorial/ArchiveEntry',
	component: ArchiveEntry,
	parameters: { layout: 'fullscreen' },
	decorators: [withEditorialFrame],
	tags: ['autodocs'],
} satisfies Meta<typeof ArchiveEntry>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: archiveEntries[0],
};

export const Restricted: Story = {
	args: archiveEntries[1],
};
