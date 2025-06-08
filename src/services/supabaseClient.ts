import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://turebvzifnlgmeqgdvxv.supabase.co'
const supabaseAnonKey =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cmVidnppZm5sZ21lcWdkdnh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzNzU2NzcsImV4cCI6MjA2NDk1MTY3N30.h2nnpjXgrRZgEKPpxtoK5Ni-0V2ZC23UnBqsILH90S0'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
