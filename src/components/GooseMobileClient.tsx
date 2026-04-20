import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAcpClient, type NotificationEvent } from 'use-acp';
import './GooseMobileClient.css';

type PermissionOption = {
	kind: string;
	name: string;
	optionId: string;
};

type PermissionPrompt = {
	options: PermissionOption[];
	toolCall?: {
		title?: string;
		toolCallId?: string;
	};
};

type GooseSessionResponse = {
	cwd: string;
	sessionId: string;
	status: string;
	wsUrl: string;
};

type GooseMobileClientViewProps = {
	activeSessionId: string | null;
	bootstrapState: 'idle' | 'initializing' | 'ready' | 'error';
	canCreateSession: boolean;
	canSendPrompt: boolean;
	connectionStatus: string;
	cwd: string;
	errorMessage?: string;
	isBusy: boolean;
	notifications: NotificationEvent[];
	onDisconnect: () => void;
	onPromptChange: (value: string) => void;
	onResolvePermission: (optionId: string) => void;
	onSendPrompt: () => void;
	onCancelPermission: () => void;
	onStartChat: () => void;
	pendingPermission: PermissionPrompt | null;
	prompt: string;
	title?: string;
	wsUrl: string;
};

export type GooseMobileClientProps = {
	autoConnect?: boolean;
	cwd?: string;
	initialWsUrl?: string;
	sessionApiUrl?: string;
	title?: string;
};

type TerminalMessage = {
	role: string;
	text: string;
};

function getContentText(content: unknown) {
	if (!content || typeof content !== 'object') {
		return '';
	}

	const record = content as Record<string, unknown>;

	return typeof record.text === 'string' ? record.text : '';
}

function describeNotification(notification: NotificationEvent) {
	if (notification.type === 'connection_change') {
		return null;
	}

	if (notification.type === 'error') {
		return {
			role: 'system',
			text: notification.data.message,
		};
	}

	const update = notification.data.update as Record<string, unknown>;
	const sessionUpdate = String(update.sessionUpdate ?? 'update');

	if (
		sessionUpdate === 'agent_message_chunk' ||
		sessionUpdate === 'user_message_chunk'
	) {
		return {
			role: sessionUpdate === 'user_message_chunk' ? 'user' : 'assistant',
			text: getContentText(update.content),
		};
	}

	return null;
}

function buildTerminalMessages(notifications: NotificationEvent[]) {
	const messages: TerminalMessage[] = [];

	for (const notification of notifications) {
		const message = describeNotification(notification);

		if (!message?.text) {
			continue;
		}

		const previous = messages.at(-1);

		if (previous?.role === message.role) {
			previous.text += message.text;
			continue;
		}

		messages.push(message);
	}

	return messages;
}

function isAbsoluteHttpUrl(value: string) {
	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch (_error) {
		return false;
	}
}

function resolveSessionWebSocketUrl(wsUrl: string, sessionApiUrl: string) {
	if (typeof window === 'undefined') {
		return wsUrl;
	}

	try {
		const baseUrl = isAbsoluteHttpUrl(sessionApiUrl) ? sessionApiUrl : window.location.href;
		const url = new URL(wsUrl, baseUrl);

		if (url.protocol === 'http:') {
			url.protocol = 'ws:';
		}

		if (url.protocol === 'https:') {
			url.protocol = 'wss:';
		}

		return url.toString();
	} catch (_error) {
		return wsUrl;
	}
}

