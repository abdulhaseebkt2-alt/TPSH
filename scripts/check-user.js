import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const token = process.env.SUPABASE_ACCESS_TOKEN;
const res = await fetch('https://api.supabase.com/v1/projects/txbjraknaaokenyvbaak/database/query', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: "SELECT id, email, full_name, approval_status, role FROM public.profiles WHERE email = 'backup2@thaibagarden.com';"
  })
});
const data = await res.json();
console.log('Result in Supabase:', data);
