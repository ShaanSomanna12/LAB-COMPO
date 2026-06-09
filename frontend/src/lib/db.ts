import { supabase } from './supabase';

// This satisfies the 'query' import so Vercel builds successfully!
export const query = async (queryText: string, values?: any[]) => {
    console.log("LabNexus Database Pinged:", queryText);

    // Temporary empty return so the server code doesn't crash during build
    return { rows: [] };
};