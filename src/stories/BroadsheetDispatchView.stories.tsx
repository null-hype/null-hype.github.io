import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { BroadsheetDispatchView } from '../components/BroadsheetDispatchView';
import ProjectDigest from '../components/ProjectDigest';
import {
	australianMcpFieldNotesDigest,
	confirmedFindingsDigest,
} from '../data/nowPageFixture';

const dummySlots: any[] = Array.from({ length: 39 }, (_, i) => ({
	id: `TL-${String(i + 1).padStart(3, '0')}`,
	moon: Math.floor(i / 3) + 1,
	phase: ['waxing', 'full', 'waning'][i % 3],
	status: ['pool', 'sea', 'rain'][Math.floor(Math.random() * 3)],
	label: `Agent Slot ${i + 1}`,
}));

const dispatchesData = [
	{
		title: 'Australian MCP Field Notes',
		body: 'Public dispatches on the emerging Australian MCP and agentic infrastructure scene, derived from LinkedIn reconnaissance.',
		href: '#',
		latestUpdate: 'I spent two weeks mapping the scene — who is building, who is hiring...',
	},
	{
		title: 'Broadsheet',
		body: 'Article publishing pipeline — steganography content engine, article-from-linear skill, and editorial production.',
		href: '#',
		latestUpdate: 'Write: "Grammar as Protocol" (In Progress)',
	},
	{
		title: 'Six Domains, One Stack',
		body: 'The Grammar as Protocol thesis applied across six domains — SAT math, German grammar, music theory, security scanning, operational scheduling, and argumentation.',
		href: '#',
		latestUpdate: 'Grammars are compiled expertise. An expensive model writes the rules once.',
	},
];

const platformsData = [
	{
		title: 'Empire State',
		body: 'Swipe-based human-in-the-loop decision surface for autonomous agents. Tinder for agent plans.',
		href: '#',
	},
	{
		title: 'Falada',
		body: 'The headless agentic video editor. Mobile-first control of remote high-performance render hardware.',
		href: '#',
	},
	{
		title: 'BountyBench',
		body: 'The Dagger calibration harness. Isolate environment setup from security reasoning.',
		href: '#',
	},
	{
		title: 'Jules × Render',
		body: 'Autonomous fix loop plumbing proof. Jules GH App fixes failing tests via Dagger pipe.',
		href: '#',
	},
];

const meta = {
	title: 'Broadsheet/Views/Dispatch View (Home)',
	component: BroadsheetDispatchView,
	parameters: {
		layout: 'fullscreen',
	},
	tags: ['autodocs'],
} satisfies Meta<typeof BroadsheetDispatchView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		fleetSlots: dummySlots,
		children: (
			<>
				<section className="broadsheet-dispatch-col">
					<h2 className="dispatch-col-title">DISPATCHES</h2>
					<div className="dispatch-list">
						{dispatchesData.map((d) => (
							<ProjectDigest key={d.title} {...d} />
						))}
					</div>
				</section>

				<section className="broadsheet-dispatch-col">
					<h2 className="dispatch-col-title">PLATFORMS</h2>
					<div className="platform-list">
						{platformsData.map((p) => (
							<ProjectDigest key={p.title} {...p} />
						))}
					</div>
				</section>
			</>
		),
	},
};
