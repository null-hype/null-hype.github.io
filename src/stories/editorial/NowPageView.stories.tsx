import type { Meta, StoryObj } from '@storybook/react-vite';

import NowPageView from '../../components/NowPageView';
import { mockNowPageData, mockUnavailableNowPageData } from '../../data/nowPageFixture';
import '../../styles/now-page.css';

const meta = {
	title: 'Editorial/NowPageView',
	component: NowPageView,
	parameters: { layout: 'fullscreen' },
	tags: ['autodocs'],
} satisfies Meta<typeof NowPageView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LinearSnapshot: Story = {
	args: {
		meta: mockNowPageData.meta,
		sections: mockNowPageData.sections,
	},
};

export const LinearUnavailable: Story = {
	args: {
		meta: mockUnavailableNowPageData.meta,
		sections: mockUnavailableNowPageData.sections,
		warning:
			'Linear data is unavailable for this build. Confirm LINEAR_API_KEY and outbound access to api.linear.app.',
	},
};
