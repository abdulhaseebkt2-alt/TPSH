import https from 'https';

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
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  const tables = await query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;");
  console.log('Tables:', tables);

  const cols = await query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position;");
  console.log('Columns count:', cols.data?.length);
  console.log('Sample columns:', cols.data?.slice(0, 30));
}

main().catch(console.error);
