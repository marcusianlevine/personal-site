// @ts-check
import { defineConfig } from 'astro/config';
import icon from 'astro-icon'
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://marcuslevine.com',
  integrations: [sitemap(), icon(), mdx()],
});