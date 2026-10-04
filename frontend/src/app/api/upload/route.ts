import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { verifySession } from '@/lib/auth';
import fs from 'fs';

export async function POST(req: Request) {
  const payload = await verifySession(req);
  if (!payload) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const path = formData.get('path') as string;
    const bucket = formData.get('bucket') as string;
    
    if (!file || !path || !bucket) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }
    
    const buffer = Buffer.from(await file.arrayBuffer());
    const supabase = getSupabaseAdmin();
    
    const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
      contentType: file.type,
      upsert: true
    });
    
    if (error) {
      fs.appendFileSync('upload_log.txt', `Storage error: ${JSON.stringify(error)}\n`);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    fs.appendFileSync('upload_log.txt', `Success: ${data.publicUrl}\n`);
    return NextResponse.json({ url: data.publicUrl });
  } catch (err: any) {
    fs.appendFileSync('upload_log.txt', `Catch error: ${err.message}\n`);
    console.error('Upload error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
