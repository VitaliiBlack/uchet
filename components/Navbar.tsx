"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export default function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className="bg-white shadow">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Link href="/" className="text-xl font-bold text-gray-800">
            Uchet
          </Link>
          <Link href="/" className="text-gray-600 hover:text-gray-900">
            Главная
          </Link>
          {session && (
            <Link
              href="/day/2025-01-27"
              className="text-gray-600 hover:text-gray-900"
            >
              День
            </Link>
          )}
        </div>
        <div className="flex items-center space-x-4">
          {session ? (
            <>
              <span className="text-gray-700">
                Вы вошли как {session.user?.name}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Выйти
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              Войти
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}