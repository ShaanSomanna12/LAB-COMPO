import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import fs from 'fs';
import path from 'path';

const localAccessPath = path.join(process.cwd(), 'local_mock_lab_access.json');

const defaultMockAccess = [
  {
    id: 'PASS-8041',
    studentName: 'Rohan Sharma',
    usn: '4VV25CS001',
    labName: 'CSE Lab',
    accessDate: '2026-05-28',
    timeSlot: 'Morning Shift (9:00 AM - 1:00 PM)',
    purpose: 'Working on Next.js frontend state optimization',
    status: 'APPROVED',
    adminRemarks: 'Pass granted. Please bring your institutional ID card.'
  },
  {
    id: 'PASS-3920',
    studentName: 'Rahul Kumar',
    usn: '4VV25CS045',
    labName: 'Mechanical Lab',
    accessDate: '2026-05-29',
    timeSlot: 'Full Day (9:00 AM - 5:00 PM)',
    purpose: 'Mechatronics arm torque testing',
    status: 'PENDING',
    adminRemarks: ''
  },
  {
    id: 'PASS-5291',
    studentName: 'Aditi Sharma',
    usn: '4VV25EC012',
    labName: 'ECE Lab',
    accessDate: '2026-05-27',
    timeSlot: 'Afternoon Shift (2:00 PM - 5:00 PM)',
    purpose: 'Oscilloscope frequency response validation',
    status: 'REJECTED',
    adminRemarks: 'Lab closed today for scheduled system upgrades. Please reapply for tomorrow.'
  }
];

function getMockAccess() {
  try {
    if (fs.existsSync(localAccessPath)) {
      return JSON.parse(fs.readFileSync(localAccessPath, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to read local lab access fallback', e);
  }
  return defaultMockAccess;
}

function saveMockAccess(data: any) {
  try {
    fs.writeFileSync(localAccessPath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed to write local lab access fallback', e);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const usn = searchParams.get('usn');
  
  try {
    // If table doesn't exist, this throws and goes to catch block
    let res;
    if (usn) {
      res = await query(
        'SELECT * FROM lab_access_requests WHERE UPPER(usn) = UPPER($1) ORDER BY access_date DESC',
        [usn]
      );
    } else {
      res = await query('SELECT * FROM lab_access_requests ORDER BY access_date DESC');
    }
    return NextResponse.json(res.rows);
  } catch (error: any) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
    console.warn('DB offline or table missing, returning mock lab access:', error.message);
    let mockData = getMockAccess();
    if (usn) {
      mockData = mockData.filter((item: any) => item.usn?.toUpperCase() === usn.toUpperCase());
    }
    return NextResponse.json(mockData);
  }
}

export async function POST(request: Request) {
  let body: any = {};
  try {
    body = await request.json();
    const { studentName, usn, labName, accessDate, timeSlot, purpose } = body;
    throw new Error('Database insertion not fully configured, falling back to mock JSON storage.');
  } catch (error: any) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
    console.warn('DB offline, mock creating access request:', error.message);
    
    // Map labName to its department
    let department = 'EDL';
    const name = (body.labName || '').toLowerCase();
    if (name.includes('ece') || name.includes('electronics')) {
      department = 'ECE';
    } else if (name.includes('eee') || name.includes('electrical')) {
      department = 'EEE';
    } else if (name.includes('mech') || name.includes('mechanical')) {
      department = 'MECH';
    } else if (name.includes('edl') || name.includes('development') || name.includes('engineering') || name.includes('cse') || name.includes('computer') || name.includes('science')) {
      department = 'EDL';
    }

    const newRequest = {
      id: `PASS-${Math.floor(1000 + Math.random() * 9000)}`,
      studentName: body.studentName,
      usn: body.usn,
      labName: body.labName,
      department: body.department || department,
      accessDate: body.accessDate || new Date().toISOString().split('T')[0],
      timeSlot: body.timeSlot,
      purpose: body.purpose || '',
      status: 'PENDING_HOD',
      hodRemarks: '',
      adminRemarks: ''
    };
    const curr = getMockAccess();
    curr.push(newRequest);
    saveMockAccess(curr);
    return NextResponse.json({ success: true, item: newRequest });
  }
}

export async function PATCH(request: Request) {
  let body: any = {};
  try {
    body = await request.json();
    const { id, status, adminRemarks, hodRemarks } = body;
    let res;
    if (hodRemarks !== undefined && adminRemarks !== undefined) {
      res = await query(
        'UPDATE lab_access_requests SET status = $1, admin_remarks = $2, hod_remarks = $3 WHERE request_id = $4 RETURNING *',
        [status, adminRemarks, hodRemarks, id]
      );
    } else if (hodRemarks !== undefined) {
      res = await query(
        'UPDATE lab_access_requests SET status = $1, hod_remarks = $2 WHERE request_id = $3 RETURNING *',
        [status, hodRemarks, id]
      );
    } else if (adminRemarks !== undefined) {
      res = await query(
        'UPDATE lab_access_requests SET status = $1, admin_remarks = $2 WHERE request_id = $3 RETURNING *',
        [status, adminRemarks, id]
      );
    } else {
      res = await query(
        'UPDATE lab_access_requests SET status = $1 WHERE request_id = $2 RETURNING *',
        [status, id]
      );
    }
    return NextResponse.json({ success: true, item: res.rows[0] });
  } catch (error: any) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
    console.warn('DB offline, mock updating access request:', error.message);
    const { id, status, adminRemarks, hodRemarks } = body;
    const curr = getMockAccess();
    const updated = curr.map((req: any) => {
      if (req.id === id) {
        const u = { ...req };
        if (status !== undefined) u.status = status;
        if (adminRemarks !== undefined) u.adminRemarks = adminRemarks;
        if (hodRemarks !== undefined) u.hodRemarks = hodRemarks;
        return u;
      }
      return req;
    });
    saveMockAccess(updated);
    return NextResponse.json({ success: true, item: updated.find((r: any) => r.id === id) });
  }
}
