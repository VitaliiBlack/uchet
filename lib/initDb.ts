import pool from './db';

const createTables = async () => {
  const client = await pool.connect();
  try {
    // Drop old table if exists (optional)
    await client.query(`
      DROP TABLE IF EXISTS financial_data;
    `);

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
      CREATE TABLE IF NOT EXISTS financial_operations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        date DATE NOT NULL,
        income NUMERIC NOT NULL DEFAULT 0,
        expense NUMERIC NOT NULL DEFAULT 0,
        description TEXT,
        profit NUMERIC GENERATED ALWAYS AS (income - expense) STORED,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Create index on date for faster queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_financial_operations_date ON financial_operations(date);
      CREATE INDEX IF NOT EXISTS idx_financial_operations_user_date ON financial_operations(user_id, date);
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
    // Drop old table if exists (optional)
    await client.query(`
      DROP TABLE IF EXISTS user_sessions;
    `);

    // Create new sessions table
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