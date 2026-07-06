"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import { usePathname } from "next/navigation";
import QueryProvider from "@/components/QueryProvider";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";

interface AppShellProps {
  children: React.ReactNode;
  session: Session | null;
}

export default function AppShell({ children, session }: AppShellProps) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const isCalendarPage = pathname === "/" || pathname.startsWith("/day/");

  return (
    <SessionProvider session={session}>
      <QueryProvider>
        <ServiceWorkerRegistration />
        <main
          className={
            isLoginPage
              ? ""
              : isCalendarPage
                ? "shell-main shell-main--calendar"
                : "container mx-auto px-3 py-6 sm:px-4 sm:py-8"
          }
        >
          {children}
        </main>
      </QueryProvider>
    </SessionProvider>
  );
}
