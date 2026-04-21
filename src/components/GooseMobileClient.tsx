import {
	ClientSideConnection,
	type Agent,
	type AgentCapabilities,
	type Client,
	type RequestPermissionRequest,
	type RequestPermissionResponse,
	type SessionNotification,
	type Stream,
} from '@agentclientprotocol/sdk';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './GooseMobileClient.css';
import GoosePromptEditor from './GoosePromptEditor';

type ConnectionState = {
	error?: string;
	status: 'disconnected' | 'connecting' | 'connected' | 'error';
	url?: string;
};

type NotificationEvent = {
	id: string;
	timestamp: number;
} & (
	| {
			data: SessionNotification;
			type: 'session_notification';
	  }
	| {
			data: ConnectionState;
			type: 'connection_change';
	  }
	| {
			data: Error;
			type: 'error';
	  }
);

type PendingPermission = RequestPermissionRequest & {
	deferredId: string;
};

type PendingPermissionResolver = {
	reject: (error: Error) => void;
	resolve: (response: RequestPermissionResponse) => void;
};

type TextAcpClientOptions = {
	autoConnect?: boolean;
	clientOptions?: Partial<Client>;
	wsUrl: string;
};

type TextAcpClientReturn = {
	activeSessionId: string | null;
	agent: Agent | null;
	agentCapabilities: AgentCapabilities | null;
	clearNotifications: () => void;
	connect: () => Promise<void>;
	connectionState: ConnectionState;
	disconnect: () => void;
	isSessionLoading: boolean;
	notifications: NotificationEvent[];
	pendingPermission: PendingPermission | null;
	rejectPermission: (error: Error) => void;
	resolvePermission: (response: RequestPermissionResponse) => void;
};

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
	promptHintMode?: 'mock-goose' | 'off';
	title?: string;
	wsUrl: string;
};

export type GooseMobileClientProps = {
	autoConnect?: boolean;
	cwd?: string;
	initialWsUrl?: string;
	promptHintMode?: 'mock-goose' | 'off';
	sessionApiUrl?: string;
	title?: string;
};

type TerminalMessage = {
	role: string;
	text: string;
};

function getErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}

	if (error && typeof error === 'object') {
		const record = error as Record<string, unknown>;
		const code = typeof record.code === 'number' ? ` ${record.code}` : '';
		const message = typeof record.message === 'string' ? record.message : undefined;

		if (message) {
			return `ACP error${code}: ${message}`;
		}
	}

	return String(error);
}

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
		const sessionApiIsAbsolute = isAbsoluteHttpUrl(sessionApiUrl);
		const baseUrl = sessionApiIsAbsolute ? sessionApiUrl : window.location.href;
		const url = new URL(wsUrl, baseUrl);

		if (!sessionApiIsAbsolute) {
			const browserUrl = new URL(`${url.pathname}${url.search}${url.hash}`, window.location.href);
			browserUrl.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
			return browserUrl.toString();
		}

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

async function websocketDataToText(data: MessageEvent['data']) {
	if (typeof data === 'string') {
		return data;
	}

	if (data instanceof ArrayBuffer) {
		return new TextDecoder().decode(data);
	}

	if (data instanceof Blob) {
		return data.text();
	}

	return String(data);
}

function createTextWebSocketStream(socket: WebSocket): Stream {
	let bufferedText = '';

	const readable = new ReadableStream({
		start(controller) {
			socket.addEventListener('message', (event) => {
				void (async () => {
					const text = await websocketDataToText(event.data);
					bufferedText += text.endsWith('\n') ? text : `${text}\n`;
					const lines = bufferedText.split('\n');
					bufferedText = lines.pop() ?? '';

					for (const line of lines) {
						const trimmed = line.trim();

						if (!trimmed) {
							continue;
						}

						controller.enqueue(JSON.parse(trimmed));
					}
				})().catch((error: unknown) => {
					controller.error(error);
				});
			});

			socket.addEventListener('close', () => {
				controller.close();
			});

			socket.addEventListener('error', () => {
				controller.error(new Error('WebSocket connection error'));
			});
		},
	}) as Stream['readable'];

	const writable = new WritableStream({
		write(message) {
			if (socket.readyState === WebSocket.OPEN) {
				socket.send(JSON.stringify(message));
			}
		},
		close() {
			socket.close();
		},
		abort() {
			socket.close();
		},
	}) as Stream['writable'];

	return { readable, writable };
}

