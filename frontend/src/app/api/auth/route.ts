import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
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

    let user: any;

    try {
      // Query DB for user using Supabase
      const { data, error } = await supabase
        .from('users')
        .select('user_id, usn, password_hash, role_id')
        .eq(isEmail ? 'email' : 'usn', isEmail ? usn.toLowerCase() : usn.toUpperCase())
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      user = data;

      // Auto-create user for demo/hackathon purposes if they do not exist
      if (!user) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const assignedRole = isEmail
          ? (usn.toLowerCase().startsWith('hod') ? 4 : 3)
          : 1;
        
        const { data: insertData, error: insertError } = await supabase
          .from('users')
          .insert([{
            usn: isEmail ? usn.toLowerCase() : usn.toUpperCase(),
            name: isEmail ? (assignedRole === 4 ? `HOD ${usn}` : `Admin ${usn}`) : `Student ${usn}`,
            email: isEmail ? usn.toLowerCase() : `${usn.toLowerCase()}@college.edu`,
            password_hash: hashedPassword,
            role_id: assignedRole
          }])
          .select('user_id, usn, role_id')
          .single();
          
        if (insertError) throw insertError;
        user = insertData;
      } else {
        // Secure password check
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
          return NextResponse.json({ error: 'Invalid Credentials' }, { status: 401 });
        }
      }
    } catch (dbErr: any) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Internal Server Error', details: dbErr.message }, { status: 500 });
      }
      console.warn('Database error, using development mock auth:', dbErr.message);
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