import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
    pages: {
        signIn: "/login",
    },
    // Автоматически определяет URL из заголовков запроса
    // Это позволяет не задавать NEXTAUTH_URL при деплое
    trustHost: true,
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isPublicPath = [
                "/login",
                "/api/auth",
                "/_next",
                "/favicon.ico",
                "/icons",
                "/manifest.webmanifest",
                "/public",
                "/sw.js",
            ].some((path) => nextUrl.pathname.startsWith(path));

            // Redirect authenticated users away from login
            if (isLoggedIn && nextUrl.pathname === "/login") {
                return Response.redirect(new URL("/", nextUrl));
            }

            // The admin area has its own isolated auth; let it through here.
            const adminSlug = (process.env.ADMIN_PATH ?? "").trim().replace(/^\/+|\/+$/g, "");
            const adminRoot = adminSlug ? "/" + adminSlug : null;
            const isAdminPath =
                adminRoot !== null &&
                (nextUrl.pathname === adminRoot || nextUrl.pathname.startsWith(adminRoot + "/"));

            // Allow public paths, the admin area, or require login
            return isAdminPath || isPublicPath || isLoggedIn;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.sub as string;
                session.sessionVersion =
                    typeof token.sessionVersion === "number" ? token.sessionVersion : undefined;
            }
            return session;
        },
    },
    providers: [], // List empty here, add in lib/auth.ts
} satisfies NextAuthConfig;
