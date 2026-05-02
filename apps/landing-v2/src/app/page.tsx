"use client";
import React from "react";
import { HeroHighlight, Highlight } from "@/components/ui/hero-highlight";
import { motion } from "framer-motion";
import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid";
import { HoverEffect } from "@/components/ui/card-hover-effect";
import { 
  Rocket, 
  Shield, 
  Zap, 
  Layout, 
  BarChart, 
  Globe, 
  Github,
  ChevronRight,
  Code2,
  Terminal,
  Cpu
} from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-black">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/10 bg-black/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm">F</div>
            <span>Foundry</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-400">
            <Link href="#features" className="hover:text-white transition-colors">Features</Link>
            <Link href="#blocks" className="hover:text-white transition-colors">Blocks</Link>
            <Link href="#" className="hover:text-white transition-colors">Docs</Link>
            <Link href="#" className="hover:text-white transition-colors">Showcase</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="#" className="text-sm font-medium hover:text-white transition-colors hidden sm:block">Log in</Link>
            <button className="bg-white text-black px-4 py-2 rounded-full text-sm font-bold hover:bg-neutral-200 transition-colors">
              Join the Fleet
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <BackgroundBeams className="opacity-40" />
        <HeroHighlight>
        <motion.h1
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: [20, -5, 0],
          }}
          transition={{
            duration: 0.5,
            ease: [0.4, 0.0, 0.2, 1],
          }}
          className="text-4xl px-4 md:text-6xl lg:text-7xl font-bold text-white max-w-5xl leading-tight lg:leading-tight text-center mx-auto "
        >
          Forge your next idea with the <br />
          <Highlight className="text-white">
            Elite SaaS Standard.
          </Highlight>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-neutral-400 text-center mt-8 text-lg md:text-xl max-w-2xl mx-auto px-4"
        >
          The Open Source Foundry for developers who build at scale. Shared standards, modular blocks, and a unified cockpit for all your repositories.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10"
        >
          <button className="bg-blue-600 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-blue-700 transition-all flex items-center gap-2 group shadow-[0_0_20px_rgba(37,99,235,0.4)]">
            Open the Cockpit <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          <button className="bg-white/10 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-white/20 transition-all border border-white/10 backdrop-blur-sm">
            See the Standard
          </button>
        </motion.div>
      </HeroHighlight>
      </div>

      {/* Bento Grid Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto mb-16 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">One Standard for all projects</h2>
          <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
            Eliminate configuration drift with shared, versioned standards for ESLint, TypeScript, and Prettier.
          </p>
        </div>
        <BentoGrid>
          {features.map((item, i) => (
            <BentoGridItem
              key={i}
              title={item.title}
              description={item.description}
              header={item.header}
              icon={item.icon}
              className={i === 3 || i === 6 ? "md:col-span-2" : ""}
            />
          ))}
        </BentoGrid>
      </section>

      {/* Toolkit Section */}
      <section id="blocks" className="py-24 px-6 bg-neutral-950">
        <div className="max-w-7xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Modular Foundry Blocks</h2>
          <p className="text-neutral-400 text-lg max-w-2xl">
            A complete toolkit of high-quality, plug-and-play modules for every project in your fleet.
          </p>
          <HoverEffect items={projects} />
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/10 blur-[120px] rounded-full -z-10" />
        <div className="max-w-4xl mx-auto text-center border border-white/10 bg-white/5 backdrop-blur-md rounded-[3rem] p-12 md:p-20">
          <h2 className="text-4xl md:text-6xl font-bold mb-8">Ready to join the fleet?</h2>
          <p className="text-neutral-400 text-xl mb-12">
            Join 10,000+ creators building the future of software on The Foundry. No credit card required.
          </p>
          <button className="bg-white text-black px-12 py-6 rounded-full font-black text-2xl hover:bg-neutral-200 transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)]">
            Start Building Now
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/10 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2 font-bold text-xl">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white text-[10px]">F</div>
            <span>Foundry</span>
          </div>
          <div className="flex gap-8 text-sm text-neutral-500 font-medium">
            <Link href="#" className="hover:text-white transition-colors">GitHub</Link>
            <Link href="#" className="hover:text-white transition-colors">Documentation</Link>
            <Link href="#" className="hover:text-white transition-colors">Showcase</Link>
            <Link href="#" className="hover:text-white transition-colors">Privacy</Link>
          </div>
          <div className="flex items-center gap-4 text-neutral-500">
            <Github className="w-5 h-5 hover:text-white cursor-pointer transition-colors" />
            <span className="text-sm">© 2026 The Foundry.</span>
          </div>
        </div>
      </footer>
    </main>
  );
}

