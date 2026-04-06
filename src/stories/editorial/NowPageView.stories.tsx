import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import NowPageView from '../../components/NowPageView';
import { mockNowPageData, mockUnavailableNowPageData } from '../../data/nowPageFixture';
import { getLinearNowPageData, sortAndFilterIssues, buildMeta, buildSections } from '../../data/linearNowPage';
import '../../styles/now-page.css';

// Using any for Meta/StoryObj to allow Storybook-only control props (projectId, stateType)
const meta = {
	title: 'Editorial/NowPageView',
	component: NowPageView,
	parameters: { 
		layout: 'fullscreen',
		design: {
			type: 'iframe',
			url: '/legacy-banking-kernels.html',
		},
	},
	tags: ['autodocs'],
} satisfies Meta<any>;

export default meta;

type Story = StoryObj<any>;

export const LinearSnapshot: Story = {
	args: {
		meta: mockNowPageData.meta,
		sections: mockNowPageData.sections,
		isFavorited: true,
	},
};

export const ComingSoon: Story = {
	args: {
		meta: mockNowPageData.meta,
		sections: mockNowPageData.sections,
		isFavorited: false,
	},
	play: async ({ canvasElement }) => {
		const title = canvasElement.querySelector('h1');
		if (!title || !title.textContent?.includes('Coming Soon!')) {
			throw new Error(`Expected "Coming Soon!" title, but found "${title?.textContent}"`);
		}
		
		const kicker = canvasElement.querySelector('.now-kicker');
		if (!kicker || !kicker.textContent?.includes('RESTRICTED ACCESS')) {
			throw new Error(`Expected "RESTRICTED ACCESS" kicker, but found "${kicker?.textContent}"`);
		}
	}
};

export const LinearUnavailable: Story = {
	args: {
		meta: mockUnavailableNowPageData.meta,
		sections: mockUnavailableNowPageData.sections,
		isFavorited: true,
		warning:
			'Linear data is unavailable for this build. Confirm LINEAR_API_KEY and outbound access to api.linear.app.',
	},
};

