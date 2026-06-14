/**
 * DEPRECATED: This module was historically used as a dummy connection for a Postgres 
 * connection. All database queries have now been migrated to use the official 
 * @supabase/supabase-js client in @/lib/supabase.ts.
 * 
 * Please do not import or use this file in new routes.
 */

export const query = async (queryText: string, values?: any[]) => {
    throw new Error("DEPRECATED: Use the Supabase client from @/lib/supabase instead.");
};