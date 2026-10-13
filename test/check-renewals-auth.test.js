const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('check-renewals accetta solo la service role key configurata', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../supabase/functions/check-renewals/index.ts'),
    'utf8'
  );

  assert.match(
    source,
    /auth\.slice\("Bearer "\.length\)\.trim\(\) === SERVICE_ROLE_KEY/
  );
  assert.doesNotMatch(source, /payload\?\.role === "service_role"/);
});