function useTextAcpClient({
	autoConnect = true,
	clientOptions = {},
	wsUrl,
}: TextAcpClientOptions): TextAcpClientReturn {
	const [connectionState, setConnectionState] = useState<ConnectionState>({ status: 'disconnected' });
	const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
	const [agent, setAgent] = useState<Agent | null>(null);
	const [agentCapabilities, setAgentCapabilities] = useState<AgentCapabilities | null>(null);
	const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
	const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null);
	const socketRef = useRef<WebSocket | null>(null);
	const pendingPermissionResolvers = useRef(new Map<string, PendingPermissionResolver>());

	const addNotification = useCallback((notification: Omit<NotificationEvent, 'id' | 'timestamp'>) => {
		setNotifications((current) => [
			...current,
			{
				...notification,
				id: `${Date.now()}-${Math.random()}`,
				timestamp: Date.now(),
			} as NotificationEvent,
		]);
	}, []);

	const clearNotifications = useCallback(() => {
		setNotifications([]);
	}, []);

	const disconnect = useCallback(() => {
		socketRef.current?.close();
		socketRef.current = null;
		pendingPermissionResolvers.current.clear();
		setActiveSessionId(null);
		setAgent(null);
		setAgentCapabilities(null);
		setPendingPermission(null);
		setConnectionState({ status: 'disconnected' });
	}, []);

	const resolvePermission = useCallback((response: RequestPermissionResponse) => {
		if (!pendingPermission) {
			return;
		}

		const resolver = pendingPermissionResolvers.current.get(pendingPermission.deferredId);
		pendingPermissionResolvers.current.delete(pendingPermission.deferredId);
		setPendingPermission(null);
		resolver?.resolve(response);
	}, [pendingPermission]);

	const rejectPermission = useCallback((error: Error) => {
		if (!pendingPermission) {
			return;
		}

		const resolver = pendingPermissionResolvers.current.get(pendingPermission.deferredId);
		pendingPermissionResolvers.current.delete(pendingPermission.deferredId);
		setPendingPermission(null);
		resolver?.reject(error);
	}, [pendingPermission]);

	const connect = useCallback(async () => {
		if (!wsUrl) {
			throw new Error('Missing ACP WebSocket URL');
		}

		if (socketRef.current?.readyState === WebSocket.OPEN) {
			return;
		}

		setConnectionState({ status: 'connecting', url: wsUrl });

		const socket = new WebSocket(wsUrl);
		socketRef.current = socket;

		await new Promise<void>((resolve, reject) => {
			socket.addEventListener('open', () => {
				setConnectionState({ status: 'connected', url: wsUrl });
				resolve();
			}, { once: true });

			socket.addEventListener('error', () => {
				const error = new Error('WebSocket connection error');
				setConnectionState({ error: error.message, status: 'error', url: wsUrl });
				reject(error);
			}, { once: true });
		});

		socket.addEventListener('close', () => {
			if (socketRef.current === socket) {
				socketRef.current = null;
				setConnectionState({ status: 'disconnected', url: wsUrl });
			}
		});

		const baseAgent = new ClientSideConnection((): Client => ({
			...clientOptions,
			readTextFile: async (params) => clientOptions.readTextFile?.(params) ?? { content: '' },
			requestPermission: (params) => {
				const deferredId = `${Date.now()}-${Math.random()}`;

				return new Promise<RequestPermissionResponse>((resolve, reject) => {
					pendingPermissionResolvers.current.set(deferredId, { reject, resolve });
					setPendingPermission({ ...params, deferredId });
				});
			},
			sessionUpdate: async (params) => {
				await clientOptions.sessionUpdate?.(params);
				addNotification({ data: params, type: 'session_notification' });
			},
			writeTextFile: async (params) => clientOptions.writeTextFile?.(params) ?? {},
		}), createTextWebSocketStream(socket));

		const listeningAgent: Agent = {
			...baseAgent,
			initialize: async (params) => {
				const response = await baseAgent.initialize(params);
				setAgentCapabilities(response.agentCapabilities);
				return response;
			},
			newSession: async (params) => {
				const response = await baseAgent.newSession(params);
				setActiveSessionId(response.sessionId);
				return response;
			},
			prompt: async (params) => {
				for (const prompt of params.prompt) {
					addNotification({
						data: {
							sessionId: params.sessionId,
							update: {
								content: prompt,
								sessionUpdate: 'user_message_chunk',
							},
						},
						type: 'session_notification',
					});
				}

				return baseAgent.prompt(params);
			},
		};

		setAgent(listeningAgent);
	}, [addNotification, clientOptions, wsUrl]);

	useEffect(() => {
		if (!autoConnect) {
			return undefined;
		}

		void connect();

		return disconnect;
	}, [autoConnect, connect, disconnect]);

	return {
		activeSessionId,
		agent,
		agentCapabilities,
		clearNotifications,
		connect,
		connectionState,
		disconnect,
		isSessionLoading: false,
		notifications,
		pendingPermission,
		rejectPermission,
		resolvePermission,
	};
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
	promptHintMode = 'mock-goose',
	wsUrl,
}: GooseMobileClientViewProps) {
	const messages = buildTerminalMessages(notifications);
	const isConnecting = connectionStatus === 'connecting';
	const isReady =
		Boolean(activeSessionId) && bootstrapState === 'ready' && connectionStatus === 'connected';

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
							data-message-role={message.role}
						>
							{message.text}
						</li>
					))}
					{errorMessage ? (
						<li className="goose-mobile-terminal-line goose-mobile-terminal-line-system" role="alert">
							error: {errorMessage}
						</li>
					) : null}
				</ol>
				<GoosePromptEditor
					ariaLabel="Goose prompt editor"
					disabled={isBusy || isConnecting}
					hintMode={promptHintMode}
					value={prompt}
					onChange={onPromptChange}
					onSubmit={submitPrompt}
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
	promptHintMode = 'mock-goose',
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
	} = useTextAcpClient({
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
			bootstrapState !== 'idle' ||
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

			if (!activeSessionId) {
				await agent.newSession({
					cwd: sessionCwd,
					mcpServers: [],
				});
			}

			setBootstrapState('ready');
		})()
			.catch((error: unknown) => {
				setBootstrapState('error');
				setErrorMessage(getErrorMessage(error));
			})
			.finally(() => {
				bootstrapping.current = false;
			});
	}, [activeSessionId, agent, bootstrapState, connectionState.status, sessionCwd]);

	useEffect(() => {
		if (!connectAfterSession.current || !wsUrl || connectionState.status !== 'disconnected') {
			return;
		}

		connectAfterSession.current = false;
		void connect().catch((error: unknown) => {
			setErrorMessage(getErrorMessage(error));
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
			setErrorMessage(getErrorMessage(error));
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
			setErrorMessage(getErrorMessage(error));
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
			setErrorMessage(getErrorMessage(error));
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
			promptHintMode={promptHintMode}
			title={title}
			wsUrl={wsUrl}
		/>
	);
}
