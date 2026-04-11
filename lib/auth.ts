import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import { getUserRepository } from "@/lib/typeorm";

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

        const email = credentials.email as string;
        const password = credentials.password as string;

        try {
          const userRepository = await getUserRepository();
          const user = await userRepository.findOne({
            where: { email },
          });

          if (!user) {
            return null;
          }

          const isValid = await bcrypt.compare(password, user.password);

          if (isValid) {
            return {
              id: user.id.toString(),
              name: user.email.split('@')[0], // Use part of email as name
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
