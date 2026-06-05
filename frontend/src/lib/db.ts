import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const dbConfig = {
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'password',
  database: process.env.POSTGRES_DB || 'phoenix_db'
}

export const supabase = createClient(supabaseUrl, supabaseKey)
export const db = supabase

export const query = async (queryString: string, args: any[] = []) => {
  try {
    const q = queryString.toLowerCase().trim().replace(/\s+/g, ' ');

    // 1. SELECT users (e.g., email or USN search)
    if (q.includes('select') && q.includes('from users')) {
      const isEmail = q.includes('email =');
      const param = args[0];
      let selectFields = '*';
      if (q.includes('user_id, usn, password_hash, role_id')) {
        selectFields = 'user_id, usn, password_hash, role_id';
      }
      
      let queryBuilder = supabase.from('users').select(selectFields);
      if (isEmail) {
        queryBuilder = queryBuilder.eq('email', param.toLowerCase());
      } else {
        queryBuilder = queryBuilder.eq('usn', param.toUpperCase());
      }
      
      const { data, error } = await queryBuilder;
      if (error) throw error;
      return { rows: data || [] };
    }

    // 2. INSERT into users
    if (q.includes('insert into users')) {
      const { data, error } = await supabase
        .from('users')
        .insert({
          usn: args[0].toUpperCase(),
          name: args[1],
          email: args[2].toLowerCase(),
          password_hash: args[3],
          role_id: args[4]
        })
        .select('user_id, usn, role_id');
      if (error) throw error;
      return { rows: data || [] };
    }

    // 3. SELECT components
    if (q.includes('select') && q.includes('from components')) {
      const { data, error } = await supabase
        .from('components')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      
      // Map columns for student page and admin page compatibility
      const mapped = (data || []).map(row => ({
        ...row,
        id: row.component_id || row.id,
        total: row.total_quantity !== undefined ? row.total_quantity : row.total,
        available: row.available_quantity !== undefined ? row.available_quantity : row.available,
        desc: row.base_condition !== undefined ? row.base_condition : row.desc,
        location: row.lab_location !== undefined ? row.lab_location : row.location,
        photo_url: row.photo_url || row.image_url || null,
        status: (row.available_quantity || row.available || 0) > 0 ? 'Available' : 'Out of Stock'
      }));
      return { rows: mapped };
    }

    // 4. INSERT into components
    if (q.includes('insert into components')) {
      const { data, error } = await supabase
        .from('components')
        .insert({
          name: args[0],
          department: args[1],
          total_quantity: args[2],
          available_quantity: args[2],
          base_condition: args[3] || 'New catalog item',
          lab_location: args[4] || 'Main Lab',
          photo_url: args[5] || null
        })
        .select('*');
      if (error) throw error;
      
      const mapped = (data || []).map(row => ({
        ...row,
        id: row.component_id || row.id,
        total: row.total_quantity !== undefined ? row.total_quantity : row.total,
        available: row.available_quantity !== undefined ? row.available_quantity : row.available,
        desc: row.base_condition !== undefined ? row.base_condition : row.desc,
        location: row.lab_location !== undefined ? row.lab_location : row.location,
        photo_url: row.photo_url || row.image_url || null,
        status: (row.available_quantity || row.available || 0) > 0 ? 'Available' : 'Out of Stock'
      }));
      return { rows: mapped };
    }

    // 5. DELETE components
    if (q.includes('delete from components')) {
      const { error } = await supabase
        .from('components')
        .delete()
        .or(`component_id.eq.${args[0]},id.eq.${args[0]}`);
      if (error) throw error;
      return { rows: [] };
    }

    // 6. SELECT reservations
    if (q.includes('select') && q.includes('from reservations')) {
      const { data, error } = await supabase
        .from('reservations')
        .select('*, users(*), components(*)');
      if (error) throw error;
      
      const mapped = (data || []).map(row => ({
        id: row.reservation_id,
        studentName: row.users?.name || `Student ${row.users?.usn || ''}`,
        usn: row.users?.usn || '',
        component: row.components?.name || 'Unknown Component',
        department: row.components?.department || 'EDL',
        duration: 7, // Default duration
        requestDate: row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        status: row.status || 'Pending HOD'
      }));
      return { rows: mapped };
    }

    // 7. UPDATE reservations
    if (q.includes('update reservations')) {
      const { data, error } = await supabase
        .from('reservations')
        .update({ status: args[0] })
        .eq('reservation_id', args[1])
        .select('*');
      if (error) throw error;
      return { rows: data || [] };
    }

    // 8. SELECT labs
    if (q.includes('select') && q.includes('from labs')) {
      const { data, error } = await supabase
        .from('labs')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      
      const mapped = (data || []).map(row => ({
        ...row,
        id: row.lab_id || row.id,
        roomNumber: row.room_number || row.room,
        photoUrl: row.photo_url,
        description: row.description
      }));
      return { rows: mapped };
    }

    // 9. INSERT into labs
    if (q.includes('insert into labs')) {
      const { data, error } = await supabase
        .from('labs')
        .insert({
          lab_id: args[0],
          name: args[1],
          room_number: args[2],
          department: args[3],
          description: args[4] || '',
          photo_url: args[5] || ''
        })
        .select('*');
      if (error) throw error;
      return { rows: data || [] };
    }

    // 10. DELETE from labs
    if (q.includes('delete from labs')) {
      const { error } = await supabase
        .from('labs')
        .delete()
        .eq('lab_id', args[0]);
      if (error) throw error;
      return { rows: [] };
    }

    // 11. SELECT lab_access_requests
    if (q.includes('select') && q.includes('from lab_access_requests')) {
      let queryBuilder = supabase.from('lab_access_requests').select('*');
      if (q.includes('upper(usn)') || q.includes('usn =')) {
        queryBuilder = queryBuilder.eq('usn', args[0]);
      }
      queryBuilder = queryBuilder.order('access_date', { ascending: false });
      
      const { data, error } = await queryBuilder;
      if (error) throw error;
      
      const mapped = (data || []).map(row => ({
        ...row,
        id: row.request_id || row.id,
        studentName: row.student_name,
        labName: row.lab_name,
        accessDate: row.access_date,
        timeSlot: row.time_slot,
        purpose: row.purpose,
        adminRemarks: row.admin_remarks,
        hodRemarks: row.hod_remarks
      }));
      return { rows: mapped };
    }

    // 12. UPDATE lab_access_requests
    if (q.includes('update lab_access_requests')) {
      const updateData: any = {};
      if (q.includes('status = $1, admin_remarks = $2, hod_remarks = $3')) {
        updateData.status = args[0];
        updateData.admin_remarks = args[1];
        updateData.hod_remarks = args[2];
        const id = args[3];
        const { data, error } = await supabase.from('lab_access_requests').update(updateData).eq('request_id', id).select('*');
        if (error) throw error;
        return { rows: data || [] };
      } else if (q.includes('status = $1, hod_remarks = $2')) {
        updateData.status = args[0];
        updateData.hod_remarks = args[1];
        const id = args[2];
        const { data, error } = await supabase.from('lab_access_requests').update(updateData).eq('request_id', id).select('*');
        if (error) throw error;
        return { rows: data || [] };
      } else if (q.includes('status = $1, admin_remarks = $2')) {
        updateData.status = args[0];
        updateData.admin_remarks = args[1];
        const id = args[2];
        const { data, error } = await supabase.from('lab_access_requests').update(updateData).eq('request_id', id).select('*');
        if (error) throw error;
        return { rows: data || [] };
      } else {
        updateData.status = args[0];
        const id = args[1];
        const { data, error } = await supabase.from('lab_access_requests').update(updateData).eq('request_id', id).select('*');
        if (error) throw error;
        return { rows: data || [] };
      }
    }

    // Fallback for custom dashboard tables
    if (q.includes('select') && q.includes('from inventory')) {
      const { data, error } = await supabase.from('inventory').select('*').order('id', { ascending: false });
      if (error) throw error;
      return { rows: data || [] };
    }
    if (q.includes('select') && q.includes('from labs')) {
      const { data, error } = await supabase.from('labs').select('*').order('id', { ascending: false });
      if (error) throw error;
      return { rows: data || [] };
    }

    console.warn('Unhandled SQL query routing to Supabase. Query:', queryString);
    return { rows: [] };
  } catch (err: any) {
    console.error('Database query routing error:', err.message || err);
    throw err;
  }
}