export function GooseMobileClientView({
	activeSessionId,
	bootstrapState,
	canSendPrompt,
	connectionStatus,
	errorMessage,
	isBusy,
	notifications,
	onCancelPermission,
	onDisconnect,
	onPromptChange,
	onResolvePermission,
	onSendPrompt,
	onStartChat,
	pendingPermission,
	prompt,
	wsUrl,
}: GooseMobileClientViewProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const messages = buildTerminalMessages(notifications);
	const isConnecting = connectionStatus === 'connecting';
	const isReady =
		Boolean(activeSessionId) && bootstrapState === 'ready' && connectionStatus === 'connected';

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	const submitPrompt = () => {
		if (prompt.trim()) {
			onSendPrompt();
			return;
		}

		if (!isBusy && !isConnecting && connectionStatus !== 'connected') {
			onStartChat();
		}
	};

	return (
		<section
			className="goose-mobile-shell"
			aria-busy={isBusy || isConnecting}
			aria-label="Goose terminal"
			data-can-send={canSendPrompt ? 'true' : 'false'}
			data-connection-status={connectionStatus}
			data-has-ws-url={wsUrl ? 'true' : 'false'}
			data-session-ready={isReady ? 'true' : 'false'}
			onClick={() => inputRef.current?.focus()}
		>
			{pendingPermission ? (
				<section className="goose-mobile-permission" aria-label="Permission request">
					<p>permission: {pendingPermission.toolCall?.title || 'tool request'}</p>
					<div className="goose-mobile-permission-actions">
						{pendingPermission.options.map((option) => (
							<button
								key={option.optionId}
								type="button"
								onClick={() => onResolvePermission(option.optionId)}
							>
								{option.name}
							</button>
						))}
						<button type="button" onClick={onCancelPermission}>
							Cancel
						</button>
					</div>
				</section>
			) : null}

			<form
				className="goose-mobile-terminal"
				onSubmit={(event) => {
					event.preventDefault();
					submitPrompt();
				}}
			>
				<ol className="goose-mobile-terminal-lines" aria-label="Terminal transcript">
					{messages.map((message, index) => (
						<li
							key={`${message.role}-${message.text}-${index}`}
							className={`goose-mobile-terminal-line goose-mobile-terminal-line-${message.role}`}
						>
							{message.text}
						</li>
					))}
					{errorMessage ? (
						<li className="goose-mobile-terminal-line goose-mobile-terminal-line-system" role="alert">
							error: {errorMessage}
						</li>
					) : null}
					<li className="goose-mobile-terminal-input-line">
						<span className="goose-mobile-terminal-command">{prompt}</span>
						<span className="goose-mobile-block-cursor" aria-hidden="true" />
					</li>
				</ol>
				<label className="goose-mobile-sr-only" htmlFor="goose-mobile-prompt">
					Terminal input
				</label>
				<input
					ref={inputRef}
					id="goose-mobile-prompt"
					className="goose-mobile-terminal-input"
					value={prompt}
					onChange={(event) => onPromptChange(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === 'Enter') {
							event.preventDefault();
							submitPrompt();
						}
					}}
					autoComplete="off"
					autoCapitalize="none"
					spellCheck={false}
					aria-label="Terminal input"
				/>
				<button className="goose-mobile-sr-only" type="submit">
					Send
				</button>
				<button
					className="goose-mobile-sr-only"
					type="button"
					onClick={onDisconnect}
					disabled={connectionStatus !== 'connected'}
				>
					Disconnect
				</button>
			</form>
		</section>
	);
}