const Skeleton = () => (
  <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-neutral-900 to-neutral-800 border border-white/5" />
);

const features = [
  {
    title: "The Standard",
    description: "Consistent code quality across 1 or 100 projects. Unified ESLint, Prettier, and TypeScript configs.",
    header: <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/20 flex items-center justify-center">
      <Shield className="w-12 h-12 text-blue-500" />
    </div>,
    icon: <Shield className="h-4 w-4 text-neutral-500" />,
  },
  {
    title: "Fleet Analytics",
    description: "Real-time insights across your entire repository fleet.",
    header: <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center">
      <BarChart className="w-12 h-12 text-emerald-500" />
    </div>,
    icon: <BarChart className="h-4 w-4 text-neutral-500" />,
  },
  {
    title: "Edge Infrastructure",
    description: "Deploy globally with sub-50ms latency using Cloudflare Workers.",
    header: <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-orange-500/20 to-yellow-500/20 border border-orange-500/20 flex items-center justify-center">
      <Zap className="w-12 h-12 text-orange-500" />
    </div>,
    icon: <Zap className="h-4 w-4 text-neutral-500" />,
  },
  {
    title: "Modular SDK",
    description: "Type-safe TypeScript SDK that grows with your application. Build custom integrations in minutes.",
    header: <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-neutral-900 border border-white/5 overflow-hidden">
      <div className="p-4 font-mono text-[10px] text-blue-400">
        <div><span className="text-pink-500">import</span> {"{ Foundry }"} <span className="text-pink-500">from</span> <span className="text-emerald-400">"@foundry/sdk"</span></div>
        <div className="mt-2 text-neutral-500">// Initialize the fleet</div>
        <div><span className="text-blue-500">const</span> fleet = <span className="text-yellow-400">new</span> <span className="text-yellow-500">Foundry</span>()</div>
        <div className="mt-2 text-neutral-500">// Deploy modular blocks</div>
        <div><span className="text-pink-500">await</span> fleet.<span className="text-blue-500">deploy</span>(<span className="text-emerald-400">"ai-block"</span>)</div>
      </div>
    </div>,
    icon: <Code2 className="h-4 w-4 text-neutral-500" />,
  },
  {
    title: "The Cockpit",
    description: "Your mission control for every repository, deployment, and service.",
    header: <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20 flex items-center justify-center">
      <Terminal className="w-12 h-12 text-purple-500" />
    </div>,
    icon: <Terminal className="h-4 w-4 text-neutral-500" />,
  },
  {
    title: "Global Distribution",
    description: "Scale from 1 to 100 million users without touching infrastructure.",
    header: <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 border border-indigo-500/20 flex items-center justify-center">
      <Globe className="w-12 h-12 text-indigo-500" />
    </div>,
    icon: <Globe className="h-4 w-4 text-neutral-500" />,
  },
];

const projects = [
  {
    title: "AI Block",
    description: "Unified provider integration for OpenAI, Anthropic, and Gemini.",
    link: "#",
  },
  {
    title: "Analytics Block",
    description: "Lightweight PostHog wrapper to standardize tracking.",
    link: "#",
  },
  {
    title: "DB Block",
    description: "Drizzle-powered database utilities for D1 and Turso.",
    link: "#",
  },
  {
    title: "Widgets",
    description: "Ready-to-drop UI components for feedback and roadmaps.",
    link: "#",
  },
  {
    title: "The Commander",
    description: "A CLI to manage your fleet—lint, audit, and upgrade.",
    link: "#",
  },
  {
    title: "The Forge",
    description: "Scaffold new Foundry-compliant projects in seconds.",
    link: "#",
  },
];
