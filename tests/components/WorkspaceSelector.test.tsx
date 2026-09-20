// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

afterEach(() => cleanup());

const h = vi.hoisted(() => ({
  addMemberMutate: vi.fn(),
  removeMemberMutate: vi.fn(),
  respondMutate: vi.fn(),
  workspacesState: { current: {} as Record<string, unknown> },
  membersState: { current: {} as Record<string, unknown> },
  invitationsState: { current: [] as unknown[] },
}));

vi.mock('@/components/useWorkspaces', () => ({
  useWorkspaces: () => h.workspacesState.current,
  useWorkspaceMembers: () => h.membersState.current,
  useWorkspaceMemberMutations: () => ({
    addMember: { mutateAsync: h.addMemberMutate, isPending: false },
    removeMember: { mutateAsync: h.removeMemberMutate, isPending: false },
  }),
  useInvitations: () => ({ data: h.invitationsState.current }),
  useInvitationMutations: () => ({
    respond: { mutateAsync: h.respondMutate, isPending: false },
  }),
}));

import WorkspaceSelector from '@/components/WorkspaceSelector';

const ownerWorkspace = {
  id: 1,
  user_id: 1,
  name: 'Shop A',
  archived_at: null,
  created_at: '',
  updated_at: '',
  access_role: 'owner',
  is_owner: true,
};
const sharedWorkspace = {
  id: 2,
  user_id: 9,
  name: 'Shared B',
  archived_at: null,
  created_at: '',
  updated_at: '',
  access_role: 'editor',
  is_owner: false,
};

const setState = (isOwner: boolean) => {
  h.workspacesState.current = {
    workspaces: [ownerWorkspace, sharedWorkspace],
    activeWorkspace: isOwner ? ownerWorkspace : sharedWorkspace,
    activeWorkspaceId: isOwner ? 1 : 2,
    isLoading: false,
    setActiveWorkspaceId: vi.fn(),
    createWorkspace: { mutateAsync: vi.fn() },
    renameWorkspace: { mutateAsync: vi.fn() },
    archiveWorkspace: { mutateAsync: vi.fn() },
  };
  h.membersState.current = {
    data: { members: [{ id: 7, email: 'collab@test.dev', role: 'editor', created_at: '' }] },
    isLoading: false,
  };
};

describe('WorkspaceSelector sharing panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks shared workspaces and shows shop list', () => {
    setState(true);
    render(<WorkspaceSelector />);
    expect(screen.getByRole('option', { name: 'Shop A' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Shared B (совм.)' })).toBeInTheDocument();
  });

  it('shows the sharing button only to the owner', () => {
    setState(false);
    const { unmount } = render(<WorkspaceSelector />);
    expect(screen.queryByRole('button', { name: 'Поделиться магазином' })).toBeNull();
    unmount();

    setState(true);
    render(<WorkspaceSelector />);
    expect(screen.getByRole('button', { name: 'Поделиться магазином' })).toBeInTheDocument();
  });

  it('opens the panel with an email input and no user-list leak', () => {
    setState(true);
    render(<WorkspaceSelector />);
    fireEvent.click(screen.getByRole('button', { name: 'Поделиться магазином' }));

    expect(screen.getByRole('heading', { name: 'Доступ к магазину' })).toBeInTheDocument();
    expect(screen.getByText('collab@test.dev')).toBeInTheDocument();

    const emailInput = screen.getByLabelText('Email пользователя');
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(emailInput).toHaveAttribute('placeholder', 'email@example.com');
    // the old "availableUsers" dropdown must be gone
    expect(screen.queryByRole('combobox', { name: 'Выбрать пользователя' })).toBeNull();
  });

  it('adds a collaborator by email (trimmed)', () => {
    setState(true);
    render(<WorkspaceSelector />);
    fireEvent.click(screen.getByRole('button', { name: 'Поделиться магазином' }));

    const emailInput = screen.getByLabelText('Email пользователя');
    const addButton = screen.getByRole('button', { name: 'Добавить' });
    expect(addButton).toBeDisabled();

    fireEvent.change(emailInput, { target: { value: '  newbie@test.dev ' } });
    expect(addButton).toBeEnabled();
    fireEvent.click(addButton);

    expect(h.addMemberMutate).toHaveBeenCalledWith('newbie@test.dev');
  });
});
