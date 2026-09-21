"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong";
};

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStatus, setForgotStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const router = useRouter();
  const { status } = useSession();

  // Если пользователь уже авторизован, перенаправить на главную
  useEffect(() => {
    if (status === "authenticated") {
      router.push("/");
    }
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (isLogin) {
        // Login Logic
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (result?.error) {
          setError("Invalid email or password");
        } else {
          router.push("/");
          router.refresh();
        }
      } else {
        // Registration Logic
        if (password !== confirmPassword) {
          throw new Error("Пароли не совпадают");
        }

        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || "Registration failed");
        }

        // Auto login after registration
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (result?.error) {
          setError("Registration successful, but login failed. Please login manually.");
          setIsLogin(true);
        } else {
          router.push("/");
          router.refresh();
        }
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotStatus("sending");
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail || email }),
      });
      setForgotStatus("sent");
    } catch {
      setForgotStatus("error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100 p-4">
      <div className="w-full max-w-md lg:max-w-xl">
        {/* Заголовок с иконкой */}
        <div className="text-center mb-8 lg:mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 lg:w-24 lg:h-24 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl shadow-lg mb-4">
            <span className="text-2xl lg:text-4xl text-white">💰</span>
          </div>
          <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 mb-2">Uchet</h1>
          <p className="text-gray-600 text-base lg:text-xl">Учет финансов стал проще</p>
        </div>

        {/* Карточка формы */}
        <div className="bg-white rounded-3xl shadow-2xl p-6 lg:p-10 space-y-8 transition-all duration-300 hover:shadow-3xl">
          <div className="text-center">
            <h2 className="text-2xl lg:text-4xl font-bold text-gray-900">
              {isLogin ? "Добро пожаловать" : "Регистрация"}
            </h2>
            <p className="text-gray-500 mt-2 text-sm lg:text-base">
              {isLogin
                ? "Войдите в систему для управления финансами"
                : "Создайте аккаунт для начала работы"}
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-5">
              {/* Email Field */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-400">📧</span>
                  </div>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-gray-50/50"
                    placeholder="Введите email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Пароль
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-400">🔒</span>
                  </div>
                  <input
                    type="password"
                    required
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-gray-50/50"
                    placeholder="Введите пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Confirm Password Field (Only for Registration) */}
              {!isLogin && (
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Подтвердите пароль
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-400">🔒</span>
                    </div>
                    <input
                      type="password"
                      required
                      autoComplete="new-password"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-gray-50/50"
                      placeholder="Повторите пароль"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-600 text-sm text-center font-medium">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin h-5 w-5 mr-3 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  {isLogin ? "Вход..." : "Регистрация..."}
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <span className="mr-2">🚀</span>
                  {isLogin ? "Войти в систему" : "Зарегистрироваться"}
                </span>
              )}
            </button>
          </form>

          {/* Forgot password */}
          {isLogin && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setShowForgot(true);
                  setForgotEmail(email);
                  setForgotStatus("idle");
                }}
                className="text-sm text-gray-500 hover:text-gray-700 underline focus:outline-none"
              >
                Забыли пароль?
              </button>
            </div>
          )}

          {/* Toggle Login/Register */}
          <div className="text-center text-sm text-gray-600">
            {isLogin ? "Нет аккаунта? " : "Уже есть аккаунт? "}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError("");
              }}
              className="text-blue-600 hover:text-blue-700 font-semibold focus:outline-none"
            >
              {isLogin ? "Зарегистрироваться" : "Войти"}
            </button>
          </div>

          <div className="text-center text-sm text-gray-500 pt-6 border-t border-gray-200">
            <p className="font-medium">Система учета финансов • Версия 2.0</p>
            <p className="mt-1 text-xs">Безопасный вход через Email</p>
          </div>
        </div>
      </div>

      {showForgot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900">Восстановление пароля</h3>
            {forgotStatus === "sent" ? (
              <p className="text-sm text-gray-600">
                Если такой email зарегистрирован, запрос отправлен администратору.
                С вами свяжутся и выдадут новый пароль.
              </p>
            ) : (
              <form onSubmit={handleForgot} className="space-y-4">
                <p className="text-sm text-gray-600">
                  Укажите email аккаунта — запрос уйдёт администратору на подтверждение.
                </p>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Введите email"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
                {forgotStatus === "error" && (
                  <p className="text-sm text-red-500">Не удалось отправить, попробуйте позже.</p>
                )}
                <button
                  type="submit"
                  disabled={forgotStatus === "sending"}
                  className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 py-3 font-semibold text-white disabled:opacity-50"
                >
                  {forgotStatus === "sending" ? "Отправка..." : "Отправить запрос"}
                </button>
              </form>
            )}
            <button
              type="button"
              onClick={() => setShowForgot(false)}
              className="w-full rounded-xl border border-gray-300 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
