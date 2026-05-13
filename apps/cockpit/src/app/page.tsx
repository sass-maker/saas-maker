import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isLocalAuthBypassEnabled } from "@/lib/local-auth";
import LoginPage from "./login/page";

export const metadata: Metadata = {
  title: "SaaS Maker Cockpit",
  description: "Sign in to manage SaaS Maker projects, fleet health, tasks, feedback, analytics, changelogs, testimonials, and roadmap work.",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function HomePage() {
  const requestHeaders = await headers();
  if (isLocalAuthBypassEnabled(requestHeaders.get("host"))) {
    redirect("/tasks");
  }

  return <LoginPage />;
}
