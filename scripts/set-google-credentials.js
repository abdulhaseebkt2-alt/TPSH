import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const token = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = 'txbjraknaaokenyvbaak';

const clientId = process.argv[2] || process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.argv[3] || process.env.GOOGLE_CLIENT_SECRET;

if (!token) {
  console.error('Error: SUPABASE_ACCESS_TOKEN is missing in .env.local');
  process.exit(1);
}

if (!clientId || !clientSecret) {
  console.log('Usage: node scripts/set-google-credentials.js <CLIENT_ID> <CLIENT_SECRET>');
  console.log('Or add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local and run.');
  process.exit(1);
}

async function configureGoogleProvider() {
  console.log(`Configuring Google Provider on Supabase project ${projectRef}...`);
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        external_google_enabled: true,
        external_google_client_id: clientId.trim(),
        external_google_secret: clientSecret.trim(),
        site_url: 'http://localhost:5173',
        uri_allow_list: 'http://localhost:5173/**,http://localhost:5173,http://127.0.0.1:5173'
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Supabase API responded with status ${res.status}: ${err}`);
    }

    const data = await res.json();
    console.log('✓ Google OAuth credentials successfully configured in Supabase!');
    console.log(`- Google Enabled: ${data.external_google_enabled}`);
    console.log(`- Client ID: ${data.external_google_client_id ? 'Configured' : 'Missing'}`);
    console.log(`- Redirect Callback: https://${projectRef}.supabase.co/auth/v1/callback`);
  } catch (err) {
    console.error('Failed to configure Google provider:', err.message);
    process.exit(1);
  }
}

configureGoogleProvider();
