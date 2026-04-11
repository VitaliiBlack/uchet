import { EntitySchema } from "typeorm";

export interface FinancialOperationEntity {
  id: number;
  user_id: number;
  date: string;
  income: string;
  expense: string;
  description: string | null;
  profit: string;
}

export const FinancialOperationEntitySchema =
  new EntitySchema<FinancialOperationEntity>({
    name: "FinancialOperation",
    tableName: "financial_operations",
    columns: {
      id: {
        type: Number,
        primary: true,
        generated: "increment",
      },
      user_id: {
        type: Number,
      },
      date: {
        type: "date",
      },
      income: {
        type: "numeric",
      },
      expense: {
        type: "numeric",
      },
      description: {
        type: "text",
        nullable: true,
      },
      profit: {
        type: "numeric",
        insert: false,
        update: false,
      },
    },
  });
