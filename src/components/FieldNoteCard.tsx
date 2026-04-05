import React from 'react';

export interface FieldNoteCardProps {
	readonly title: string;
	readonly body: string;
	readonly reference: string;
	readonly tone?: 'default' | 'accent';
}

export default function FieldNoteCard({
	title,
	body,
	reference,
	tone = 'default',
}: Readonly<FieldNoteCardProps>) {
	return (
		<aside className="field-note-card" data-tone={tone}>
			<h3 className="field-note-card__title">{title}</h3>
			<p className="field-note-card__body">{body}</p>
			<p className="field-note-card__reference">{reference}</p>
		</aside>
	);
}
