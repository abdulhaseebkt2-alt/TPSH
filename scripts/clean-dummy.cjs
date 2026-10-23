const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://txbjraknaaokenyvbaak.supabase.co', 'sb_publishable_tQAL8-iV3gI61WeUjt_KrQ_VUzK_uS7');

async function deleteAllDummy() {
  const { data: all, error: fetchErr } = await supabase.from('students').select('id, full_name, admission_number');
  if (fetchErr) {
    console.error('Fetch error:', fetchErr);
    return;
  }
  const dummyIds = all.filter(s => 
    (s.full_name && s.full_name.toLowerCase().includes('test')) ||
    (s.full_name && s.full_name.toLowerCase().includes('group')) ||
    (s.full_name && s.full_name.toLowerCase().includes('stayed')) ||
    (s.full_name && s.full_name.toLowerCase().includes('dummy')) ||
    s.admission_number === 'TPS2022078'
  ).map(s => s.id);

  console.log('Dummy IDs count to delete:', dummyIds.length);
  for (const id of dummyIds) {
    const res = await supabase.from('students').delete().eq('id', id).select();
    console.log('Deleted id:', id, 'status:', res.status, 'deleted rows:', res.data ? res.data.length : 0);
  }

  const { data: remaining } = await supabase.from('students').select('admission_number, full_name').order('admission_number', { ascending: true });
  console.log('Total remaining count:', remaining ? remaining.length : 0);
  if (remaining) {
    remaining.forEach((s, idx) => console.log((idx + 1) + '. ' + s.admission_number + ': ' + s.full_name));
  }
}
deleteAllDummy();
