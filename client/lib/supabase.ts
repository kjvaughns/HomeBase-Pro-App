import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://yvedkmtjynhgsuxukxjj.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_IZ9DbM1vrlxFIz8RpBjw0Q_Yjhb1PLJ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export default supabase;
