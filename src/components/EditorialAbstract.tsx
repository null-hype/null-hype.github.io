import React from 'react';
import './EditorialAbstract.css';

export interface EditorialAbstractProps {
	content: string;
	title?: string;
}

export const EditorialAbstract: React.FC<EditorialAbstractProps> = ({
	content,
	title = 'ABSTRACT',
}) => {
	return (
		<div className="editorial-abstract">
			<div className="editorial-abstract__circle">
				<div className="editorial-abstract__inner">
					<h3 className="editorial-abstract__title">{title}</h3>
					<p className="editorial-abstract__content">{content}</p>
				</div>
			</div>
		</div>
	);
};
