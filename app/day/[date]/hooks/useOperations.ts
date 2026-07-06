import { useState, useCallback, useMemo } from 'react';
import {
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query';
import { FinancialOperation } from '@/lib/types';
import { isEmptyOperation, createEmptyOperation, calculateProfit } from '../utils';

const fetchOperationsByDate = async (
    date: string,
    workspaceId: number
): Promise<FinancialOperation[]> => {
    const response = await fetch(`/api/financial-data?date=${date}&workspaceId=${workspaceId}`, {
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error('Failed to fetch operations');
    }

    return response.json();
};

export const useOperations = (date: string, workspaceId: number | null) => {
    const queryClient = useQueryClient();
    const [localOperations, setLocalOperations] = useState<FinancialOperation[] | null>(null);

    const {
        data,
        isLoading,
        isFetching,
    } = useQuery({
        queryKey: ['operations', date, workspaceId],
        queryFn: () => fetchOperationsByDate(date, workspaceId!),
        enabled: Boolean(date && workspaceId),
    });

    const hydratedOperations = useMemo(
        () =>
            (data ?? []).map((op) => ({
                ...op,
                localId: `saved-${op.id}`,
            })),
        [data]
    );

    const operations = localOperations ?? hydratedOperations;

    const saveMutation = useMutation({
        mutationFn: async (op: FinancialOperation) => {
            const isNew = op.id === -1;
            const method = isNew ? 'POST' : 'PUT';
            const body = isNew
                ? { date: op.date, income: op.income, expense: op.expense, description: op.description, workspaceId }
                : { id: op.id, income: op.income, expense: op.expense, description: op.description, workspaceId };

            const response = await fetch('/api/financial-data', {
                method,
                headers: { 'Content-Type': 'application/json' },
                keepalive: true,
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                throw new Error('Failed to save');
            }

            return response.json();
        },
        onSuccess: async (savedOp, originalOp) => {
            setLocalOperations((prev) =>
                (prev ?? hydratedOperations).map((item) =>
                    item.localId === originalOp.localId
                        ? { ...savedOp, localId: originalOp.localId }
                        : item
                )
            );

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['operations', date] }),
                queryClient.invalidateQueries({ queryKey: ['calendar-operations'] }),
            ]);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async ({ id }: { id: number }) => {
            const response = await fetch(`/api/financial-data?id=${id}&workspaceId=${workspaceId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Failed to delete');
            }
        },
        onSuccess: async (_, variables) => {
            setLocalOperations((prev) => (prev ?? hydratedOperations).filter((op) => op.id !== variables.id));
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['operations', date] }),
                queryClient.invalidateQueries({ queryKey: ['calendar-operations'] }),
            ]);
        },
    });

    const saveOperation = useCallback(async (op: FinancialOperation) => {
        if (isEmptyOperation(op) || !workspaceId) return;

        try {
            await saveMutation.mutateAsync(op);
        } catch (err) {
            console.error('Save error:', err);
        }
    }, [saveMutation, workspaceId]);

    const deleteOperation = useCallback(async (id: number, localId: string) => {
        if (id === -1) {
            setLocalOperations(prev => (prev ?? hydratedOperations).filter(op => op.localId !== localId));
            return;
        }

        if (!confirm('Вы уверены, что хотите удалить эту операцию?')) return;

        try {
            await deleteMutation.mutateAsync({ id });
        } catch (err) {
            console.error('Delete error:', err);
            alert('Ошибка при удалении');
        }
    }, [deleteMutation, hydratedOperations]);

    const handleChange = useCallback((localId: string, field: 'income' | 'expense' | 'description', value: string) => {
        setLocalOperations(prev => {
            const source = prev ?? hydratedOperations;
            const opIndex = source.findIndex(op => op.localId === localId);

            if (opIndex === -1 && source.length === 0) {
                const newOp = { ...createEmptyOperation(date), [field]: value, localId };
                newOp.profit = calculateProfit(newOp.income, newOp.expense);
                return [newOp];
            }

            const updatedOps = [...source];
            if (opIndex === -1) {
                const newOp = { ...createEmptyOperation(date), [field]: value, localId };
                newOp.profit = calculateProfit(newOp.income, newOp.expense);
                return [...source, newOp];
            }

            const existing = updatedOps[opIndex];
            const updated = { ...existing, [field]: value };
            updated.profit = calculateProfit(updated.income, updated.expense);
            updatedOps[opIndex] = updated;

            return updatedOps;
        });
    }, [date, hydratedOperations]);

    const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>, localId: string, rowIndex: number) => {
        const relatedTarget = e.relatedTarget as HTMLElement | null;
        const isSameRow = relatedTarget?.getAttribute('data-row-index') === String(rowIndex);

        if (isSameRow) return;

        setTimeout(() => {
            setLocalOperations((prev) => {
                const currentOps = prev ?? hydratedOperations;
                const op = currentOps.find((item) => item.localId === localId);
                if (op) {
                    void saveOperation(op);
                }
                return currentOps;
            });
        }, 150);
    }, [hydratedOperations, saveOperation]);

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
        loading: isLoading || isFetching,
        totals,
        handleChange,
        handleBlur,
        deleteOperation,
        saveOperation
    };
};
