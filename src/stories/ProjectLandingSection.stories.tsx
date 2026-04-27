import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import ProjectLandingSection from '../components/ProjectLandingSection';
import {
	cyberFarmDispatchesSection,
	grammarAsProtocolSection,
} from '../data/nowPageFixture';

const meta = {
	title: 'Project Landing/Initiative',
	component: ProjectLandingSection,
	parameters: {
		layout: 'padded',
	},
} satisfies Meta<typeof ProjectLandingSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CyberFarmDispatches: Story = {
	args: cyberFarmDispatchesSection,
};

export const GrammarAsProtocol: Story = {
	args: grammarAsProtocolSection,
};
