import { EntitySchema } from "typeorm";

export interface UserEntity {
  id: number;
  email: string;
  password: string;
  sessionVersion: number;
}

export const UserEntitySchema = new EntitySchema<UserEntity>({
  name: "User",
  tableName: "users",
  columns: {
    id: {
      type: Number,
      primary: true,
      generated: "increment",
    },
    email: {
      type: String,
      unique: true,
    },
    password: {
      type: String,
    },
    sessionVersion: {
      type: Number,
      name: "session_version",
      default: 0,
    },
  },
});
