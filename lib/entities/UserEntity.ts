import { EntitySchema } from "typeorm";

export interface UserEntity {
  id: number;
  email: string;
  password: string;
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
  },
});
