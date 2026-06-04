// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	site: 'https://docs.sassmaker.com',
	// Fleet web stack standard (VoidZero ecosystem):
	// - Inline per-page stylesheets so the first paint never blocks on an
	//   external CSS request. Starlight ships some shared CSS via a virtual
	//   module; the small per-page chunk still benefits from inlining.
	// - Lightning CSS as the CSS transformer + minifier. Already bundled in
	//   Vite, opt in via `css.transformer` + `build.cssMinify`.
	build: { inlineStylesheets: 'always' },
	vite: {
		css: { transformer: 'lightningcss' },
		build: { cssMinify: 'lightningcss' },
	},
	integrations: [
		starlight({
			title: 'Foundry Manual',
			description: 'The Open Source Foundry for Project Fleets — Standardize, Forge, and Command your repositories.',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/sarthak-fleet/saas-maker' }],
			customCss: ['./src/styles/custom.css'],
			head: [
				{ tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' } },
				{ tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: 'anonymous' } },
				{
					tag: 'link',
					attrs: {
						rel: 'stylesheet',
						href: 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap',
					},
				},
			],
			editLink: {
				baseUrl: 'https://github.com/sarthak-fleet/saas-maker/edit/main/apps/docs/',
			},
			sidebar: [
				{
					label: 'Foundry Core',
					items: [
						{ label: 'Introduction', slug: 'getting-started/introduction' },
						{ label: 'Quickstart', slug: 'getting-started/quickstart' },
						{ label: 'The Standard', slug: 'getting-started/standard' },
						{ label: 'Foundry CLI', slug: 'sdk/cli' },
					],
				},
				{
					label: 'The Blocks',
					items: [
						{ label: 'Integration Overview', slug: 'getting-started/integration' },
						{ label: 'Feedback', slug: 'services/feedback' },
						{ label: 'Roadmap', slug: 'services/roadmap' },
						{ label: 'Testimonials', slug: 'services/testimonials' },
						{ label: 'Changelog', slug: 'services/changelog' },
						{ label: 'Waitlist', slug: 'services/waitlist' },
						{ label: 'Tasks', slug: 'services/tasks' },
						{ label: 'JavaScript SDK', slug: 'sdk/javascript' },
					],
				},
				{
					label: 'The Widgets',
					items: [
						{ label: 'Feedback Widget', slug: 'widgets/feedback' },
						{ label: 'Testimonials Wall', slug: 'widgets/testimonials' },
						{ label: 'Changelog Timeline', slug: 'widgets/changelog' },
						{ label: 'Waitlist Form', slug: 'widgets/waitlist' },
					],
				},
				{
					label: 'Fleet Management',
					items: [
						{ label: 'Projects API', slug: 'services/projects' },
						{ label: 'Tasks', slug: 'services/tasks' },
						{ label: 'Authentication', slug: 'getting-started/authentication' },
						{ label: 'The Standard', slug: 'getting-started/standard' },
					],
				},
				{
					label: 'API Reference',
					autogenerate: { directory: 'api' },
				},
			],
		}),
	],
});
