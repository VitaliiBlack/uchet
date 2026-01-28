import React from 'react';
import { FinancialOperation } from '@/lib/types';
import styles from '../../../../components/Calendar.module.css';
import { isEmptyOperation } from '../utils';

interface OperationRowProps {
    op: FinancialOperation;
    rowIndex: number;
    onChange: (localId: string, field: 'income' | 'expense' | 'description', value: string) => void;
    onBlur: (e: React.FocusEvent<HTMLInputElement>, localId: string, rowIndex: number) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) => void;
    onDelete: (id: number, localId: string) => void;
    registerRef: (el: HTMLInputElement | null, r: number, c: number) => void;
    isLastEmpty: boolean;
}

export const OperationRow = React.memo(({
    op,
    rowIndex,
    onChange,
    onBlur,
    onKeyDown,
    onDelete,
    registerRef,
    isLastEmpty
}: OperationRowProps) => {
    const showDelete = !isLastEmpty;

    return (
        <tr>
            <td>
                <input
                    ref={el => registerRef(el, rowIndex, 0)}
                    data-row-index={rowIndex}
                    type="number"
                    step="0.01"
                    value={op.income}
                    onChange={(e) => onChange(op.localId!, 'income', e.target.value)}
                    onBlur={(e) => onBlur(e, op.localId!, rowIndex)}
                    onKeyDown={(e) => onKeyDown(e, rowIndex, 0)}
                    className={styles['editable-input']}
                    placeholder="0"
                />
            </td>
            <td>
                <input
                    ref={el => registerRef(el, rowIndex, 1)}
                    data-row-index={rowIndex}
                    type="number"
                    step="0.01"
                    value={op.expense}
                    onChange={(e) => onChange(op.localId!, 'expense', e.target.value)}
                    onBlur={(e) => onBlur(e, op.localId!, rowIndex)}
                    onKeyDown={(e) => onKeyDown(e, rowIndex, 1)}
                    className={styles['editable-input']}
                    placeholder="0"
                />
            </td>
            <td>
                <input
                    ref={el => registerRef(el, rowIndex, 2)}
                    data-row-index={rowIndex}
                    type="text"
                    value={op.description || ''}
                    onChange={(e) => onChange(op.localId!, 'description', e.target.value)}
                    onBlur={(e) => onBlur(e, op.localId!, rowIndex)}
                    onKeyDown={(e) => onKeyDown(e, rowIndex, 2)}
                    className={styles['editable-input']}
                    placeholder="Описание"
                />
            </td>
            <td className={op.profit >= 0 ? styles.positive : styles.negative}>
                {op.profit}
            </td>
            <td>
                {showDelete && (
                    <button
                        onClick={() => onDelete(op.id, op.localId!)}
                        className={styles['delete-icon-button']}
                        title="Удалить"
                        tabIndex={-1}
                    >
                        ✕
                    </button>
                )}
            </td>
        </tr>
    );
});

OperationRow.displayName = 'OperationRow';
