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
  const tables = [
    'attendance_sections', 'attendance_sessions', 'audit_logs', 'classroom_student_map',
    'classrooms', 'disciplinary_records', 'exam_marks', 'exam_subjects', 'exams',
    'leaves', 'student_attendance', 'students', 'teacher_timetable', 'users'
  ];

  for (const t of tables) {
    const res = await query(`SELECT count(*) FROM "${t}";`);
    console.log(t, '->', res.data?.[0]?.count);
  }
}

main().catch(console.error);
