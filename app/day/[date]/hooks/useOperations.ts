import { useState, useCallback, useEffect, useMemo } from 'react';
import { FinancialOperation } from '@/lib/types';
import { isEmptyOperation, createEmptyOperation, calculateProfit } from '../utils';

export const useOperations = (date: string) => {
    const [operations, setOperations] = useState<FinancialOperation[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchOperations = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/financial-data?date=${date}`);
            if (!response.ok) {
                setOperations([]);
                return;
            }
            const data = await response.json();
            const filtered = data.map((op: FinancialOperation) => ({
                ...op,
                localId: `saved-${op.id}`,
            }));
            setOperations(filtered);
        } catch (err) {
            console.error('Error fetching financial data:', err);
            setOperations([]);
        } finally {
            setLoading(false);
        }
    }, [date]);

    useEffect(() => {
        if (date) fetchOperations();
    }, [date, fetchOperations]);

    const saveOperation = useCallback(async (op: FinancialOperation) => {
        const isNew = op.id === -1;
        if (isEmptyOperation(op)) return;

        try {
            const method = isNew ? 'POST' : 'PUT';
            const body = isNew
                ? { date: op.date, income: op.income, expense: op.expense, description: op.description }
                : { id: op.id, income: op.income, expense: op.expense, description: op.description };

            const response = await fetch('/api/financial-data', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!response.ok) throw new Error('Failed to save');

            const savedOp = await response.json();

            // Используем функциональное обновление для предотвращения лишних ре-рендеров
            setOperations(prev => {
                const updated = prev.map(p =>
                    p.localId === op.localId
                        ? { ...savedOp, localId: op.localId }
                        : p
                );
                // Проверяем, действительно ли изменилось состояние
                const hasChanged = prev.some((p, idx) =>
                    p.localId === op.localId && (p.id !== updated[idx].id || p.income !== updated[idx].income || p.expense !== updated[idx].expense)
                );
                return hasChanged ? updated : prev;
            });
        } catch (err) {
            console.error('Save error:', err);
        }
    }, []);

    const deleteOperation = useCallback(async (id: number, localId: string) => {
        if (id === -1) {
            setOperations(prev => prev.filter(op => op.localId !== localId));
            return;
        }

        if (!confirm('Вы уверены, что хотите удалить эту операцию?')) return;

        try {
            const response = await fetch(`/api/financial-data?id=${id}`, {
                method: 'DELETE',
            });

            if (!response.ok) throw new Error('Failed to delete');

            setOperations(prev => prev.filter(op => op.id !== id));
        } catch (err) {
            console.error('Delete error:', err);
            alert('Ошибка при удалении');
        }
    }, []);

    const handleChange = useCallback((localId: string, field: 'income' | 'expense' | 'description', value: string) => {
        setOperations(prev => {
            const opIndex = prev.findIndex(op => op.localId === localId);

            if (opIndex === -1 && prev.length === 0) {
                const newOp = { ...createEmptyOperation(date), [field]: value, localId };
                newOp.profit = calculateProfit(newOp.income, newOp.expense);
                return [newOp];
            }

            const updatedOps = [...prev];
            if (opIndex === -1) {
                const newOp = { ...createEmptyOperation(date), [field]: value, localId };
                newOp.profit = calculateProfit(newOp.income, newOp.expense);
                return [...prev, newOp];
            }

            const existing = updatedOps[opIndex];
            const updated = { ...existing, [field]: value };
            updated.profit = calculateProfit(updated.income, updated.expense);
            updatedOps[opIndex] = updated;

            return updatedOps;
        });
    }, [date]);

    const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>, localId: string, rowIndex: number) => {
        const relatedTarget = e.relatedTarget as HTMLElement;
        const isSameRow = relatedTarget && relatedTarget.getAttribute('data-row-index') === String(rowIndex);

        if (isSameRow) return;

        // Сохраняем операцию без вызова setOperations, чтобы избежать ре-рендера
        setTimeout(() => {
            const op = operations.find(o => o.localId === localId);
            if (op) saveOperation(op);
        }, 200);
    }, [operations, saveOperation]);

    const displayOperations = useMemo(() => {
        const ops = [...operations];
        const lastOp = ops[ops.length - 1];

        if (!lastOp || !isEmptyOperation(lastOp)) {
            ops.push(createEmptyOperation(date));
        }

        return ops;
    }, [operations, date]);

    const totals = useMemo(() => {
        const income = operations.reduce((sum, op) => sum + (op.id === -1 ? 0 : Number(op.income || 0)), 0);
        const expense = operations.reduce((sum, op) => sum + (op.id === -1 ? 0 : Number(op.expense || 0)), 0);
        return {
            income,
            expense,
            profit: income - expense
        };
    }, [operations]);

    return {
        operations,
        displayOperations,
        loading,
        totals,
        handleChange,
        handleBlur,
        deleteOperation,
        saveOperation
    };
};
