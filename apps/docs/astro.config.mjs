// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	site: 'https://docs.sassmaker.com',
	integrations: [
		starlight({
			title: 'SaaS Maker',
			description: 'Drop-in backend services for SaaS apps — feedback, waitlist, testimonials, changelog, and more.',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/sarthakagrawal927/saas-maker' }],
			editLink: {
				baseUrl: 'https://github.com/sarthakagrawal927/saas-maker/edit/main/apps/docs/',
			},
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Introduction', slug: 'getting-started/introduction' },
						{ label: 'Quickstart', slug: 'getting-started/quickstart' },
						{ label: 'Authentication', slug: 'getting-started/authentication' },
					],
				},
				{
					label: 'Services',
					items: [
						{ label: 'Feedback & Feature Requests', slug: 'services/feedback' },
					{ label: 'Roadmap', slug: 'services/roadmap' },
						{ label: 'Waitlist', slug: 'services/waitlist' },
						{ label: 'Testimonials', slug: 'services/testimonials' },
						{ label: 'Forms & Surveys', slug: 'services/forms' },
						{ label: 'Changelog', slug: 'services/changelog' },
						{ label: 'Knowledge Base (Vector)', slug: 'services/knowledge-base' },
						{ label: 'Analytics', slug: 'services/analytics' },
					],
				},
				{
					label: 'SDK & CLI',
					items: [
						{ label: 'JavaScript SDK', slug: 'sdk/javascript' },
						{ label: 'CLI', slug: 'sdk/cli' },
					],
				},
				{
					label: 'Widgets',
					items: [
						{ label: 'Feedback Widget', slug: 'widgets/feedback' },
						{ label: 'Testimonial Wall', slug: 'widgets/testimonials' },
						{ label: 'Changelog Timeline', slug: 'widgets/changelog' },
						{ label: 'Survey Widget', slug: 'widgets/survey' },
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
