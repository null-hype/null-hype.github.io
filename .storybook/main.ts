import type { StorybookConfig } from '@storybook/react-vite';

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
      server: {
        ...config.server,
        proxy: {
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