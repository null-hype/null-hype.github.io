import React from 'react';

export interface CounterargumentPanelProps {
	readonly title?: string;
	readonly body: string;
}

export default function CounterargumentPanel({
	title = 'Red Team Counterargument',
	body,
}: Readonly<CounterargumentPanelProps>) {
	return (
		<aside className="counterargument-panel">
			<span className="counterargument-panel__title component-eyebrow">{title}</span>
			<p className="counterargument-panel__body">{body}</p>
		</aside>
	);
}
