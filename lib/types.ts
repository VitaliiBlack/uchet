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
    access_role: 'owner' | 'editor';
    is_owner: boolean;
}

export interface WorkspaceMember {
    id: number;
    email: string;
    role: 'editor';
    created_at: string;
}

export interface WorkspaceUserOption {
    id: number;
    email: string;
}

export interface WorkspaceMembersResponse {
    members: WorkspaceMember[];
    availableUsers: WorkspaceUserOption[];
}
