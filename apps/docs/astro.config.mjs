// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	site: 'https://docs.foundry.dev',
	integrations: [
		starlight({
			title: 'Foundry Manual',
			description: 'The Open Source Foundry for Project Fleets — Standardize, Forge, and Command your repositories.',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/sarthakagrawal927/saas-maker' }],
			editLink: {
				baseUrl: 'https://github.com/sarthakagrawal927/saas-maker/edit/main/apps/docs/',
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
						{ label: 'AI block', slug: 'services/ai-gateway' },
						{ label: 'Analytics block', slug: 'services/analytics' },
						{ label: 'DB block', slug: 'services/knowledge-base' },
						{ label: 'JavaScript SDK', slug: 'sdk/javascript' },
					],
				},
				{
					label: 'The Widgets',
					items: [
						{ label: 'Feedback & Roadmap', slug: 'widgets/feedback' },
						{ label: 'Testimonials Wall', slug: 'widgets/testimonials' },
						{ label: 'Changelog Timeline', slug: 'widgets/changelog' },
						{ label: 'Survey & Forms', slug: 'widgets/survey' },
						{ label: 'Waitlist Form', slug: 'widgets/waitlist' },
						{ label: 'Analytics UI', slug: 'widgets/analytics' },
					],
				},
				{
					label: 'Fleet Management',
					items: [
						{ label: 'The Cockpit', slug: 'services/projects' },
						{ label: 'Fleet Audit & Fix', slug: 'sdk/cli' },
						{ label: 'Forge Scaffolding', slug: 'sdk/cli' },
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
