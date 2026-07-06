"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Workspace, WorkspaceMembersResponse } from "@/lib/types";

const SELECTED_WORKSPACE_KEY = "uchet:selectedWorkspaceId";

const fetchWorkspaces = async (): Promise<Workspace[]> => {
  const response = await fetch("/api/workspaces", { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Failed to fetch workspaces");
  }

  return response.json();
};

const fetchWorkspaceMembers = async (
  workspaceId: number
): Promise<WorkspaceMembersResponse> => {
  const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch workspace members");
  }

  return response.json();
};

export const useWorkspaces = () => {
  const queryClient = useQueryClient();
  const [storedWorkspaceId, setStoredWorkspaceId] = useState<number | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const stored = window.localStorage.getItem(SELECTED_WORKSPACE_KEY);
    const parsed = stored ? Number(stored) : null;
    return parsed && Number.isInteger(parsed) ? parsed : null;
  });

  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ["workspaces"],
    queryFn: fetchWorkspaces,
  });

  const activeWorkspace = useMemo(() => {
    if (!workspaces.length) {
      return null;
    }

    return (
      workspaces.find((workspace) => workspace.id === storedWorkspaceId) ??
      workspaces[0]
    );
  }, [storedWorkspaceId, workspaces]);

  useEffect(() => {
    if (!activeWorkspace) {
      return;
    }

    window.localStorage.setItem(
      SELECTED_WORKSPACE_KEY,
      String(activeWorkspace.id)
    );
  }, [activeWorkspace]);

  const setActiveWorkspaceId = (workspaceId: number) => {
    setStoredWorkspaceId(workspaceId);
    window.localStorage.setItem(SELECTED_WORKSPACE_KEY, String(workspaceId));
  };

  const createWorkspace = useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error("Failed to create workspace");
      }

      return response.json() as Promise<Workspace>;
    },
    onSuccess: async (workspace) => {
      setActiveWorkspaceId(workspace.id);
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      await queryClient.invalidateQueries({ queryKey: ["calendar-operations"] });
    },
  });

  const renameWorkspace = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const response = await fetch(`/api/workspaces/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error("Failed to rename workspace");
      }

      return response.json() as Promise<Workspace>;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });

  const archiveWorkspace = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/workspaces/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to archive workspace");
      }

      return response.json() as Promise<Workspace>;
    },
    onSuccess: async () => {
      setStoredWorkspaceId(null);
      window.localStorage.removeItem(SELECTED_WORKSPACE_KEY);
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      await queryClient.invalidateQueries({ queryKey: ["calendar-operations"] });
    },
  });

  return {
    workspaces,
    activeWorkspace,
    activeWorkspaceId: activeWorkspace?.id ?? null,
    isLoading,
    setActiveWorkspaceId,
    createWorkspace,
    renameWorkspace,
    archiveWorkspace,
  };
};

export const useWorkspaceMembers = (
  workspaceId: number | null,
  enabled: boolean
) =>
  useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: () => fetchWorkspaceMembers(workspaceId!),
    enabled: Boolean(workspaceId && enabled),
  });

export const useWorkspaceMemberMutations = (workspaceId: number | null) => {
  const queryClient = useQueryClient();

  const addMember = useMutation({
    mutationFn: async (userId: number) => {
      if (!workspaceId) {
        throw new Error("Missing workspace");
      }

      const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error("Failed to add member");
      }

      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["workspace-members", workspaceId],
      });
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });

  const removeMember = useMutation({
    mutationFn: async (userId: number) => {
      if (!workspaceId) {
        throw new Error("Missing workspace");
      }

      const response = await fetch(
        `/api/workspaces/${workspaceId}/members/${userId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Failed to remove member");
      }

      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["workspace-members", workspaceId],
      });
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });

  return { addMember, removeMember };
};
