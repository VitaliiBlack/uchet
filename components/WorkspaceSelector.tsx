"use client";

import styles from "./WorkspaceSelector.module.css";
import { useWorkspaces } from "./useWorkspaces";

interface WorkspaceSelectorProps {
  compact?: boolean;
}

export default function WorkspaceSelector({ compact = false }: WorkspaceSelectorProps) {
  const {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    isLoading,
    setActiveWorkspaceId,
    createWorkspace,
    renameWorkspace,
    archiveWorkspace,
  } = useWorkspaces();

  const handleCreate = async () => {
    const name = window.prompt("Название магазина");
    const normalizedName = name?.trim();
    if (!normalizedName) {
      return;
    }

    await createWorkspace.mutateAsync(normalizedName);
  };

  const handleRename = async () => {
    if (!activeWorkspace) {
      return;
    }

    const name = window.prompt("Новое название магазина", activeWorkspace.name);
    const normalizedName = name?.trim();
    if (!normalizedName || normalizedName === activeWorkspace.name) {
      return;
    }

    await renameWorkspace.mutateAsync({
      id: activeWorkspace.id,
      name: normalizedName,
    });
  };

  const handleArchive = async () => {
    if (!activeWorkspace) {
      return;
    }

    const confirmed = window.confirm(
      `Архивировать магазин "${activeWorkspace.name}"? Операции не удалятся.`
    );
    if (!confirmed) {
      return;
    }

    await archiveWorkspace.mutateAsync(activeWorkspace.id);
  };

  return (
    <div className={styles.workspaceControl}>
      <select
        aria-label="Выбрать магазин"
        className={styles.workspaceSelect}
        disabled={isLoading || !workspaces.length}
        value={activeWorkspaceId ?? ""}
        onChange={(event) => setActiveWorkspaceId(Number(event.target.value))}
      >
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name}
          </option>
        ))}
      </select>

      <button
        type="button"
        className={styles.iconButton}
        onClick={handleCreate}
        title="Добавить магазин"
        aria-label="Добавить магазин"
      >
        +
      </button>

      {!compact && (
        <>
          <button
            type="button"
            className={styles.iconButton}
            onClick={handleRename}
            title="Переименовать магазин"
            aria-label="Переименовать магазин"
            disabled={!activeWorkspace}
          >
            ✎
          </button>
          <button
            type="button"
            className={`${styles.iconButton} ${styles.danger}`}
            onClick={handleArchive}
            title="Архивировать магазин"
            aria-label="Архивировать магазин"
            disabled={!activeWorkspace}
          >
            ×
          </button>
        </>
      )}
    </div>
  );
}
