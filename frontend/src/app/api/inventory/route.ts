import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import fs from 'fs';
import path from 'path';

const localDbPath = path.join(process.cwd(), 'local_mock_inventory.json');

// Mutable persistent store for local testing without DB
const defaultInventory = [
  { id: 1, name: 'Raspberry Pi 4 Model B', available: 4, total: 5, desc: 'High-performance single-board computer.', department: 'EDL', location: 'Lab 201', status: 'Available' },
  { id: 2, name: 'Arduino Mega 2560', available: 0, total: 2, desc: 'Advanced microcontroller board based on the ATmega2560.', department: 'MECH', location: 'Mechatronics Lab', status: 'Available' },
  { id: 3, name: 'NVIDIA Jetson Nano', available: 2, total: 2, desc: 'Small, powerful computer for embedded AI.', department: 'EDL', location: 'AI Lab 404', status: 'Available' },
  { id: 4, name: 'Fluke 117 Multimeter', available: 12, total: 15, desc: 'True-RMS digital multimeter with integrated non-contact voltage detection.', department: 'EEE', location: 'Circuits Lab', status: 'Available' }
];

function getMockInventory() {
  try {
    if (fs.existsSync(localDbPath)) {
      return JSON.parse(fs.readFileSync(localDbPath, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to read local DB fallback', e);
  }
  return defaultInventory;
}

function saveMockInventory(data: any) {
  try {
    fs.writeFileSync(localDbPath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed to write local DB fallback', e);
  }
}

export async function GET() {
  try {
    const res = await query('SELECT * FROM components ORDER BY name ASC');
    return NextResponse.json(res.rows);
  } catch (error: any) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
    console.warn('DB offline, returning mock inventory:', error.message);
    return NextResponse.json(getMockInventory());
  }
}

export async function POST(request: Request) {
  let body: any = {};
  try {
    body = await request.json();
    const { name, department, total, desc, location, photoUrl } = body;
    const res = await query(
      'INSERT INTO components (name, department, total_quantity, available_quantity, base_condition, lab_location, photo_url) VALUES ($1, $2, $3, $3, $4, $5, $6) RETURNING *',
      [name, department, total, desc || 'New catalog item', location || 'Main Lab', photoUrl || '']
    );
    return NextResponse.json({ success: true, item: res.rows[0] });
  } catch (error: any) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
    console.warn('DB offline, mock adding item:', error.message);
    const newItem = { 
      id: Date.now(), 
      name: body.name, 
      department: body.department, 
      total: body.total, 
      available: body.total, 
      desc: body.desc, 
      location: body.location || 'Main Lab', 
      photo_url: body.photoUrl || '', 
      status: 'Available' 
    };
    const curr = getMockInventory();
    curr.push(newItem);
    saveMockInventory(curr);
    return NextResponse.json({ success: true, item: newItem });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    await query('DELETE FROM components WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
    console.warn('DB offline, mock deleting item:', error.message);
    const url = new URL(request.url);
    const id = parseInt(url.searchParams.get('id') || '0', 10);
    const curr = getMockInventory().filter((item: any) => item.id !== id);
    saveMockInventory(curr);
    return NextResponse.json({ success: true });
  }
}
