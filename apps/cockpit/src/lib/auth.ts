import { betterAuth } from "better-auth";

export const auth = betterAuth({
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
