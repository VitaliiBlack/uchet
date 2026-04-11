'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import styles from './Calendar.module.css';
import { FinancialOperation } from '@/lib/types';
import { getTodayDateKey, normalizeDateKey } from '@/lib/date';
import AppMenu from './AppMenu';

const fetchCalendarOperations = async (): Promise<FinancialOperation[]> => {
  const response = await fetch('/api/financial-data', {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch');
  }

  return response.json();
};

const Calendar: React.FC = () => {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const todayDateKey = getTodayDateKey();
  const monthTitle = currentDate.toLocaleString('ru-RU', { month: 'long' });
  const { data: operations = [], isLoading } = useQuery({
    queryKey: ['calendar-operations'],
    queryFn: fetchCalendarOperations,
  });

  // Pre-process operations into a map for O(1) daily lookup
  const operationsByDate = useMemo(() => {
    const map: Record<string, FinancialOperation[]> = {};
    operations.forEach(op => {
      const dateKey = normalizeDateKey(op.date);
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(op);
    });
    return map;
  }, [operations]);

  // Calculate daily totals for all days at once
  const dailyTotals = useMemo(() => {
    const totals: Record<string, { totalIncome: number, totalExpense: number, totalProfit: number }> = {};
    Object.keys(operationsByDate).forEach(dateStr => {
      const ops = operationsByDate[dateStr];
      const totalIncome = ops.reduce((sum, op) => sum + Number(op.income), 0);
      const totalExpense = ops.reduce((sum, op) => sum + Number(op.expense), 0);
      totals[dateStr] = {
        totalIncome,
        totalExpense,
        totalProfit: totalIncome - totalExpense
      };
    });
    return totals;
  }, [operationsByDate]);

  // Calculate monthly totals
  const monthlyTotals = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    let totalIncome = 0;
    let totalExpense = 0;

    // Iterate through all days in current month to get totals
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayData = dailyTotals[dateStr];
      if (dayData) {
        totalIncome += dayData.totalIncome;
        totalExpense += dayData.totalExpense;
      }
    }

    return {
      totalIncome,
      totalExpense,
      totalProfit: totalIncome - totalExpense
    };
  }, [dailyTotals, currentDate]);

  // Navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Calendar rendering helpers
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    // 0 is Sunday, 1 is Monday. In RU we often start with Monday.
    // Let's stick to the current Russian display labels but adjust logic if needed.
    // Current labels: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'] -> 0 is Вс
    return new Date(year, month, 1).getDay();
  };

  const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

  // Render calendar days
  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayOfMonth = getFirstDayOfMonth(year, month);

    const days = [];

    // Day headers
    dayNames.forEach((dayName, idx) => {
      days.push(
        <div key={`header-${idx}`} className={styles['calendar-day-header']}>
          {dayName}
        </div>
      );
    });

    // Empty cells before first day
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className={`${styles['calendar-day']} ${styles.empty}`}></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOps = operationsByDate[dateStr] || [];
      const totals = dailyTotals[dateStr] || { totalIncome: 0, totalExpense: 0, totalProfit: 0 };
      const isToday = todayDateKey === dateStr;
      const hasOperations = dayOps.length > 0;

      days.push(
        <div
          key={`day-${day}`}
          className={`${styles['calendar-day']} ${isToday ? styles.today : ''}`}
        >
          <button
            type="button"
            className={styles['day-hitbox']}
            aria-label={`Открыть день ${dateStr}`}
            onClick={() => router.push('/day/' + dateStr)}
          />
          <div className={styles['day-content']}>
            <div className={styles['day-header']}>
              <div className={styles['day-number']}>{day}</div>
            </div>
            <div className={styles['daily-summary']} data-has-ops={hasOperations}>
              {totals.totalIncome > 0 && (
                <div className={`${styles['financial-item']} ${styles.income}`}>
                  <span className={styles.label}>+</span>
                  <span className={styles['item-value']}>{totals.totalIncome}</span>
                </div>
              )}
              {totals.totalExpense > 0 && (
                <div className={`${styles['financial-item']} ${styles.expense}`}>
                  <span className={styles.label}>-</span>
                  <span className={styles['item-value']}>{totals.totalExpense}</span>
                </div>
              )}
              {(totals.totalIncome > 0 || totals.totalExpense > 0) && (
                <div className={`${styles['financial-item']} ${styles.profit} ${styles['desktop-profit-item']}`}>
                  <span className={styles.label}>∑</span>
                  <span className={styles['item-value']}>{totals.totalProfit}</span>
                </div>
              )}
              {hasOperations && (
                <div className={`${styles['financial-item']} ${styles['mobile-count-item']}`}>
                  <span className={styles.label}>+</span>
                  <span className={styles['item-value']}>{dayOps.length} зап.</span>
                </div>
              )}
            </div>
            {hasOperations && (
              <div className={styles['operations-preview']}>
                {dayOps.slice(0, 2).map(op => (
                  <div key={op.id} className={styles['operation-preview']}>
                    <span className={styles['op-desc']}>{op.description || '...'}</span>
                    <span className={op.profit >= 0 ? styles.positive : styles.negative}>
                      {op.profit}
                    </span>
                  </div>
                ))}
                {dayOps.length > 2 && (
                  <div className={styles['more-indicator']}>+{dayOps.length - 2} ещё</div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return days;
  };

  return (
    <div className={styles['calendar-container']}>
      <div className={styles['calendar-shell-bar']}>
        <div className={styles['calendar-year-pill']}>{currentDate.getFullYear()}</div>
        <div className={styles['calendar-shell-actions']}>
          <button type="button" className={styles['today-pill']} onClick={goToToday}>
            Today
          </button>
          <AppMenu buttonClassName={styles['menu-trigger']} />
        </div>
      </div>

      <div className={styles['calendar-header']}>
        <div className={styles['month-row']}>
          <h2 className={styles['month-year']}>{monthTitle}</h2>
          <div className={styles['nav-group']}>
            <button
              type="button"
              className={styles['nav-button']}
              onClick={prevMonth}
              aria-label="Предыдущий месяц"
            >
              ‹
            </button>
            <button
              type="button"
              className={styles['nav-button']}
              onClick={nextMonth}
              aria-label="Следующий месяц"
            >
              ›
            </button>
          </div>
        </div>
        <div className={styles['monthly-summary']}>
          <div className={`${styles['summary-item']} ${styles.income}`}>
            <span className={styles.label}>+</span> {monthlyTotals.totalIncome}
          </div>
          <div className={`${styles['summary-item']} ${styles.expense}`}>
            <span className={styles.label}>-</span> {monthlyTotals.totalExpense}
          </div>
          <div className={`${styles['summary-item']} ${styles.profit}`}>
            <span className={styles.label}>∑</span> {monthlyTotals.totalProfit}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className={styles['loading-indicator']}>Загрузка данных...</div>
      ) : (
        <div className={styles['calendar-grid']}>
          {renderCalendar()}
        </div>
      )}
    </div>
  );
};

export default Calendar;
