import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tutorialkit from '@tutorialkit/astro';

export default defineConfig({
  base: '/scaffold-test/',
  integrations: [react(), tutorialkit()]
});
