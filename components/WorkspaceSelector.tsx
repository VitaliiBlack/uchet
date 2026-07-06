"use client";

import { useState } from "react";
import styles from "./WorkspaceSelector.module.css";
import {
  useWorkspaceMemberMutations,
  useWorkspaceMembers,
  useWorkspaces,
} from "./useWorkspaces";

interface WorkspaceSelectorProps {
  compact?: boolean;
}

export default function WorkspaceSelector({ compact = false }: WorkspaceSelectorProps) {
  const [sharingOpen, setSharingOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
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
  const canManageWorkspace = Boolean(activeWorkspace?.is_owner);
  const membersQuery = useWorkspaceMembers(
    activeWorkspaceId,
    sharingOpen && canManageWorkspace
  );
  const { addMember, removeMember } = useWorkspaceMemberMutations(activeWorkspaceId);

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

  const handleAddMember = async () => {
    const userId = Number(
      selectedUserId || membersQuery.data?.availableUsers[0]?.id
    );

    if (!Number.isInteger(userId) || userId <= 0) {
      return;
    }

    await addMember.mutateAsync(userId);
    setSelectedUserId("");
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
            {workspace.name}{workspace.is_owner ? "" : " (совм.)"}
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

      {!compact && canManageWorkspace && (
        <>
          <button
            type="button"
            className={styles.accessButton}
            onClick={() => setSharingOpen(true)}
            title="Поделиться магазином"
            aria-label="Поделиться магазином"
            disabled={!activeWorkspace}
          >
            Доступ
          </button>
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

      {sharingOpen && activeWorkspace && canManageWorkspace && (
        <>
          <button
            type="button"
            className={styles.shareBackdrop}
            aria-label="Закрыть доступ"
            onClick={() => setSharingOpen(false)}
          />
          <div className={styles.sharePanel} role="dialog" aria-modal="true">
            <div className={styles.shareHeader}>
              <div>
                <h2>Доступ к магазину</h2>
                <p>{activeWorkspace.name}</p>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setSharingOpen(false)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>

            <div className={styles.shareSection}>
              <h3>Соавторы</h3>
              {membersQuery.isLoading ? (
                <p className={styles.mutedText}>Загрузка...</p>
              ) : membersQuery.data?.members.length ? (
                <div className={styles.memberList}>
                  {membersQuery.data.members.map((member) => (
                    <div key={member.id} className={styles.memberRow}>
                      <span>{member.email}</span>
                      <button
                        type="button"
                        className={styles.removeButton}
                        onClick={() => removeMember.mutateAsync(member.id)}
                      >
                        Убрать
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.mutedText}>Пока нет соавторов</p>
              )}
            </div>

            <div className={styles.shareSection}>
              <h3>Добавить пользователя</h3>
              {membersQuery.data?.availableUsers.length ? (
                <div className={styles.addMemberRow}>
                  <select
                    className={styles.memberSelect}
                    value={selectedUserId}
                    onChange={(event) => setSelectedUserId(event.target.value)}
                    aria-label="Выбрать пользователя"
                  >
                    {membersQuery.data.availableUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.email}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={styles.addButton}
                    onClick={handleAddMember}
                    disabled={addMember.isPending}
                  >
                    Добавить
                  </button>
                </div>
              ) : (
                <p className={styles.mutedText}>Некого добавить</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
