import type { Meta, StoryObj } from '@storybook/react-vite';

import BroadsheetArchiveEntry from '../../components/BroadsheetArchiveEntry';
import { broadsheetArchiveEntries } from '../../data/broadsheetContent';
import { withEditorialFrame } from './storyFrame';

const meta = {
	title: 'Editorial/BroadsheetArchiveEntry',
	component: BroadsheetArchiveEntry,
	parameters: { layout: 'fullscreen' },
	decorators: [withEditorialFrame],
	tags: ['autodocs'],
} satisfies Meta<typeof BroadsheetArchiveEntry>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Standard: Story = {
	args: broadsheetArchiveEntries[0],
};

export const Tall: Story = {
	args: broadsheetArchiveEntries[1],
};

export const LockedWide: Story = {
	args: broadsheetArchiveEntries[6],
};
