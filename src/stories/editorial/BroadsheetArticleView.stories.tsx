import type { Meta, StoryObj } from '@storybook/react-vite';

import BroadsheetArticleView from '../../components/BroadsheetArticleView';
import { broadsheetArticleViewContent } from '../../data/broadsheetContent';

const meta = {
	title: 'Editorial/BroadsheetArticleView',
	component: BroadsheetArticleView,
	parameters: { layout: 'fullscreen' },
	tags: ['autodocs'],
} satisfies Meta<typeof BroadsheetArticleView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: broadsheetArticleViewContent,
};
