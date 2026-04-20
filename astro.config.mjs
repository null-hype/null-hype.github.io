// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
	site: process.env.SITE ?? 'https://null-hype.github.io',
	base: process.env.BASE_PATH ?? '/',
	integrations: [react()],
	vite: {
		server: {
			proxy: {
				'/api/goose-sessions': {
					target: 'http://127.0.0.1:8080',
					changeOrigin: true,
				},
				'/acp/ws': {
					target: 'ws://127.0.0.1:8080',
					changeOrigin: false,
					ws: true,
				},
			},
		},
	},
});
