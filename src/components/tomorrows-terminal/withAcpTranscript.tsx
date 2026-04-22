import type { SessionNotification } from '@agentclientprotocol/sdk';
import type { TranscriptNotification } from './types';

type ConnectionState = {
	error?: string;
	status: 'disconnected' | 'connecting' | 'connected' | 'error';
	url?: string;
};

export type MockNotificationEvent = {
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

function toSessionUpdate(
	notification: TranscriptNotification,
	sessionId: string,
): SessionNotification {
	if (notification.kind === 'tool') {
		return {
			sessionId,
			update: {
				sessionUpdate: 'tool_call',
				status: notification.status ?? 'completed',
				title: notification.title,
				toolCallId: `tool_${notification.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
			},
		};
	}

	return {
		sessionId,
		update: {
			content: {
				text: notification.text,
				type: 'text',
			},
			sessionUpdate:
				notification.kind === 'agent' ? 'agent_message_chunk' : 'user_message_chunk',
		},
	};
}

export function buildMockAcpNotifications({
	notifications,
	sessionId,
	startTime = Date.now(),
}: {
	notifications: TranscriptNotification[];
	sessionId: string;
	startTime?: number;
}): MockNotificationEvent[] {
	return notifications.map((notification, index) => ({
		data: toSessionUpdate(notification, sessionId),
		id: `${sessionId}_${index}`,
		timestamp: startTime + index * 500,
		type: 'session_notification',
	}));
}
