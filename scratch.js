const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const SUPABASE_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const SUPABASE_KEY = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

(async () => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/transactions?id=eq.4585a4c2-e1ee-4ece-a544-3893d7984a05`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ settlement_id: '12345678-1234-1234-1234-1234567890ab' })
  });
  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Body:', JSON.stringify(data, null, 2));
})();
