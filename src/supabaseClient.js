import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ncqdkwwiehpvqoxjezik.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcWRrd3dpZWhwdnFveGplemlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NDU5MzYsImV4cCI6MjA5ODMyMTkzNn0.g0A2JupxjXini5IUm9CoetMt5GPAf00TBJj3JHiq-Cs'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
