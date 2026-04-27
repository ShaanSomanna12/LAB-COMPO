import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

const mockRequests = [
  { id: 'REQ-001', studentName: 'Rahul Kumar', usn: '4VV25CS045', component: 'Raspberry Pi 4 Model B', department: 'CSE', duration: 7, requestDate: '2026-04-18', status: 'Pending HOD' },
  { id: 'REQ-002', studentName: 'Aditi Sharma', usn: '4VV25EC012', component: 'RIGOL DS1054Z Oscilloscope', department: 'ECE', duration: 3, requestDate: '2026-04-18', status: 'Ready for Collection' },
  { id: 'REQ-003', studentName: 'Shaan Somanna', usn: '4VV25CS001', component: 'Arduino Mega 2560', department: 'MECH', duration: 14, requestDate: '2026-04-15', status: 'Active' },
];

export async function GET() {
  try {
    const res = await query('SELECT * FROM reservations');
    return NextResponse.json(res.rows);
  } catch (error: any) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
    console.warn('DB offline, returning mock requests:', error.message);
    return NextResponse.json(mockRequests);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status } = body;
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
    return NextResponse.json({ success: true, status });
  }
}
