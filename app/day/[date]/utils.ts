import { FinancialOperation } from '@/lib/types';

export const isEmptyOperation = (op: FinancialOperation) => {
    return (
        String(op.income) === '' &&
        String(op.expense) === '' &&
        (!op.description || op.description.trim() === '')
    );
};

export const generateLocalId = () => `local-${Math.random().toString(36).substr(2, 9)}`;

export const calculateProfit = (income: string | number, expense: string | number): number => {
    const inc = income === '' ? 0 : Number(income);
    const exp = expense === '' ? 0 : Number(expense);
    return inc - exp;
};

export const createEmptyOperation = (date: string): FinancialOperation => ({
    id: -1,
    date,
    income: '',
    expense: '',
    description: '',
    profit: 0,
    localId: generateLocalId(),
});
