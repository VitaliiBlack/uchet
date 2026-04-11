"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import styles from "./AppMenu.module.css";
import { getTodayDateKey } from "@/lib/date";

interface AppMenuProps {
  buttonClassName?: string;
  buttonLabel?: string;
  buttonAriaLabel?: string;
}

export default function AppMenu({
  buttonClassName,
  buttonLabel = "⋯",
  buttonAriaLabel = "Открыть меню",
}: AppMenuProps) {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const todayHref = `/day/${getTodayDateKey()}`;

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div className={styles.menuRoot}>
      <button
        type="button"
        aria-label={buttonAriaLabel}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`${styles.menuButton}${buttonClassName ? ` ${buttonClassName}` : ""}`}
      >
        {buttonLabel}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Закрыть меню"
            className={styles.backdrop}
            onClick={() => setOpen(false)}
          />
          <div className={styles.sheet} role="dialog" aria-modal="true">
            <div className={styles.sheetHeader}>
              <p className={styles.sheetTitle}>Меню</p>
              {session?.user?.email ? (
                <p className={styles.sheetSubtitle}>{session.user.email}</p>
              ) : (
                <p className={styles.sheetSubtitle}>Быстрые действия</p>
              )}
            </div>

            <div className={styles.sheetActions}>
              <Link href="/" className={styles.sheetLink} onClick={() => setOpen(false)}>
                <span>Главная</span>
                <span className={styles.actionHint}>Календарь</span>
              </Link>

              <Link href={todayHref} className={styles.sheetLink} onClick={() => setOpen(false)}>
                <span>Сегодня</span>
                <span className={styles.actionHint}>Открыть день</span>
              </Link>

              {session ? (
                <button
                  type="button"
                  className={`${styles.sheetButton} ${styles.destructive}`}
                  onClick={() => signOut({ callbackUrl: "/" })}
                >
                  <span>Выйти</span>
                  <span className={styles.actionHint}>Аккаунт</span>
                </button>
              ) : (
                <Link href="/login" className={styles.sheetLink} onClick={() => setOpen(false)}>
                  <span>Войти</span>
                  <span className={styles.actionHint}>Авторизация</span>
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
