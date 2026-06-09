import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { query } from '@/lib/db'; // <--- THIS IS THE NEW LINE FIXING THE ERROR
import { isValidUSN, generateToken } from '@/lib/auth';
import bcrypt from 'bcrypt';

export async function POST(request: Request) {
  try {
    const { usn, password } = await request.json();

    if (!usn || !password) {
      return NextResponse.json({ error: 'Missing USN or password' }, { status: 400 });
    }

    const isEmail = usn.includes('@');
    if (!isEmail && !isValidUSN(usn)) {
      return NextResponse.json({ error: 'Invalid Identity format. Enter valid USN or College Email.' }, { status: 400 });
    }

    let user;

    try {
      // Query DB for user
      let res;
      if (isEmail) {
        res = await query('SELECT user_id, usn, password_hash, role_id FROM users WHERE email = $1', [usn.toLowerCase()]);
      } else {
        res = await query('SELECT user_id, usn, password_hash, role_id FROM users WHERE usn = $1', [usn.toUpperCase()]);
      }
      user = res?.rows?.[0];

      // Auto-create user for demo/hackathon purposes if they do not exist
      if (!user) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const assignedRole = isEmail
          ? (usn.toLowerCase().startsWith('hod') ? 4 : 3)
          : 1;
        const insertRes = await query(
          'INSERT INTO users (usn, name, email, password_hash, role_id) VALUES ($1, $2, $3, $4, $5) RETURNING user_id, usn, role_id',
          [
            isEmail ? usn.toLowerCase() : usn.toUpperCase(),
            isEmail ? (assignedRole === 4 ? `HOD ${usn}` : `Admin ${usn}`) : `Student ${usn}`,
            isEmail ? usn.toLowerCase() : `${usn.toLowerCase()}@college.edu`,
            hashedPassword,
            assignedRole
          ]
        );
        user = insertRes.rows[0];
      } else {
        // Secure password check
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
          return NextResponse.json({ error: 'Invalid Credentials' }, { status: 401 });
        }
      }
    } catch (dbErr: any) {
      if (process.env.NODE_ENV === 'production') {
        throw dbErr;
      }
      console.warn('Local database offline, using development mock auth:', dbErr.message);
      user = {
        user_id: 'mock-uuid-1234',
        usn: isEmail ? usn.toLowerCase() : usn.toUpperCase(),
        role_id: isEmail ? (usn.toLowerCase().startsWith('hod') ? 4 : 3) : 1
      };
    }

    // Generate strict JWT
    const token = generateToken({
      userId: user.user_id,
      usn: user.usn,
      roleId: user.role_id
    });

    const response = NextResponse.json({ success: true, user: { usn: user.usn, roleId: user.role_id } }, { status: 200 });

    // Set secure HTTP-Only cookie
    response.cookies.set({
      name: 'phoenix_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 12, // 12 hours
      path: '/',
    });

    return response;

  } catch (error) {
    console.error('Login Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}