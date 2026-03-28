import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'server', // SSR is mandatory for your multi-tenant admin
  adapter: node({
    mode: 'standalone',
  }),
  integrations: [tailwind()],
  security: {
    csp: true, // Now stable in v6; automatically hashes inline scripts
  },
  server: {
    host: true,
    port: 4321
  }
});
