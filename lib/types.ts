export interface FinancialOperation {
    id: number;
    workspace_id?: number;
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

export interface Workspace {
    id: number;
    user_id: number;
    name: string;
    archived_at: string | null;
    created_at: string;
    updated_at: string;
}
