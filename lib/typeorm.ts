import "reflect-metadata";
import { DataSource } from "typeorm";
import {
  UserEntitySchema,
  type UserEntity,
} from "@/lib/entities/UserEntity";
import {
  FinancialOperationEntitySchema,
  type FinancialOperationEntity,
} from "@/lib/entities/FinancialOperationEntity";

declare global {
  var __uchetDataSource__: Promise<DataSource> | undefined;
}

const createDataSource = async () => {
  const dataSource = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    synchronize: false,
    migrationsRun: false,
    logging: false,
    entities: [UserEntitySchema, FinancialOperationEntitySchema],
  });

  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  return dataSource;
};

export const getDataSource = async () => {
  if (!global.__uchetDataSource__) {
    global.__uchetDataSource__ = createDataSource();
  }

  return global.__uchetDataSource__;
};

export const getUserRepository = async () =>
  (await getDataSource()).getRepository<UserEntity>("User");

export const getFinancialOperationRepository = async () =>
  (await getDataSource()).getRepository<FinancialOperationEntity>("FinancialOperation");
