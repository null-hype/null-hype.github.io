import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor } from 'storybook/test';
import type { NotificationEvent } from 'use-acp';
import GooseMobileClient, { GooseMobileClientView } from '../components/GooseMobileClient';

const now = Date.now();

const baseNotifications: NotificationEvent[] = [
	{
		data: {
			sessionId: 'sess_story',
			update: {
				content: {
					text: 'List the configured MCP tools.',
					type: 'text',
				},
				sessionUpdate: 'user_message_chunk',
			},
		},
		id: 'evt_user',
		timestamp: now - 4200,
		type: 'session_notification',
	},
	{
		data: {
			sessionId: 'sess_story',
			update: {
				sessionUpdate: 'tool_call',
				status: 'in_progress',
				title: 'Inspect Goose extensions',
				toolCallId: 'tool_story_1',
			},
		},
		id: 'evt_tool',
		timestamp: now - 2600,
		type: 'session_notification',
	},
	{
		data: {
			sessionId: 'sess_story',
			update: {
				content: {
					text: 'Dagger is available through Goose configuration.',
					type: 'text',
				},
				sessionUpdate: 'agent_message_chunk',
			},
		},
		id: 'evt_agent',
		timestamp: now - 900,
		type: 'session_notification',
	},
];

const noopHandlers = {
	onCancelPermission: () => undefined,
	onDisconnect: () => undefined,
	onPromptChange: () => undefined,
	onResolvePermission: () => undefined,
	onSendPrompt: () => undefined,
	onStartChat: () => undefined,
};

const meta = {
	title: 'ACP/Goose Mobile Client',
	component: GooseMobileClientView,
	parameters: {
		layout: 'fullscreen',
	},
} satisfies Meta<typeof GooseMobileClientView>;

export default meta;

type Story = StoryObj<typeof meta>;

function MockGooseBridge() {
	const [activeSessionId, setActiveSessionId] = React.useState<string | null>('sess_mock');
	const [bootstrapState, setBootstrapState] =
		React.useState<'idle' | 'initializing' | 'ready' | 'error'>('ready');
	const [connectionStatus, setConnectionStatus] = React.useState('connected');
	const [notifications, setNotifications] = React.useState<NotificationEvent[]>([]);
	const [prompt, setPrompt] = React.useState('');
	const [wsUrl, setWsUrl] = React.useState('ws://127.0.0.1:6006/acp/ws/goose_mock');
	const canSendPrompt = Boolean(
		activeSessionId && prompt.trim() && connectionStatus === 'connected',
	);

	const sendPrompt = () => {
		const text = prompt.trim();

		if (!text || !activeSessionId) {
			return;
		}

		const timestamp = Date.now();
		setPrompt('');
		setNotifications((current) => [
			...current,
			{
				data: {
					sessionId: activeSessionId,
					update: {
						content: {
							text,
							type: 'text',
						},
						sessionUpdate: 'user_message_chunk',
					},
				},
				id: `mock_user_${timestamp}`,
				timestamp,
				type: 'session_notification',
			},
			{
				data: {
					sessionId: activeSessionId,
					update: {
						content: {
							text: 'P',
							type: 'text',
						},
						sessionUpdate: 'agent_message_chunk',
					},
				},
				id: `mock_agent_${timestamp}`,
				timestamp: timestamp + 1,
				type: 'session_notification',
			},
			{
				data: {
					sessionId: activeSessionId,
					update: {
						content: {
							text: 'ONG',
							type: 'text',
						},
						sessionUpdate: 'agent_message_chunk',
					},
				},
				id: `mock_agent_continued_${timestamp}`,
				timestamp: timestamp + 2,
				type: 'session_notification',
			},
		]);
	};

	return (
		<GooseMobileClientView
			activeSessionId={activeSessionId}
			bootstrapState={bootstrapState}
			canCreateSession={!wsUrl}
			canSendPrompt={canSendPrompt}
			connectionStatus={connectionStatus}
			cwd="/workspaces/null-hype.github.io"
			isBusy={false}
			notifications={notifications}
			onCancelPermission={() => undefined}
			onStartChat={() => {
				setWsUrl('ws://127.0.0.1:6006/acp/ws/goose_mock');
				setConnectionStatus('connected');
				setBootstrapState('ready');
				setActiveSessionId('sess_mock');
			}}
			onDisconnect={() => {
				setConnectionStatus('disconnected');
				setBootstrapState('idle');
				setActiveSessionId(null);
			}}
			onPromptChange={setPrompt}
			onResolvePermission={() => undefined}
			onSendPrompt={sendPrompt}
			pendingPermission={null}
			prompt={prompt}
			title="Goose Mobile"
			wsUrl={wsUrl}
		/>
	);
}

