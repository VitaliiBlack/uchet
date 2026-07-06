"use client";

import { useSyncExternalStore } from "react";

const SELECTED_WORKSPACE_KEY = "uchet:selectedWorkspaceId";
const SELECTED_WORKSPACE_EVENT = "uchet:selectedWorkspaceChanged";

const readSelectedWorkspaceId = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem(SELECTED_WORKSPACE_KEY);
  const parsed = stored ? Number(stored) : null;

  return parsed && Number.isInteger(parsed) ? parsed : null;
};

const emitSelectedWorkspaceChange = () => {
  window.dispatchEvent(new Event(SELECTED_WORKSPACE_EVENT));
};

export const setSelectedWorkspaceId = (workspaceId: number | null) => {
  if (typeof window === "undefined") {
    return;
  }

  if (workspaceId && Number.isInteger(workspaceId)) {
    window.localStorage.setItem(SELECTED_WORKSPACE_KEY, String(workspaceId));
  } else {
    window.localStorage.removeItem(SELECTED_WORKSPACE_KEY);
  }

  emitSelectedWorkspaceChange();
};

export const useSelectedWorkspaceId = () =>
  useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener(SELECTED_WORKSPACE_EVENT, onStoreChange);
      window.addEventListener("storage", onStoreChange);

      return () => {
        window.removeEventListener(SELECTED_WORKSPACE_EVENT, onStoreChange);
        window.removeEventListener("storage", onStoreChange);
      };
    },
    readSelectedWorkspaceId,
    () => null
  );
