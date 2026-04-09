import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qgqfthoviyvxbhmwcuou.supabase.co';
const supabaseAnonKey = 'sb_publishable_Qf8l-wZtYIQmgwZBmPwhvQ_wS7QelVL';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAuth() {
  console.log("Testing auth for ircvipua@gmail.com...");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'ircvipua@gmail.com',
    password: 'ircvipua@gmail.com'
  });
  
  if (error) {
    console.error("Login failed:", error.message);
  } else {
    console.log("Login successful! User ID:", data.user.id);
  }
}

testAuth();
