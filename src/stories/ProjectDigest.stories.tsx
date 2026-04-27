import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import ProjectDigest from '../components/ProjectDigest';
import {
	australianMcpFieldNotesDigest,
	confirmedFindingsDigest,
} from '../data/nowPageFixture';

const meta = {
	title: 'Project Landing/Project Digest',
	component: ProjectDigest,
	parameters: {
		layout: 'padded',
	},
} satisfies Meta<typeof ProjectDigest>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AustralianMcpFieldNotes: Story = {
	args: {
		title: australianMcpFieldNotesDigest.title,
		body: australianMcpFieldNotesDigest.body,
		href: australianMcpFieldNotesDigest.href,
		latestUpdate: australianMcpFieldNotesDigest.latestUpdate,
	},
};

export const SecurityResearchDispatch: Story = {
	args: {
		title: confirmedFindingsDigest.title,
		body: confirmedFindingsDigest.body,
		href: confirmedFindingsDigest.href,
		latestUpdate: confirmedFindingsDigest.latestUpdate,
	},
};