export default function GooseMobileClient({
	autoConnect = true,
	cwd,
	initialWsUrl = '',
	sessionApiUrl = '/api/goose-sessions',
	title,
}: GooseMobileClientProps) {
	const [wsUrl, setWsUrl] = useState(initialWsUrl);
	const [sessionCwd, setSessionCwd] = useState(cwd ?? '/');
	const [prompt, setPrompt] = useState('');
	const [isBusy, setIsBusy] = useState(false);
	const [bootstrapState, setBootstrapState] = useState<
		'idle' | 'initializing' | 'ready' | 'error'
	>('idle');
	const [errorMessage, setErrorMessage] = useState<string>();
	const bootstrapping = useRef(false);
	const connectAfterSession = useRef(false);
	const autoStarted = useRef(false);
	const queuedSubmit = useRef(false);
	const hookUrl = wsUrl || 'ws://127.0.0.1/__missing_acp_ws__';
	const {
		activeSessionId,
		agent,
		connect,
		connectionState,
		disconnect,
		notifications,
		pendingPermission,
		resolvePermission,
	} = useAcpClient({
		autoConnect: false,
		clientOptions: {
			readTextFile: async () => ({ content: '' }),
			writeTextFile: async () => ({}),
		},
		wsUrl: hookUrl,
	});
	const canCreateSession = Boolean(sessionApiUrl);
	const canSendPrompt = Boolean(
		agent && activeSessionId && prompt.trim() && connectionState.status === 'connected',
	);

	useEffect(() => {
		if (
			!agent ||
			activeSessionId ||
			bootstrapping.current ||
			connectionState.status !== 'connected'
		) {
			return;
		}

		bootstrapping.current = true;
		setBootstrapState('initializing');
		setErrorMessage(undefined);

		void (async () => {
			await agent.initialize({
				clientCapabilities: {
					fs: {
						readTextFile: false,
						writeTextFile: false,
					},
					terminal: false,
				},
				protocolVersion: 1,
			});
			await agent.newSession({
				cwd: sessionCwd,
				mcpServers: [],
			});
			setBootstrapState('ready');
		})()
			.catch((error: unknown) => {
				setBootstrapState('error');
				setErrorMessage(error instanceof Error ? error.message : String(error));
			})
			.finally(() => {
				bootstrapping.current = false;
			});
	}, [activeSessionId, agent, connectionState.status, sessionCwd]);

	useEffect(() => {
		if (!connectAfterSession.current || !wsUrl || connectionState.status !== 'disconnected') {
			return;
		}

		connectAfterSession.current = false;
		void connect().catch((error: unknown) => {
			setErrorMessage(error instanceof Error ? error.message : String(error));
		});
	}, [connect, connectionState.status, wsUrl]);

	const createSession = async () => {
		setIsBusy(true);
		setErrorMessage(undefined);

		try {
			const response = await fetch(sessionApiUrl, {
				body: JSON.stringify({}),
				headers: {
					'content-type': 'application/json',
				},
				method: 'POST',
			});

			if (!response.ok) {
				throw new Error(`Session API returned ${response.status}`);
			}

			const body = (await response.json()) as GooseSessionResponse;
			setWsUrl(resolveSessionWebSocketUrl(body.wsUrl, sessionApiUrl));
			setSessionCwd(cwd ?? body.cwd);
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : String(error));
		} finally {
			setIsBusy(false);
		}
	};

	const sendPrompt = async () => {
		if (!agent || !activeSessionId || !prompt.trim()) {
			return;
		}

		const text = prompt.trim();
		setPrompt('');
		setIsBusy(true);

		try {
			await agent.prompt({
				prompt: [
					{
						text,
						type: 'text',
					},
				],
				sessionId: activeSessionId,
			});
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : String(error));
		} finally {
			setIsBusy(false);
		}
	};

	const startChat = () => {
		setErrorMessage(undefined);

		if (!wsUrl) {
			connectAfterSession.current = true;
			void createSession();
			return;
		}

		void connect().catch((error: unknown) => {
			setErrorMessage(error instanceof Error ? error.message : String(error));
		});
	};

	const requestSendPrompt = () => {
		if (!prompt.trim()) {
			return;
		}

		if (canSendPrompt) {
			void sendPrompt();
			return;
		}

		queuedSubmit.current = true;

		if (connectionState.status !== 'connected' && !isBusy) {
			startChat();
		}
	};

	useEffect(() => {
		if (!queuedSubmit.current || !canSendPrompt) {
			return;
		}

		queuedSubmit.current = false;
		void sendPrompt();
	}, [canSendPrompt, sendPrompt]);

	useEffect(() => {
		if (!autoConnect || autoStarted.current) {
			return;
		}

		if (!wsUrl || connectionState.status === 'disconnected') {
			autoStarted.current = true;
			startChat();
		}
	}, [autoConnect, connectionState.status, startChat, wsUrl]);

	const pendingPermissionView = useMemo<PermissionPrompt | null>(() => {
		if (!pendingPermission) {
			return null;
		}

		return {
			options: pendingPermission.options,
			toolCall: {
				title: pendingPermission.toolCall.title ?? undefined,
				toolCallId: pendingPermission.toolCall.toolCallId,
			},
		};
	}, [pendingPermission]);

	return (
		<GooseMobileClientView
			activeSessionId={activeSessionId}
			bootstrapState={bootstrapState}
			canCreateSession={canCreateSession}
			canSendPrompt={canSendPrompt}
			connectionStatus={connectionState.status}
			cwd={sessionCwd}
			errorMessage={errorMessage || connectionState.error}
			isBusy={isBusy}
			notifications={notifications}
			onCancelPermission={() => {
				resolvePermission({ outcome: { outcome: 'cancelled' } });
			}}
			onDisconnect={disconnect}
			onPromptChange={setPrompt}
			onResolvePermission={(optionId) => {
				resolvePermission({ outcome: { optionId, outcome: 'selected' } });
			}}
			onSendPrompt={requestSendPrompt}
			onStartChat={startChat}
			pendingPermission={pendingPermissionView}
			prompt={prompt}
			title={title}
			wsUrl={wsUrl}
		/>
	);
}
