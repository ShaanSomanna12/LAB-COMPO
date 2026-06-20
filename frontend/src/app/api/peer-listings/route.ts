import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const localDbPath = path.join(process.cwd(), 'local_mock_peer_listings.json');

const defaultListings = [
  {
    id: 'LIST-1001',
    studentName: 'Rahul Kumar',
    usn: '4VV25CS045',
    component: 'STM32 Blue Pill Board',
    department: 'ECE',
    type: 'Sell',
    price: 450,
    condition: 'Like New',
    description: 'Bought for microcontrollers lab but ended up using Arduino. Working perfectly.',
    status: 'Active',
    contact: 'rahul.kumar@phoenix.edu'
  },
  {
    id: 'LIST-1002',
    studentName: 'Aditi Sharma',
    usn: '4VV25EC012',
    component: 'Raspberry Pi Camera Module V2',
    department: 'EDL',
    type: 'Rent',
    price: 80, // per week
    condition: 'Brand New',
    description: 'Unopened box camera module. Renting for academic project timelines.',
    status: 'Active',
    contact: 'aditi.sharma@phoenix.edu'
  }
];

function getMockListings() {
  try {
    if (fs.existsSync(localDbPath)) {
      return JSON.parse(fs.readFileSync(localDbPath, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to read local peer listings DB', e);
  }
  return defaultListings;
}

function saveMockListings(data: any) {
  try {
    fs.writeFileSync(localDbPath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed to write local peer listings DB', e);
  }
}

export async function GET() {
  return NextResponse.json(getMockListings());
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { studentName, usn, component, department, type, price, condition, description, contact, image } = body;
    
    const newListing = {
      id: 'LIST-' + Math.floor(1000 + Math.random() * 9000),
      studentName: studentName || 'Unknown Student',
      usn: (usn || '').toUpperCase(),
      component,
      department: department || 'EDL',
      type: type || 'Sell',
      price: parseInt(price, 10) || 500,
      condition: condition || 'Used - Good Condition',
      description: description || '',
      status: 'Active',
      contact: contact || `${(studentName || 'student').toLowerCase().replace(/\s+/g, '')}@phoenix.edu`,
      image: image || null
    };

    const curr = getMockListings();
    curr.push(newListing);
    saveMockListings(curr);

    return NextResponse.json({ success: true, item: newListing });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
