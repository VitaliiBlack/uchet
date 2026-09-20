// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  setSelectedWorkspaceId,
  useSelectedWorkspaceId,
} from '@/components/workspaceSelectionStore';
import { renderHook, act } from '@testing-library/react';

describe('workspaceSelectionStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists and reads the selected workspace id', () => {
    const { result } = renderHook(() => useSelectedWorkspaceId());
    expect(result.current).toBeNull();

    act(() => setSelectedWorkspaceId(42));
    expect(window.localStorage.getItem('uchet:selectedWorkspaceId')).toBe('42');
    expect(result.current).toBe(42);
  });

  it('clears selection with null', () => {
    setSelectedWorkspaceId(7);
    setSelectedWorkspaceId(null);
    expect(window.localStorage.getItem('uchet:selectedWorkspaceId')).toBeNull();
  });
});
