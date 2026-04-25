import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined"
    ? window.location.origin
    : process.env.AUTH_URL || process.env.NEXTAUTH_URL || "https://app.sassmaker.com",
});
