import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import fs from 'fs';
import path from 'path';

const localLabsPath = path.join(process.cwd(), 'local_mock_labs.json');

const defaultLabs = [
  {
    id: 'LAB-1',
    name: 'CSE Lab',
    roomNumber: 'ED-301',
    department: 'EDL',
    photoUrl: 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?q=80&w=600&auto=format&fit=crop',
    description: 'Equipped with high-performance computer systems, GPU nodes for deep learning, and advanced networking infrastructure.'
  },
  {
    id: 'LAB-2',
    name: 'Mechanical Lab',
    roomNumber: 'ME-102',
    department: 'MECH',
    photoUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=600&auto=format&fit=crop',
    description: 'Features professional CAD workstations, 3D printers, CNC machining units, and fluid dynamics testing equipment.'
  },
  {
    id: 'LAB-3',
    name: 'EEE Lab',
    roomNumber: 'EE-204',
    department: 'EEE',
    photoUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=600&auto=format&fit=crop',
    description: 'Equipped with power electronics testbeds, smart grid simulators, electrical machine training systems, and PLCs.'
  },
  {
    id: 'LAB-4',
    name: 'ECE Lab',
    roomNumber: 'EC-208',
    department: 'ECE',
    photoUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=600&auto=format&fit=crop',
    description: 'Features high-frequency digital storage oscilloscopes, logic analyzers, RF signal generators, and FPGA development kits.'
  }
];

function getMockLabs() {
  try {
    if (fs.existsSync(localLabsPath)) {
      return JSON.parse(fs.readFileSync(localLabsPath, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to read local labs fallback', e);
  }
  return defaultLabs;
}

function saveMockLabs(data: any) {
  try {
    fs.writeFileSync(localLabsPath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed to write local labs fallback', e);
  }
}

export async function GET(request: Request) {
  try {
    const res = await query('SELECT * FROM labs ORDER BY name ASC');
    return NextResponse.json(res.rows);
  } catch (error: any) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
    console.warn('DB offline or table missing, returning mock labs fallback:', error.message);
    return NextResponse.json(getMockLabs());
  }
}

export async function POST(request: Request) {
  let body: any = {};
  try {
    body = await request.json();
    const { name, roomNumber, department, description, photoUrl } = body;
    const id = `LAB-${Math.floor(1000 + Math.random() * 9000)}`;
    const res = await query(
      'INSERT INTO labs (lab_id, name, room_number, department, description, photo_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [id, name, roomNumber, department, description || '', photoUrl || '']
    );
    return NextResponse.json({ success: true, item: res.rows[0] });
  } catch (error: any) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
    console.warn('DB offline or table missing, mock adding lab:', error.message);
    const newLab = {
      id: `LAB-${Math.floor(1000 + Math.random() * 9000)}`,
      name: body.name,
      roomNumber: body.roomNumber,
      department: body.department,
      photoUrl: body.photoUrl || '',
      description: body.description || ''
    };
    const curr = getMockLabs();
    curr.push(newLab);
    saveMockLabs(curr);
    return NextResponse.json({ success: true, item: newLab });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    await query('DELETE FROM labs WHERE lab_id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
    console.warn('DB offline or table missing, mock deleting lab:', error.message);
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    const curr = getMockLabs().filter((lab: any) => lab.id !== id);
    saveMockLabs(curr);
    return NextResponse.json({ success: true });
  }
}
