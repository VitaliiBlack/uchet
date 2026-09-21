import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { bumpSessionVersion, getUserAuthState, verifyCredentials } from "@/lib/credentials";
import { mustChangeBy } from "@/lib/passwordPolicy";
import { logSecurityEvent } from "@/lib/securityEvents";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        const first = user as {
          sessionVersion?: number;
          mustChangePassword?: boolean;
          tempPasswordSetAt?: string | null;
        };
        token.sessionVersion =
          typeof first.sessionVersion === "number" ? first.sessionVersion : undefined;
        token.mustChangePassword = Boolean(first.mustChangePassword);
        token.tempPasswordSetAt = first.tempPasswordSetAt ?? null;
      }

      // Revocation check plus fresh temp-password state from the database.
      if (token.sub && typeof token.sessionVersion === "number") {
        const state = await getUserAuthState(Number(token.sub));
        if (!state) {
          token.revoked = true;
        } else {
          token.revoked = state.sessionVersion !== token.sessionVersion;
          token.mustChangePassword = state.mustChangePassword;
          token.tempPasswordSetAt = state.tempPasswordSetAt;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token.revoked) {
        // Revoked: return a session without a user.
        return { ...session, user: undefined } as unknown as typeof session;
      }

      if (token && session.user) {
        session.user.id = token.sub as string;
        session.sessionVersion =
          typeof token.sessionVersion === "number" ? token.sessionVersion : undefined;
        const tempSetAt =
          typeof token.tempPasswordSetAt === "string" ? token.tempPasswordSetAt : null;
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
        session.mustChangeBy = token.mustChangePassword ? mustChangeBy(tempSetAt) : null;
      }
      return session;
    },
  },
  events: {
    // Revoke every token for this user on logout (bumps users.session_version).
    async signOut(message) {
      const sub =
        (message as { token?: { sub?: string } }).token?.sub ??
        (message as { session?: { userId?: string } }).session?.userId;
      if (sub) {
        await bumpSessionVersion(Number(sub));
        await logSecurityEvent({ type: 'logout', userId: Number(sub) });
      }
    },
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(
        credentials: Partial<Record<"email" | "password", unknown>>,
        request: Request
      ) {
        const user = await verifyCredentials(credentials?.email, credentials?.password, request);
        if (!user) {
          return null;
        }

        return {
          id: String(user.id),
          name: user.email.split('@')[0],
          email: user.email,
          sessionVersion: user.sessionVersion,
          mustChangePassword: user.mustChangePassword,
          tempPasswordSetAt: user.tempPasswordSetAt,
        };
      },
    }),
  ],
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
});
