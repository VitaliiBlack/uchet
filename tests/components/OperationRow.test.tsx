// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { OperationRow } from '@/app/day/[date]/components/OperationRow';
import type { FinancialOperation } from '@/lib/types';

afterEach(() => cleanup());

const baseOp: FinancialOperation = {
  id: -1,
  date: '2026-09-01',
  income: '',
  expense: '',
  description: '',
  profit: 0,
  localId: 'local-1',
};

const renderRow = (overrides: Partial<FinancialOperation> = {}, isLastEmpty = false) => {
  const onChange = vi.fn();
  const onDelete = vi.fn();
  render(
    <table>
      <tbody>
        <OperationRow
          op={{ ...baseOp, ...overrides }}
          rowIndex={0}
          onChange={onChange}
          onBlur={vi.fn()}
          onKeyDown={vi.fn()}
          onFocusCell={vi.fn()}
          onDelete={onDelete}
          registerRef={vi.fn()}
          isLastEmpty={isLastEmpty}
        />
      </tbody>
    </table>
  );
  return { onChange, onDelete };
};

describe('OperationRow', () => {
  it('renders income/expense/description inputs', () => {
    renderRow();
    expect(screen.getAllByPlaceholderText('0')).toHaveLength(2);
    expect(screen.getByPlaceholderText('Описание')).toBeInTheDocument();
  });

  it('hides the delete button for the trailing empty row', () => {
    renderRow({}, true);
    expect(screen.queryByRole('button', { name: 'Удалить операцию' })).toBeNull();
  });

  it('shows the delete button for non-empty rows', () => {
    renderRow({}, false);
    expect(screen.getByRole('button', { name: 'Удалить операцию' })).toBeInTheDocument();
  });

  it('reports income edits via onChange', () => {
    const { onChange } = renderRow();
    fireEvent.change(screen.getAllByPlaceholderText('0')[0], { target: { value: '1500' } });
    expect(onChange).toHaveBeenCalledWith('local-1', 'income', '1500');
  });

  it('reports the delete action', () => {
    const { onDelete } = renderRow({ id: 5, localId: 'saved-5' });
    fireEvent.click(screen.getByRole('button', { name: 'Удалить операцию' }));
    expect(onDelete).toHaveBeenCalledWith(5, 'saved-5');
  });
});
