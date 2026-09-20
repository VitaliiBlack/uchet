// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({ signOut: vi.fn(), session: { current: null as unknown } }));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: h.session.current }),
  signOut: h.signOut,
}));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === 'string' ? href : '#'}>{children}</a>
  ),
}));

import AppMenu from '@/components/AppMenu';

afterEach(() => {
  cleanup();
  h.signOut.mockReset();
});

const open = () => fireEvent.click(screen.getByRole('button', { name: 'Открыть меню' }));

describe('AppMenu', () => {
  it('opens the sheet with quick actions and the user email', () => {
    h.session.current = { user: { email: 'user@test.dev' } };
    render(<AppMenu />);
    open();
    expect(screen.getByText('Меню')).toBeInTheDocument();
    expect(screen.getByText('user@test.dev')).toBeInTheDocument();
    expect(screen.getByText('Главная')).toBeInTheDocument();
    expect(screen.getByText('Сегодня')).toBeInTheDocument();
  });

  it('signs the user out', () => {
    h.session.current = { user: { email: 'user@test.dev' } };
    render(<AppMenu />);
    open();
    fireEvent.click(screen.getByRole('button', { name: /Выйти/ }));
    expect(h.signOut).toHaveBeenCalledTimes(1);
  });

  it('offers a login link when unauthenticated', () => {
    h.session.current = null;
    render(<AppMenu />);
    open();
    expect(screen.getByText('Войти')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Выйти/ })).toBeNull();
  });

  it('closes on Escape', () => {
    h.session.current = null;
    render(<AppMenu />);
    open();
    expect(screen.getByText('Меню')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('Меню')).toBeNull();
  });
});
