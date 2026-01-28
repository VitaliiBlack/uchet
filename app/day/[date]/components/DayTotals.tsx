import React from 'react';
import styles from '../../../../components/Calendar.module.css';

interface DayTotalsProps {
    totals: {
        income: number;
        expense: number;
        profit: number;
    };
    date: string;
}

export const DayTotals = React.memo(({ totals, date }: DayTotalsProps) => {
    const displayedDate = new Date(date);

    return (
        <div className={styles['financial-section-header']}>
            <h1>Операции за {displayedDate.toLocaleDateString('ru-RU')}</h1>
            <div className={styles['daily-totals']}>
                <span className={styles['total-income']}>+ {totals.income}</span>
                <span className={styles['total-expense']}>- {totals.expense}</span>
                <span className={styles['total-profit']}>∑ {totals.profit}</span>
            </div>
        </div>
    );
});

DayTotals.displayName = 'DayTotals';
