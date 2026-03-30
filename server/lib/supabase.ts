import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://yvedkmtjynhgsuxukxjj.supabase.co';
const supabaseKey = process.env.SUPABASE_SECRET_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);
export default supabase;
