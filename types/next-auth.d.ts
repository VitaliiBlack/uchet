import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      mustChangePassword?: boolean;
    } & DefaultSession["user"];
    sessionVersion?: number;
    /** ISO deadline to replace a temporary password (null = change right now). */
    mustChangeBy?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sessionVersion?: number;
    revoked?: boolean;
    mustChangePassword?: boolean;
    tempPasswordSetAt?: string | null;
  }
}
