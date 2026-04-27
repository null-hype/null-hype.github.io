// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

const smallwebAdminHost = process.env.SMALLWEB_ADMIN_HOST ?? 'admin.tidelands.dev';
const smallwebAdminProxyHeaders = { host: smallwebAdminHost };

// https://astro.build/config
export default defineConfig({
	site: process.env.SITE ?? 'https://null-hype.github.io',
	base: process.env.BASE_PATH ?? '/',
	integrations: [react()],
	vite: {
		optimizeDeps: {
			include: ['@agentclientprotocol/sdk'],
		},
		server: {
			proxy: {
				'/api/goose-sessions': {
					target: 'http://127.0.0.1:8080',
					changeOrigin: false,
					headers: smallwebAdminProxyHeaders,
				},
				'/acp/ws': {
					target: 'ws://127.0.0.1:8080',
					changeOrigin: false,
					headers: smallwebAdminProxyHeaders,
					ws: true,
				},
			},
		},
	},
});
