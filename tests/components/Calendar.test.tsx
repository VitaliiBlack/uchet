// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({
  routerPush: vi.fn(),
  workspaces: { current: {} as Record<string, unknown> },
  queryData: { current: [] as unknown[] },
  queryLoading: { current: false },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: h.routerPush, back: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/components/useWorkspaces', () => ({
  useWorkspaces: () => h.workspaces.current,
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: h.queryData.current, isLoading: h.queryLoading.current }),
}));
vi.mock('@/components/AppMenu', () => ({ default: () => <div data-testid="app-menu" /> }));
vi.mock('@/components/WorkspaceSelector', () => ({ default: () => <div data-testid="ws" /> }));

import Calendar from '@/components/Calendar';

afterEach(() => {
  cleanup();
  h.routerPush.mockReset();
});

const ready = (ops: unknown[] = []) => {
  h.workspaces.current = {
    activeWorkspaceId: 1,
    isLoading: false,
    createWorkspace: { mutateAsync: vi.fn() },
  };
  h.queryData.current = ops;
  h.queryLoading.current = false;
};

const op = (date: string, income: number, expense: number, description = 'x') => ({
  id: Math.random(),
  date,
  income,
  expense,
  description,
  profit: income - expense,
});

describe('Calendar', () => {
  it('renders the calendar grid and day cells', () => {
    ready();
    render(<Calendar />);
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Открыть день/ }).length).toBeGreaterThan(27);
  });

  it('opens a day with the correct route', () => {
    ready();
    render(<Calendar />);
    const dayButtons = screen.getAllByRole('button', { name: /Открыть день/ });
    fireEvent.click(dayButtons[0]);
    expect(h.routerPush).toHaveBeenCalledWith(
      expect.stringMatching(/^\/day\/\d{4}-\d{2}-\d{2}$/)
    );
  });

  it('shows the "no shops" state when the user has no workspace', () => {
    h.workspaces.current = {
      activeWorkspaceId: null,
      isLoading: false,
      createWorkspace: { mutateAsync: vi.fn() },
    };
    h.queryData.current = [];
    h.queryLoading.current = false;
    render(<Calendar />);
    expect(screen.getByText('Нет доступных магазинов')).toBeInTheDocument();
  });

  it('shows a loading state', () => {
    h.workspaces.current = { activeWorkspaceId: 1, isLoading: true, createWorkspace: { mutateAsync: vi.fn() } };
    h.queryData.current = [];
    h.queryLoading.current = true;
    render(<Calendar />);
    expect(screen.getByText('Загрузка данных...')).toBeInTheDocument();
  });

  it('navigates months with prev/next controls', () => {
    ready();
    render(<Calendar />);
    const title = screen.getByRole('heading', { level: 2 }).textContent;
    fireEvent.click(screen.getByRole('button', { name: 'Предыдущий месяц' }));
    expect(screen.getByRole('heading', { level: 2 }).textContent).not.toBe(title);
    fireEvent.click(screen.getByRole('button', { name: 'Следующий месяц' }));
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(title);
  });

  it('renders daily income/expense for a day with operations', () => {
    // use today so the day is inside the current month view
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    ready([op(key, 120, 20, 'sale')]);
    render(<Calendar />);
    // value appears both in the day cell and in the monthly summary
    expect(screen.getAllByText('120').length).toBeGreaterThan(0);
    expect(screen.getAllByText('20').length).toBeGreaterThan(0);
  });
});
