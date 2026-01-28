'use client';

import React, { useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import styles from '../../../components/Calendar.module.css';
import { useOperations } from './hooks/useOperations';
import { DayTotals } from './components/DayTotals';
import { OperationRow } from './components/OperationRow';
import { isEmptyOperation } from './utils';

export default function DayPage() {
  const params = useParams();
  const date = params.date as string;

  const {
    displayOperations,
    loading,
    totals,
    handleChange,
    handleBlur,
    deleteOperation,
  } = useOperations(date);

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

  const registerRef = useCallback((el: HTMLInputElement | null, r: number, c: number) => {
    if (!inputRefs.current[r]) {
      inputRefs.current[r] = [];
    }
    inputRefs.current[r][c] = el;

    // Отслеживаем фокус на элементе
    if (el) {
      el.addEventListener('focus', () => {
        lastFocusedRef.current = { row: r, col: c };
      });
    }
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

  if (loading) return <div className={styles['loading-indicator']}>Загрузка...</div>;

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

      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <Link href="/" className={styles['nav-button']} style={{ display: 'inline-block', textDecoration: 'none' }}>
          Назад к календарю
        </Link>
      </div>
    </div>
  );
}