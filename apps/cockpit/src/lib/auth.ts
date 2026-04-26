import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as authSchema from "./auth-schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _auth: any = null;

/** Lazy-init auth using the D1 binding from Cloudflare context */
function getAuth() {
  if (_auth) return _auth;
  const { env } = getCloudflareContext();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (env as any).DB;
  _auth = betterAuth({
    database: drizzleAdapter(drizzle(db, { schema: authSchema }), {
      provider: "sqlite",
      schema: authSchema,
    }),
    secret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET,
    baseURL: process.env.AUTH_URL || process.env.NEXTAUTH_URL || "https://app.sassmaker.com",
    socialProviders: {
      google: {
        clientId: process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET || "",
      },
    },
    trustedOrigins: ["https://app.sassmaker.com"],
  });
  return _auth;
}

// Proxy that lazily delegates to the real betterAuth instance
export const auth: ReturnType<typeof betterAuth> = new Proxy(
  {} as ReturnType<typeof betterAuth>,
  {
    get(_target, prop, receiver) {
      return Reflect.get(getAuth(), prop, receiver);
    },
  }
);
