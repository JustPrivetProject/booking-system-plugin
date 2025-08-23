import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://turebvzifnlgmewqgdxv.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'your-anon';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
