import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';
import { Pool } from 'pg';

const ORDERED_SQL_FILES = [
  'bootstrap_core_tables.sql',
  'users_feature_flags.sql',
  'styles_versioning.sql',
  'tasks_progress.sql',
  'tasks_cancelable.sql',
  'request_logs.sql',
  'error_logs.sql',
  'api_call_logs.sql',
  'user_events.sql',
  'model_providers.sql',
  'prompt_safety_word_bank.sql',
  'ab_tests.sql',
  'image_cache.sql',
];

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`MISSING_ENV:${name}`);
  }
  return value.trim();
}

async function run(): Promise<void> {
  const dbUrl = requiredEnv('DATABASE_URL');
  const sqlDir = path.resolve(process.cwd(), 'sql');
  const pool = new Pool({ connectionString: dbUrl });

  try {
    for (const filename of ORDERED_SQL_FILES) {
      const fullPath = path.join(sqlDir, filename);
      const sql = await fs.readFile(fullPath, 'utf8');
      await pool.query(sql);
      // eslint-disable-next-line no-console
      console.info(`applied: ${filename}`);
    }
  } finally {
    await pool.end();
  }

  // eslint-disable-next-line no-console
  console.info('database migration complete');
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('migration failed', error);
  process.exit(1);
});
