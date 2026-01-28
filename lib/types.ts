export interface FinancialOperation {
    id: number;
    date: string; // ISO format or YYYY-MM-DD
    income: number | string;
    expense: number | string;
    description?: string;
    profit: number;
    localId?: string; // Used in frontend for stable keys
}

export interface User {
    id: string;
    email: string;
}
