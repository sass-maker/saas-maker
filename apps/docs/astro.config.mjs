// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	site: 'https://docs.sassmaker.com',
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
						{ label: 'Integration Overview', slug: 'getting-started/integration' },
						{ label: 'Analytics', slug: 'services/analytics' },
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
						{ label: 'Analytics UI', slug: 'widgets/analytics' },
						{ label: 'Made-With Badge', slug: 'widgets/badge' },
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
