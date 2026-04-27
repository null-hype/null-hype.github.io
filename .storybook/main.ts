import type { StorybookConfig } from '@storybook/react-vite';

const smallwebAdminHost = process.env.STORYBOOK_SMALLWEB_ADMIN_HOST ?? 'admin.tidelands.dev';
const smallwebAdminProxyHeaders = { host: smallwebAdminHost };

const config: StorybookConfig = {
  "stories": [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  "addons": [
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    "@storybook/addon-mcp",
    "@storybook/addon-designs"
  ],
  "staticDirs": ["../.stitch/designs"],
  "framework": "@storybook/react-vite",
  async viteFinal(config) {
    return {
      ...config,
      optimizeDeps: {
        ...config.optimizeDeps,
        include: [
          ...(config.optimizeDeps?.include ?? []),
          '@agentclientprotocol/sdk',
        ],
      },
      plugins: [
        ...(config.plugins ?? []),
        {
          name: 'storybook-astro-content-stub',
          enforce: 'pre' as const,
          resolveId(source: string) {
            if (source === 'astro:content') {
              return '\0virtual:astro-content-stub';
            }
          },
          load(id: string) {
            if (id === '\0virtual:astro-content-stub') {
              return 'export const getCollection = async () => [];\nexport const getEntry = async () => undefined;\n';
            }
          },
        },
      ],
      server: {
        ...config.server,
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
          '/api': {
            target: 'http://localhost:4321',
            changeOrigin: true,
          },
        },
      },
    };
  },
};
export default config;
