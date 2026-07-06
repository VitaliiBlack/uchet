import { EntitySchema } from "typeorm";

export interface WorkspaceEntity {
  id: number;
  user_id: number;
  name: string;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const WorkspaceEntitySchema = new EntitySchema<WorkspaceEntity>({
  name: "Workspace",
  tableName: "workspaces",
  columns: {
    id: {
      type: Number,
      primary: true,
      generated: "increment",
    },
    user_id: {
      type: Number,
    },
    name: {
      type: String,
    },
    archived_at: {
      type: "timestamptz",
      nullable: true,
    },
    created_at: {
      type: "timestamptz",
      createDate: true,
    },
    updated_at: {
      type: "timestamptz",
      updateDate: true,
    },
  },
});
