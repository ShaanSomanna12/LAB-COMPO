import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import fs from 'fs';
import path from 'path';

const localDbPath = path.join(process.cwd(), 'local_mock_requests.json');

const defaultRequests = [
  { id: 'REQ-001', studentName: 'Rahul Kumar', usn: '4VV25CS045', component: 'Raspberry Pi 4 Model B', department: 'EDL', duration: 7, requestDate: '2026-04-18', status: 'Pending HOD' },
  { id: 'REQ-002', studentName: 'Aditi Sharma', usn: '4VV25EC012', component: 'RIGOL DS1054Z Oscilloscope', department: 'ECE', duration: 3, requestDate: '2026-04-18', status: 'Ready for Collection' },
  { id: 'REQ-003', studentName: 'Rohan Sharma', usn: '4VV25CS001', component: 'Arduino Mega 2560', department: 'MECH', duration: 14, requestDate: '2026-04-15', status: 'Active' },
];

function getMockRequests() {
  try {
    if (fs.existsSync(localDbPath)) {
      return JSON.parse(fs.readFileSync(localDbPath, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to read local requests fallback DB', e);
  }
  return defaultRequests;
}

function saveMockRequests(data: any) {
  try {
    fs.writeFileSync(localDbPath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed to write local requests fallback DB', e);
  }
}

export async function GET() {
  try {
    const res = await query('SELECT * FROM reservations');
    return NextResponse.json(res.rows);
  } catch (error: any) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
    console.warn('DB offline, returning mock requests:', error.message);
    return NextResponse.json(getMockRequests());
  }
}

export async function PATCH(request: Request) {
  let id = '';
  let status = '';
  let images: string[] = [];
  let geotag: any = null;
  try {
    const body = await request.json();
    id = body.id;
    status = body.status;
    images = body.images || [];
    geotag = body.geotag || null;
    const res = await query(
      'UPDATE reservations SET status = $1 WHERE reservation_id = $2 RETURNING *',
      [status, id]
    );
    return NextResponse.json({ success: true, item: res.rows[0] });
  } catch (error: any) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
    console.warn('DB offline, mock updating request:', error.message);
    const curr = getMockRequests();
    const updated = curr.map((r: any) => 
      r.id === id 
        ? { ...r, status, ...(images.length > 0 ? { images } : {}), ...(geotag ? { geotag } : {}) } 
        : r
    );
    saveMockRequests(updated);
    return NextResponse.json({ success: true, status });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { studentName, usn, items, date, time, duration, images } = body;
    
    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid items array' }, { status: 400 });
    }

    const newReservations = [];
    const requestDate = new Date().toISOString().split('T')[0];

    for (const item of items) {
      const reqId = 'REQ-' + Math.floor(1000 + Math.random() * 9000);
      const newReq = {
        id: reqId,
        studentName: studentName || 'Unknown Student',
        usn: (usn || '').toUpperCase(),
        component: item.name,
        department: item.department || 'EDL',
        duration: parseInt(duration, 10) || 7,
        requestDate,
        status: 'Pending HOD',
        images: images || [],
        time: time || '9:00 AM',
        date: date || requestDate,
        location: item.location || 'Main Lab'
      };
      newReservations.push(newReq);
    }

    // Attempt SQL DB updates (if DB schema is live)
    try {
      for (const req of newReservations) {
        // Query to mock SQL insertion if DB runs
        await query(
          'INSERT INTO reservations (user_id, component_id, status) VALUES ((SELECT user_id FROM users WHERE usn = $1 LIMIT 1), (SELECT component_id FROM components WHERE name = $2 LIMIT 1), $3)',
          [req.usn, req.component, 'PENDING']
        );
      }
    } catch (dbErr: any) {
      console.warn('Database query error routing reservation POST to Supabase:', dbErr.message);
    }

    // Save to local JSON datastore file
    const curr = getMockRequests();
    const updated = [...curr, ...newReservations];
    saveMockRequests(updated);

    return NextResponse.json({ success: true, items: newReservations });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
