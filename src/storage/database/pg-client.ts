import { Pool } from 'pg';

let pool: Pool | null = null;

function getPgConnectionString(): string {
  // 优先从环境变量获取直连URL
  if (process.env.PGDATABASE_URL) {
    return process.env.PGDATABASE_URL;
  }

  // 尝试从coze_workload_identity获取
  try {
    const { execSync } = require('child_process');
    const pythonCode = `
import os, sys
try:
    from coze_workload_identity import Client
    client = Client()
    env_vars = client.get_project_env_vars()
    client.close()
    for env_var in env_vars:
        if env_var.key == 'PGDATABASE_URL':
            print(env_var.value)
except Exception as e:
    print(f"# Error: {e}", file=sys.stderr)
`;
    const output = execSync(`python3 -c '${pythonCode.replace(/'/g, "'\"'\"'")}'`, {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const url = output.trim().split('\n').find((line: string) => !line.startsWith('#'));
    if (url) {
      process.env.PGDATABASE_URL = url;
      return url;
    }
  } catch {
    // Silent
  }

  throw new Error('PGDATABASE_URL is not set');
}

export function getPgPool(): Pool {
  if (!pool) {
    const connectionString = getPgConnectionString();
    pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

/**
 * 执行SQL查询并返回结果
 * 用于绕过PostgREST schema cache问题，直接查询数据库
 */
export async function pgQuery<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const client = getPgPool();
  const result = await client.query<T>(sql, params);
  return result.rows;
}

/**
 * 执行SQL并返回单行结果
 */
export async function pgQueryOne<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await pgQuery<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * 执行INSERT/UPDATE/DELETE并返回影响的行数
 */
export async function pgExecute(sql: string, params?: unknown[]): Promise<number> {
  const client = getPgPool();
  const result = await client.query(sql, params);
  return result.rowCount ?? 0;
}

/**
 * 执行INSERT并返回生成的行（带RETURNING *）
 */
export async function pgInsert<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T> {
  const client = getPgPool();
  const result = await client.query<T>(sql, params);
  return result.rows[0];
}
