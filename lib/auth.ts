import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { ILike } from "typeorm";
import { authConfig } from "@/auth.config";
import { getUserRepository } from "@/lib/typeorm";
import { rateLimit } from "@/lib/rateLimit";
import { normalizeEmail } from "@/lib/validation";

const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials: Partial<Record<"email" | "password", unknown>>) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = normalizeEmail(credentials.email);
        const password = String(credentials.password);

        // Per-account brute-force throttle (best-effort, in-memory).
        const limit = rateLimit("login:" + email, LOGIN_LIMIT, LOGIN_WINDOW_MS);
        if (!limit.ok) {
          console.warn("Login rate limit hit for " + email);
          return null;
        }

        try {
          const userRepository = await getUserRepository();
          const user = await userRepository.findOne({
            where: { email: ILike(email) },
          });

          if (!user) {
            return null;
          }

          const isValid = await bcrypt.compare(password, user.password);

          if (isValid) {
            return {
              id: user.id.toString(),
              name: user.email.split('@')[0],
              email: user.email,
            };
          }

          return null;
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
});
