import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const token = process.env.SUPABASE_ACCESS_TOKEN || '';
const projectRef = 'txbjraknaaokenyvbaak';

function query(sql) {
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
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Status ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('Running Supabase Live PostgreSQL Security Tests...');
  const testSql = fs.readFileSync(path.join(rootDir, 'supabase', 'tests', 'rls_security_tests.sql'), 'utf8');

  try {
    const res = await query(testSql);
    console.log('✓ All database-level security and RLS tests executed successfully!');
    console.log('Test output:', res);
  } catch (err) {
    console.error('Test execution error:', err.message);
  }
}

runTests();
