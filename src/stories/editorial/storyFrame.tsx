import React from 'react';
import type { Decorator } from '@storybook/react-vite';

export const withEditorialFrame: Decorator = (Story) => (
	<div className="story-frame">
		<Story />
	</div>
);
