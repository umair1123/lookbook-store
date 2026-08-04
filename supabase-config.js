/*
  ================================================================
  SUPABASE CONFIG — paste your own project's values in here.
  ================================================================

  Where to get these values:
  1. Go to https://supabase.com/dashboard and open your project
  2. Click the gear icon (bottom left) → Project Settings → API
  3. Copy the "Project URL" and the "anon public" key (NOT the
     service_role key — that one must never be used in a browser)

  This file is loaded by both index.html (the live site) and
  admin.html (the store manager). Keep it in the same folder as
  those two files.

  Note: it's normal and expected for this anon key to be visible in
  your site's source — Supabase's security model relies on your
  Row Level Security (RLS) policies (set up via the SQL editor), not
  on hiding this key.
*/

var SUPABASE_URL = "https://evalztjswfpmyszhqxez.supabase.co";
var SUPABASE_ANON_KEY = "sb_publishable_TgkPKktaTU8HnOaBzyenJw_Z-a3wJuG";

window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
