import React from 'react';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';

import TidelaneList from '../../components/TidelaneList';
import { mockNowPageData } from '../../data/nowPageFixture';
import '../../styles/now-page.css';

const withNowFrame: Decorator = (Story) => (
	<div className="now-page">
		<div className="now-shell now-main">
			<Story />
		</div>
	</div>
);

const meta = {
	title: 'Editorial/TidelaneList',
	component: TidelaneList,
	parameters: { layout: 'fullscreen' },
	decorators: [withNowFrame],
	tags: ['autodocs'],
} satisfies Meta<typeof TidelaneList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FullBoard: Story = {
	args: {
		sections: mockNowPageData.sections,
	},
};

export const CurrentLaneOnly: Story = {
	args: {
		sections: mockNowPageData.sections.slice(0, 1),
	},
};

export const DeferredWork: Story = {
	args: {
		sections: mockNowPageData.sections.slice(2),
	},
};