const runBridgeFlow: NonNullable<Story['play']> = async ({ canvas, canvasElement }) => {
	await waitFor(
		() => {
			const terminal = canvasElement.querySelector('[data-session-ready="true"]');
			expect(terminal).toBeTruthy();
		},
		{ timeout: 15_000 },
	);

	const input = canvas.getByLabelText('Terminal input');
	await userEvent.type(input, 'Reply with exactly one word: PONG{Enter}');

	await waitFor(
		() => {
			expect(canvas.getByText('PONG')).toBeTruthy();
		},
		{ timeout: 60_000 },
	);
};

export const MockBridge: Story = {
	args: {
		...noopHandlers,
		activeSessionId: null,
		bootstrapState: 'idle',
		canCreateSession: true,
		canSendPrompt: false,
		connectionStatus: 'disconnected',
		cwd: '/workspaces/null-hype.github.io',
		isBusy: false,
		notifications: [],
		pendingPermission: null,
		prompt: '',
		title: 'Goose Mobile',
		wsUrl: '',
	},
	render: () => <MockGooseBridge />,
	play: runBridgeFlow,
};

export const LiveBridge: Story = {
	args: {
		...noopHandlers,
		activeSessionId: null,
		bootstrapState: 'idle',
		canCreateSession: true,
		canSendPrompt: false,
		connectionStatus: 'disconnected',
		cwd: '/workspaces/null-hype.github.io',
		isBusy: false,
		notifications: [],
		pendingPermission: null,
		prompt: '',
		title: 'Goose Mobile',
		wsUrl: '',
	},
	render: () => (
		<GooseMobileClient
			title="Goose Mobile"
			sessionApiUrl="/api/goose-sessions"
			cwd="/workspaces/null-hype.github.io"
		/>
	),
	play: runBridgeFlow,
};

export const Disconnected: Story = {
	args: {
		...noopHandlers,
		activeSessionId: null,
		bootstrapState: 'idle',
		canCreateSession: true,
		canSendPrompt: false,
		connectionStatus: 'disconnected',
		cwd: '/workspaces/null-hype.github.io',
		isBusy: false,
		notifications: [],
		pendingPermission: null,
		prompt: '',
		title: 'Goose Mobile',
		wsUrl: '',
	},
};

export const ActiveTimeline: Story = {
	args: {
		...noopHandlers,
		activeSessionId: 'sess_story',
		bootstrapState: 'ready',
		canCreateSession: true,
		canSendPrompt: true,
		connectionStatus: 'connected',
		cwd: '/workspaces/null-hype.github.io',
		isBusy: false,
		notifications: baseNotifications,
		pendingPermission: null,
		prompt: 'Summarize the Dagger tool surface.',
		title: 'Goose Mobile',
		wsUrl: 'wss://admin.tidelands.dev/acp/ws/goose_story',
	},
};

export const PermissionRequested: Story = {
	args: {
		...noopHandlers,
		activeSessionId: 'sess_story',
		bootstrapState: 'ready',
		canCreateSession: true,
		canSendPrompt: false,
		connectionStatus: 'connected',
		cwd: '/workspaces/null-hype.github.io',
		isBusy: true,
		notifications: baseNotifications,
		pendingPermission: {
			options: [
				{
					kind: 'allow_once',
					name: 'Allow once',
					optionId: 'allow_once',
				},
				{
					kind: 'reject_once',
					name: 'Reject',
					optionId: 'reject_once',
				},
			],
			toolCall: {
				title: 'Run Dagger workflow',
				toolCallId: 'tool_story_2',
			},
		},
		prompt: '',
		title: 'Goose Mobile',
		wsUrl: 'wss://admin.tidelands.dev/acp/ws/goose_story',
	},
};
