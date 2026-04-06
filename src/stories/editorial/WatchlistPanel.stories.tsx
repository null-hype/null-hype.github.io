import type { Meta, StoryObj } from '@storybook/react-vite';

import WatchlistPanel from '../../components/WatchlistPanel';
import { watchlistContent } from '../../data/editorialContent';
import { withEditorialFrame } from './storyFrame';

const meta = {
	title: 'Editorial/WatchlistPanel',
	component: WatchlistPanel,
	parameters: { layout: 'fullscreen' },
	decorators: [withEditorialFrame],
	tags: ['autodocs'],
} satisfies Meta<typeof WatchlistPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: watchlistContent,
};

export const ShortList: Story = {
	args: {
		...watchlistContent,
		indicators: watchlistContent.indicators.slice(0, 2),
		version: 'Ver: 2028-2030',
	},
};
