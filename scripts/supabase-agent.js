#!/usr/bin/env node
/**
 * TPS HOSTEL IRP — SUPABASE AUTOMATED SQL MIGRATION AGENT
 * 
 * Automatically applies SQL migrations and security tests to Supabase PostgreSQL.
 * Supports:
 * 1. Supabase Management API (via Personal Access Token sbp_...)
 * 2. Direct PostgreSQL Connection (via DB Password or Connection String)
 * 3. Interactive prompt mode if credentials are not in .env.local
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import readline from 'readline';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load environment variables
dotenv.config({ path: path.join(rootDir, '.env.local') });
dotenv.config({ path: path.join(rootDir, '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://txbjraknaaokenyvbaak.supabase.co';
const PROJECT_REF = extractProjectRef(SUPABASE_URL) || 'txbjraknaaokenyvbaak';

function extractProjectRef(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.split('.')[0];
  } catch {
    return null;
  }
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans.trim());
  }));
}

// HTTP request helper for Management API
function executeViaManagementApi(token, projectRef, sql) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ query: sql });
    const req = https.request({
      hostname: 'api.supabase.com',
      path: `/v1/projects/${projectRef}/database/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        } else {
          reject(new Error(`Management API error (${res.statusCode}): ${data}`));
        }
      });
    });

    req.on('error', err => reject(err));
    req.write(payload);
    req.end();
  });
}

// PostgreSQL direct runner
async function executeViaPostgres(connectionString, migrations) {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  console.log('\nConnecting to Supabase PostgreSQL database...');
  await client.connect();
  console.log('✓ Successfully connected to remote PostgreSQL!\n');

  try {
    // Migration table tracking
    await client.query(`
      CREATE TABLE IF NOT EXISTS _schema_migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const { rows: appliedRows } = await client.query('SELECT version FROM _schema_migrations;');
    const appliedVersions = new Set(appliedRows.map(r => r.version));

    for (const m of migrations) {
      if (appliedVersions.has(m.version)) {
        console.log(`- [SKIP] ${m.filename} (already applied)`);
        continue;
      }

      console.log(`▶ [APPLYING] ${m.filename}...`);
      const startTime = Date.now();
      
      await client.query('BEGIN;');
      try {
        await client.query(m.sql);
        await client.query('INSERT INTO _schema_migrations (version, name) VALUES ($1, $2);', [m.version, m.filename]);
        await client.query('COMMIT;');
        const duration = Date.now() - startTime;
        console.log(`  ✓ Applied in ${duration}ms`);
      } catch (err) {
        await client.query('ROLLBACK;');
        console.error(`\n❌ Failed to execute ${m.filename}:`);
        console.error(err.message);
        throw err;
      }
    }

    // Verify created tables
    const { rows: tableRows } = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('\n======================================================');
    console.log('   MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('======================================================');
    console.log(`Total public tables now present (${tableRows.length}):`);
    console.log(tableRows.map(t => `  • ${t.table_name}`).join('\n'));

  } finally {
    await client.end();
  }
}

async function main() {
  console.log('======================================================');
  console.log('  TPS HOSTEL IRP — SUPABASE SQL AUTOMATION AGENT');
  console.log('  Institution: Thaiba Public School');
  console.log('======================================================');
  console.log(`Target Project URL : ${SUPABASE_URL}`);
  console.log(`Project Reference  : ${PROJECT_REF}\n`);

  // 1. Gather all migration files in order
  const migrationsDir = path.join(rootDir, 'supabase', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.error(`Error: Migrations folder not found at ${migrationsDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.error('No .sql migration files found in supabase/migrations/');
    process.exit(1);
  }

  console.log(`Found ${files.length} migration files:`);
  const migrations = files.map(filename => {
    const version = filename.split('_')[0];
    const sql = fs.readFileSync(path.join(migrationsDir, filename), 'utf8');
    console.log(`  • [${version}] ${filename}`);
    return { filename, version, sql };
  });

  // 2. Determine connection credentials
  let accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  let dbPassword = process.env.SUPABASE_DB_PASSWORD;
  let dbUrl = process.env.DATABASE_URL;

  if (!accessToken && !dbPassword && !dbUrl) {
    console.log('\n------------------------------------------------------');
    console.log('No direct credentials found in .env.local.');
    console.log('Choose automated execution method:');
    console.log('  1) Supabase Personal Access Token (sbp_...)');
    console.log('  2) Supabase Database Password (for postgres user)');
    console.log('  3) Direct PostgreSQL Connection String');
    console.log('------------------------------------------------------');

    const choice = await askQuestion('Select method (1, 2, or 3): ');

    if (choice === '1') {
      console.log('\nGet your token at: https://supabase.com/dashboard/account/tokens');
      accessToken = await askQuestion('Enter Supabase Access Token (sbp_...): ');
    } else if (choice === '2') {
      console.log(`\nEnter your database password for project '${PROJECT_REF}':`);
      dbPassword = await askQuestion('Enter DB Password: ');
    } else {
      console.log('\nEnter PostgreSQL connection string:');
      dbUrl = await askQuestion('Enter Connection String: ');
    }
  }

  // Save entered credentials to .env.local for seamless future runs
  if (accessToken && !process.env.SUPABASE_ACCESS_TOKEN) {
    fs.appendFileSync(path.join(rootDir, '.env.local'), `\nSUPABASE_ACCESS_TOKEN=${accessToken}\n`);
    console.log('✓ Saved SUPABASE_ACCESS_TOKEN to .env.local');
  } else if (dbPassword && !process.env.SUPABASE_DB_PASSWORD) {
    fs.appendFileSync(path.join(rootDir, '.env.local'), `\nSUPABASE_DB_PASSWORD=${dbPassword}\n`);
    console.log('✓ Saved SUPABASE_DB_PASSWORD to .env.local');
  } else if (dbUrl && !process.env.DATABASE_URL) {
    fs.appendFileSync(path.join(rootDir, '.env.local'), `\nDATABASE_URL=${dbUrl}\n`);
    console.log('✓ Saved DATABASE_URL to .env.local');
  }

  // 3. Execute via Management API
  if (accessToken) {
    console.log(`\nExecuting ${migrations.length} migrations via Supabase Management API...`);
    for (const m of migrations) {
      console.log(`▶ [APPLYING] ${m.filename}...`);
      const startTime = Date.now();
      try {
        await executeViaManagementApi(accessToken, PROJECT_REF, m.sql);
        const duration = Date.now() - startTime;
        console.log(`  ✓ Successfully executed in ${duration}ms`);
      } catch (err) {
        console.error(`\n❌ Error applying ${m.filename}: ${err.message}`);
        process.exit(1);
      }
    }
    console.log('\n======================================================');
    console.log('   ALL SQL MIGRATIONS EXECUTED SUCCESSFULLY!');
    console.log('======================================================');
    return;
  }

  // 4. Execute via PostgreSQL Connection
  let connectionString = dbUrl;
  if (!connectionString && dbPassword) {
    // Construct standard Supabase PostgreSQL connection string
    // Standard direct host: db.[ref].supabase.co:5432
    // Encoded password in URI
    const encodedPass = encodeURIComponent(dbPassword);
    connectionString = `postgresql://postgres:${encodedPass}@db.${PROJECT_REF}.supabase.co:5432/postgres`;
  }

  if (connectionString) {
    try {
      await executeViaPostgres(connectionString, migrations);
    } catch (err) {
      // If direct host failed, try standard Supabase session pooler port 6543
      if (dbPassword && !dbUrl) {
        console.log('\nDirect connection to port 5432 failed; attempting connection pooler (port 6543)...');
        const encodedPass = encodeURIComponent(dbPassword);
        const poolerUrl = `postgresql://postgres.${PROJECT_REF}:${encodedPass}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`;
        try {
          await executeViaPostgres(poolerUrl, migrations);
        } catch (poolerErr) {
          console.error('\nPooler connection also failed:', poolerErr.message);
          process.exit(1);
        }
      } else {
        process.exit(1);
      }
    }
  }
}

main().catch(err => {
  console.error('\nFatal Agent Error:', err);
  process.exit(1);
});
