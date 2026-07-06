import pool from './db';

const createTables = async () => {
  const client = await pool.connect();
  try {
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL
      );
    `);

    // Create new operations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        archived_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS financial_operations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        workspace_id INTEGER,
        date DATE NOT NULL,
        income NUMERIC NOT NULL DEFAULT 0,
        expense NUMERIC NOT NULL DEFAULT 0,
        description TEXT,
        profit NUMERIC GENERATED ALWAYS AS (income - expense) STORED,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
      );
    `);

    // Create index on date for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_financial_operations_date ON financial_operations(date);
      CREATE INDEX IF NOT EXISTS idx_financial_operations_user_date ON financial_operations(user_id, date);
      CREATE INDEX IF NOT EXISTS idx_financial_operations_user_workspace_date ON financial_operations(user_id, workspace_id, date);
      CREATE INDEX IF NOT EXISTS idx_workspaces_user_active ON workspaces(user_id, archived_at, id);
    `);

    console.log('Tables created successfully');
  } catch (err) {
    console.error('Error creating tables:', err);
  } finally {
    client.release();
  }
};

const createSessionsTable = async () => {
  const client = await pool.connect();
  try {
    // Keep the bootstrap additive only; never drop or reshape tables here.
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Create index on token for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token);
    `);

    console.log('Sessions table created successfully');
  } catch (err) {
    console.error('Error creating sessions table:', err);
  } finally {
    client.release();
  }
};

const initializeDatabase = async () => {
  try {
    console.log('Starting database initialization...');
    await createTables();
    await createSessionsTable();
    console.log('Database initialization completed successfully');
  } catch (err) {
    console.error('Critical failure during database initialization:', err);
  } finally {
    // Optional: Only process.exit if run as a script
    if (require.main === module) {
      await pool.end();
    }
  }
};

if (require.main === module) {
  initializeDatabase().catch(e => {
    console.error("Failed to initialize database", e);
    process.exit(1);
  });
}

export { initializeDatabase };
