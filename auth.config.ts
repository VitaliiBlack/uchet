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
                "/public",
            ].some((path) => nextUrl.pathname.startsWith(path));

            // Redirect authenticated users away from login
            if (isLoggedIn && nextUrl.pathname === "/login") {
                return Response.redirect(new URL("/", nextUrl));
            }

            // Allow public paths or require login
            return isPublicPath || isLoggedIn;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.sub as string;
            }
            return session;
        },
    },
    providers: [], // List empty here, add in lib/auth.ts
} satisfies NextAuthConfig;
