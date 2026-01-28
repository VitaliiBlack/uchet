import Calendar from "../components/Calendar";
import "../components/Calendar.module.css";
import { auth } from "@/lib/auth";
import Link from "next/link";

export default async function Home() {
  const session = await auth();

  return (
    <div className="app-container">
      <main className="main-content">
        <h1 className="app-title">Financial Tracker</h1>
        {session ? (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded">
            <p className="text-green-800">
              Вы авторизованы как{" "}
              <strong>{session.user?.name || session.user?.email}</strong>.
              Теперь вы можете получить доступ к защищенным страницам.
            </p>
            <div className="mt-4 flex space-x-4">
              <Link
                href="/day/2025-01-27"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Перейти к дню
              </Link>
              <Link
                href="/api/financial-data"
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                API данных
              </Link>
            </div>
          </div>
        ) : (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-yellow-800">
              Вы не авторизованы. Пожалуйста,{" "}
              <Link href="/login" className="text-blue-600 underline">
                войдите
              </Link>{" "}
              для доступа к защищенным страницам.
            </p>
            <p className="mt-2 text-sm text-gray-600">
              Используйте логин: <strong>uchet</strong>, пароль:{" "}
              <strong>parolotuchet</strong>
            </p>
          </div>
        )}
        <Calendar />
      </main>
    </div>
  );
}
