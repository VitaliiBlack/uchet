'use client';

import React, { useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import styles from '../../../components/Calendar.module.css';
import { useOperations } from './hooks/useOperations';
import { DayTotals } from './components/DayTotals';
import { OperationRow } from './components/OperationRow';
import { isEmptyOperation } from './utils';
import { useWorkspaces } from '@/components/useWorkspaces';

export default function DayPage() {
  const params = useParams();
  const date = params.date as string;

  return <DayPageContent key={date} date={date} />;
}

function DayPageContent({ date }: { date: string }) {
  const router = useRouter();
  const {
    activeWorkspaceId,
    isLoading: workspacesLoading,
  } = useWorkspaces();

  const {
    displayOperations,
    loading,
    totals,
    handleChange,
    handleBlur,
    deleteOperation,
  } = useOperations(date, activeWorkspaceId);

  // This ref must stay here to coordinate focus between rows
  const inputRefs = React.useRef<(HTMLInputElement | null)[][]>([]);

  // Отслеживаем последний активный элемент для восстановления фокуса
  const lastFocusedRef = React.useRef<{ row: number; col: number } | null>(null);
  const isRestoringFocusRef = React.useRef(false);

  // Восстанавливаем фокус после ре-рендера
  React.useEffect(() => {
    if (isRestoringFocusRef.current && lastFocusedRef.current) {
      const { row, col } = lastFocusedRef.current;
      const rowInputRef = inputRefs.current[row];
      if (rowInputRef && rowInputRef[col]) {
        rowInputRef[col]?.focus();
        rowInputRef[col]?.select();
      }
      isRestoringFocusRef.current = false;
    }
  }, [displayOperations]);

  React.useEffect(() => {
    const blurActiveElement = () => {
      const activeElement = document.activeElement;

      if (activeElement instanceof HTMLElement) {
        activeElement.blur();
      }
    };

    window.addEventListener('pagehide', blurActiveElement);

    return () => window.removeEventListener('pagehide', blurActiveElement);
  }, []);

  const registerRef = useCallback((el: HTMLInputElement | null, r: number, c: number) => {
    if (!inputRefs.current[r]) {
      inputRefs.current[r] = [];
    }
    inputRefs.current[r][c] = el;
  }, []);

  const handleFocusCell = useCallback((row: number, col: number) => {
    lastFocusedRef.current = { row, col };
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => {
    if (event.key === 'Tab' || event.key === 'Enter') {
      const totalColCount = 3;
      let nextRow = rowIndex;
      let nextCol = colIndex;

      if (event.key === 'Tab' && event.shiftKey) {
        nextCol--;
        if (nextCol < 0) {
          nextRow--;
          nextCol = totalColCount - 1;
        }
      } else { // Tab forward or Enter
        nextCol++;
        if (nextCol >= totalColCount) {
          nextRow++;
          nextCol = 0;
          // Устанавливаем флаг для восстановления фокуса на новой строке
          isRestoringFocusRef.current = true;
        }
      }

      if (nextRow >= 0) {
        event.preventDefault();

        setTimeout(() => {
          const rowInputRef = inputRefs.current[nextRow];
          if (rowInputRef && rowInputRef[nextCol]) {
            rowInputRef[nextCol]?.focus();
            rowInputRef[nextCol]?.select();
          }
        }, 10);
      }
    }
  }, []);

  const handleBack = useCallback(() => {
    const activeElement = document.activeElement;

    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }

    window.setTimeout(() => {
      if (window.history.length > 1) {
        router.back();
        return;
      }

      router.push('/');
    }, 180);
  }, [router]);

  if (workspacesLoading || loading) return <div className={styles['loading-indicator']}>Загрузка...</div>;

  return (
    <div className={styles['calendar-container']}>
      <DayTotals totals={totals} date={date} />

      <div className={styles['operations-list']}>
        <table className={styles['operations-table']}>
          <thead>
            <tr>
              <th>Доход</th>
              <th>Расход</th>
              <th>Описание</th>
              <th>Прибыль</th>
              <th style={{ width: '40px' }}></th>
            </tr>
          </thead>
          <tbody>
            {displayOperations.map((op, rowIndex) => {
              const isLastEmpty = rowIndex === displayOperations.length - 1 && isEmptyOperation(op);
              return (
                <OperationRow
                  key={op.localId}
                  op={op}
                  rowIndex={rowIndex}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  onFocusCell={handleFocusCell}
                  onDelete={deleteOperation}
                  registerRef={registerRef}
                  isLastEmpty={isLastEmpty}
                />
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} style={{ textAlign: 'right', fontWeight: 'bold' }}>Итого:</td>
              <td className={totals.profit >= 0 ? styles.positive : styles.negative}>
                {totals.profit}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className={styles['day-footer']}>
        <button type="button" className={styles['day-back-button']} onClick={handleBack}>
          <span className={styles['day-back-icon']}>←</span>
          <span>К календарю</span>
        </button>
      </div>
    </div>
  );
}