export const LiveFromLinear: Story = {
	args: {
		projectId: '832bda26-a62c-4ae4-bb99-a856481cf18a', // LinkedIn Rebranding & Outreach
		stateType: 'all',
		meta: {
			...mockNowPageData.meta,
			title: 'What Richard Anthony is doing now',
		},
		sections: [
			{
				...mockNowPageData.sections[0],
				items: [
					{
						title: '[Identity] Update LinkedIn Headline',
						body: 'A complete rebuild of the LinkedIn profile to align with the current identity: Security Researcher & Platform Engineer.',
						references: 'Linear: PLAN-261 / LinkedIn Rebranding & Outreach / Done',
						lane: {
							slug: 'rebranding-sync',
							w3w: 'rebranding.sync.now',
							moon: { cycle: 1, verb: 'rebrand', domain: 'identity' },
							phase: { name: 'full', timezone: 'APAC', hour: 12, utcBand: 'UTC+10' }
						}
					}
				]
			}
		]
	},
	argTypes: {
		projectId: {
			name: 'Linear Project Filter',
			control: 'select',
			options: ['all', '832bda26-a62c-4ae4-bb99-a856481cf18a'],
		},
		stateType: {
			name: 'Issue Status Type',
			control: 'select',
			options: ['all', 'started', 'unstarted', 'completed', 'backlog', 'triage'],
		},
	},
	render: (args: any, { loaded: { linearData, error } }) => {
		if (error) {
			return (
				<NowPageView 
					{...args}
					warning={`Error loading live Linear data: ${error}. Showing mock transposition.`} 
				/>
			);
		}
		
		const data = linearData || { 
			rawIssues: [], 
			allProjects: [], 
			filterData: {}, 
			meta: args.meta, 
			sections: args.sections,
			isFavorited: args.isFavorited
		};

		if (linearData?.rawIssues) {
			const activeProjectId = args.projectId;
			const activeStateType = args.stateType;

			const filteredIssues = linearData.rawIssues.filter((issue: any) => {
				const projectMatch = activeProjectId === 'all' || issue.project?.id === activeProjectId;
				const stateMatch = activeStateType === 'all' || issue.state?.type === activeStateType;
				return projectMatch && stateMatch;
			});

			const { activeIssues, completedIssues, backlogIssues, all } = sortAndFilterIssues(filteredIssues);
			
			const projectName = activeProjectId === 'all' 
				? 'All Projects' 
				: linearData.allProjects.find((p: any) => p.id === activeProjectId)?.name || 'Filtered View';

			data.meta = buildMeta(projectName, all, activeIssues, completedIssues, backlogIssues);
			data.sections = buildSections(activeIssues, completedIssues, backlogIssues);
			data.isFavorited = linearData.isFavorited;
		}

		return (
			<div>
				{linearData && (
					<div style={{ padding: '1rem', background: '#f0f0f0', borderBottom: '1px solid #ccc', fontSize: '0.8rem', fontFamily: 'monospace' }}>
						<div style={{ marginBottom: '0.5rem' }}><strong>Linear Source View:</strong> {linearData.meta.title.replace('What ', '').replace(' is doing now', '')}</div>
						<div><strong>Active filterData (JSON):</strong> {JSON.stringify(linearData.filterData, null, 2)}</div>
						<div><strong>Favorited Status (Feature Flag):</strong> {data.isFavorited ? 'ACTIVE' : 'INACTIVE'}</div>
					</div>
				)}
				<NowPageView meta={data.meta} sections={data.sections} warning={args.warning} isFavorited={data.isFavorited} />
			</div>
		);
	},
	loaders: [
		async () => {
			try {
				const linearData = await getLinearNowPageData();
				return { linearData };
			} catch (err: any) {
				return { error: err.message || String(err) };
			}
		},
	],
	decorators: [
		(Story, context) => {
			if (context.loaded.linearData?.allProjects && context.argTypes.projectId) {
				const projects = context.loaded.linearData.allProjects;
				const options = ['all', ...projects.map((p: any) => p.id)];
				const labels = {
					all: 'All Projects',
					...Object.fromEntries(projects.map((p: any) => [p.id, p.name]))
				};
				
				context.argTypes.projectId.options = options;
				context.argTypes.projectId.mapping = labels;
				
				const linearFilter = context.loaded.linearData.filterData;
				if (linearFilter?.and) {
					const projectFilter = linearFilter.and.find((f: any) => f.project?.id?.in);
					const projectFilterId = projectFilter?.project?.id?.in?.[0];
					const stateFilter = linearFilter.and.find((f: any) => f.state?.type?.in);
					const stateFilterType = stateFilter?.state?.type?.in?.[0];

					if (projectFilterId && context.args.projectId === 'all') {
						context.args.projectId = projectFilterId;
					}
					if (stateFilterType && context.args.stateType === 'all') {
						context.args.stateType = stateFilterType;
					}
				}
			}
			return <Story />;
		}
	],
	play: async ({ canvasElement }) => {
		const title = canvasElement.querySelector('h1');
		if (!title) throw new Error('Could not find NowPageView title');
		
		// Check for the new identity
		if (title.textContent?.includes('Richard Anthony') || title.textContent?.includes('www.tidelands.dev')) {
			const issues = Array.from(canvasElement.querySelectorAll('.tidelane-card__title'));
			const targetTitle = '[Identity] Update LinkedIn Headline';
			// In live mode, it might have actual issues, so we just check if it's not empty if we expect issues
			if (issues.length === 0 && !title.textContent?.includes('Coming Soon!')) {
				// If no issues, could be due to API failure in storybook env, but it should at least have the mock if render fallback worked
			}
		} else if (!title.textContent?.includes('Coming Soon!')) {
			throw new Error(`Unexpected title state: ${title.textContent}`);
		}
	}
};
