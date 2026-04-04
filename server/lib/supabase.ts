import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) throw new Error('SUPABASE_URL environment variable is not set');
if (!supabaseKey) throw new Error('SUPABASE_SERVICE_KEY environment variable is not set');

export const supabase = createClient(supabaseUrl, supabaseKey);
export default supabase;
