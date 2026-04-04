# Idea Dump

Moved from `reference/saas-ideas/sass-maker.md` on 2026-04-05.

This note stays here because it is project-specific product thinking for `saas-maker`, not a fresh standalone `saas-ideas` candidate anymore.

## Core Modules

- wishlist + email (https://formspark.io/)
- feature (requests, roadmap, voting)
- testimonials
- Feedback https://www.featurebase.app/
- Analytics
- URL shortner
- Website builder (landing page) + A blogging platform that uses AI to write articles based on required keywords
- Social verification (connect x, git etc)
- Users comment on blog
- Calendly integration

People can see a list of their subscriptions

## Finance

- There are apps that let you price things based on country. There should be something that also lets you price things by slab: 1st 100 users - 10rs and next 20rs
- Affiliates (something like lemon squeezy)

## Shared Ecosystem

- An app that lets you find people to share back links. Maybe let people just add a simple page with a list of back link collaborators. And can add cron to scrap that page to verify. People will come to the platform, take my component and add it to their site with a key. They can send each other back link requests, once accepted their website will automatically start receiving the new links. Just let people be part of partner back link network via footer.
- Reel maker and social media marketing: to help you integrate various social media forwarding. Maybe a library or just manage everything?
- Founders linked tree profile
- An app to track bugs, everytime a user encounters a bug, it either creates a bug or adds to a bug. This bug list can then be used by the engineer to prioritise and fix. Once done all the people who encountered that bug are notified. Can be done something similar for feature requests? Maybe rating?
- Extensions of custom form can be used as CMS (strapi or something)
  - can be used as an alternative to google form. Responses can be stored as array in single key in all responses table mapped by userID and formID.
  - forms can have the form structure along with array mapping of question to answer
  - need to remember to not change the mapping key when form fields are reordered
  - core feature can be, people can be paid for filling surveys and their data across different surveys can be shared to different companies
  - can combine with a directory so their forms can also be used to gain discoverability and feedback from genuine users by paying a small price
- AI feedback summariser, each app will get feedback buttons and will get daily personalised feedback messages. Positive percentage and list of complaints/feature requests ordered by count. Can maybe integrate play store reviews and stuff. Need to figure out a way to handle cases when token count is huge. If it can figure out the screen from screenshot that would be awesome. This can be used across way too many places if made well. Shopify. What if we take bunch of reviews and start categorizing them via AI, then take those categories send more reviews while also allowing ai to choose new categories. Can use batch api after we have enough data. Can then create an inverted index like structure that will give reviews for a particular category. Should have the ability to see top categories for last X time. For this, if successful will have to move towards self hosted model soon.
- job board
- SH membership free and special cohort (or just a pvt community for the time being)
- Can schedule 1on1 with me or other people
- Supportbot - with tiered support, asks the client whether they want human intervention after few messages. And all human intervention queries are then sent to prioritiy queue ordered by priroity & time in queue.
- Something like pally - social media manager for branding in the gig economy
- App should focus on gig
- Has bunch of AI different tools available for free for customers and for SEO. Can have cool way of sharing instead of just copy text.
- Can offer consulting and mvp service

## App Web Store

To make web App Store a reality, will need to figure out multiple things:
- people adding their apps (launch platform)
- how to send money to people’s bank account (some 3rd party service)
- how to ensure secure transactions, people can just buy coins at a portal and then use them across different apps. By using their common email definitely, then will need to send webhook events directly to the integrated webapps after deduction from wallet.

Longer-term directions:
- future crypto transactions
- subscriptions
- bundling / bulk discounts
- legal terms, tax considerations and security concerns
- subscription management platform
- seed the store with owned and non-affiliated apps
- investor / owner / influencer / customer connector
- tools that help people start quickly: forms, waitlist, moderation channels, product roadmap, marketing tools, maybe classes
- domain routing and launch/distribution tooling
- easier way to release silly little apps to friends without app-store friction
- MCP servers for different apps for agents to automatically access
- AI-based marketing
- product desirability testing

## Pricing

- 50$/month - my branding + they agree to share their services at a discount to other business
- 100$/month - no branding

## Reference Products To Build Toward

- https://devhunt.org/
- https://findcool.tools/
- https://mrfreetools.com/
- https://www.omus.ltd/
- https://stratup.ai/en/ais

## Ideology

Ask customers what would it take for them to switch, build that and give them discount.

## Old Dump

A startup bootstrapper provides all services built in.

Cool landing page, legal formalities, payment integration, marketing, investor outreach, social media, community engagement, server costs, hosted URLs, mentorship, content creation, referral program, mailer, etc.

Products will be built by people and owned by them. `ServiceMaker` will act as the platform.

Longer-term ideas:
- initially target college kids for easy access to entrepreneurship
- investors page for startup discovery/investing
- partner app for revenue tracking and venture partnerships
- shared advertising across apps
- free versions of apps with ads and rate limiting
- shared referral/payment/subscription infrastructure
- co-founder matching
- plug-and-play product components
- realtime leaderboard
- tool explorer / startup & SaaS directory

## All Products

Purpose:
- a place which has aggregated all software publicly available
- user can search product features well, filter by attributes, and discover products
- big products can add multiple products
- people can add reviews
- product owners can add revenue, cap table, acquisition, and micro-equity information
- dead products should be archived automatically
- connect companies with influencers/marketers for commission or equity
- connect users, investors, influencers, product owners, and customers in one platform
- centralize auth, subscriptions, payments, and dashboards

## LLM Routing Agent

An app to test various LLMs for various tasks and evals.

Details:
1. Task system
2. Prompt and parameter management
3. Model registry
4. Test cases
5. Eval framework
6. Experiment runner
7. Routing and deployment config
8. Runtime API and SDK
9. Runs storage and history
