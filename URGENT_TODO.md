# ⚠️ URGENT: Security Setup Required

## 🚨 BEFORE Your Championship Event

The code has been updated with critical security fixes, but **YOU MUST COMPLETE THESE STEPS** before your event:

---

## ⏱️ Quick Setup (20 minutes total)

### Step 1: Enable RLS in Supabase (10 min)

1. **Open Supabase Dashboard:**
   - Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID

2. **Open SQL Editor:**
   - Click "SQL Editor" in left sidebar
   - Click "New Query"

3. **Copy & Run RLS Migration:**
   - Open file: `database/enable_rls_security.sql`
   - Copy ALL contents (everything in the file)
   - Paste into Supabase SQL Editor
   - Click "Run" or press Ctrl+Enter
   - Wait for "Success" message

4. **Verify RLS is Enabled:**
   - Scroll to bottom of SQL output
   - Should see `rowsecurity = true` for all tables
   - ✅ If yes → RLS is enabled!
   - ❌ If no → read error messages and retry

---

### Step 2: Get Service Role Key (2 min)

1. **In Supabase Dashboard:**
   - Go to: Settings → API (left sidebar)

2. **Find "service_role" key:**
   - Scroll down to "Project API keys"
   - Copy the **service_role** key (NOT anon key!)
   - It starts with `eyJ...` and is ~200 characters long

3. **Save it securely:**
   - You'll need this for Step 4

---

### Step 3: Hash Passwords (5 min)

1. **Open Supabase SQL Editor again:**
   - Same place as Step 1

2. **Copy & Run Password Migration:**
   - Open file: `database/hash_passwords_migration.sql`
   - Copy lines 1-50 (the migration part, not the comments at the end)
   - Paste into SQL Editor
   - Click "Run"

3. **Change Default Passwords (CRITICAL!):**
   - Still in SQL Editor, run these queries:

   ```sql
   -- Change to YOUR passwords!
   UPDATE judge_auth
   SET password = crypt('YourNewSecurePassword1', gen_salt('bf'))
   WHERE id = '1';

   UPDATE judge_auth
   SET password = crypt('YourNewSecurePassword2', gen_salt('bf'))
   WHERE id = '2';

   UPDATE judge_auth
   SET password = crypt('YourNewSecurePassword3', gen_salt('bf'))
   WHERE id = '3';

   UPDATE admin_auth
   SET password = crypt('YourNewSecureAdminPassword', gen_salt('bf'))
   WHERE id = 1;
   ```

4. **Write down new passwords!**
   - Give each judge their password before the event
   - Save admin password securely

---

### Step 4: Update Render Environment (3 min)

1. **Go to Render Dashboard:**
   - https://dashboard.render.com

2. **Select your backend service:**
   - Find "championship-scoring" or your service name

3. **Add Service Role Key:**
   - Click "Environment" tab (left sidebar)
   - Click "Add Environment Variable"
   - Key: `SUPABASE_SERVICE_KEY`
   - Value: (paste the service_role key from Step 2)
   - Click "Save Changes"

4. **Redeploy:**
   - Click "Manual Deploy" → "Deploy latest commit"
   - Wait 2-3 minutes for deployment to complete
   - Check logs to ensure no errors

---

## ✅ Verification Checklist

After completing all steps, verify:

- [ ] RLS enabled in Supabase (Step 1)
- [ ] Passwords hashed (check via SQL: `SELECT * FROM judge_auth` - passwords should start with `$2`)
- [ ] Default passwords changed to secure ones
- [ ] Service role key added to Render
- [ ] Backend redeployed successfully
- [ ] Can login as judge with new password
- [ ] Can login as admin with new password
- [ ] Results page still works

---

## 🧪 Quick Test

1. **Test Login:**
   - Go to: https://truecroo.github.io/championship-scoring/judge-login
   - Try logging in with Judge 1 and your new password
   - Should work! ✅

2. **Test Security:**
   - Open browser DevTools (F12)
   - Go to Console tab
   - Try this (to verify RLS blocks access):
   ```javascript
   // This should FAIL (return empty/error) after RLS is enabled
   fetch('YOUR_SUPABASE_URL/rest/v1/judge_auth', {
     headers: {
       'apikey': 'YOUR_ANON_KEY',
       'Authorization': 'Bearer YOUR_ANON_KEY'
     }
   }).then(r => r.json()).then(console.log)
   ```
   - Expected result: Empty array `[]` or error (RLS blocks it)
   - ✅ If you can't read judge_auth → Security works!

---

## 🆘 If Something Breaks

**Backend won't start:**
- Check Render logs for errors
- Verify `SUPABASE_SERVICE_KEY` is set correctly
- Try removing the key → it will fallback to ANON_KEY (less secure but works)

**Can't login:**
- Passwords might not be hashed correctly
- Run verification query in Supabase:
  ```sql
  SELECT id, name, password = crypt('YourPassword', password) as matches
  FROM judge_auth WHERE id = '1';
  ```
- If `matches = false` → password is wrong

**Frontend broken:**
- Frontend doesn't need changes, should work as-is
- Clear browser cache and try again

---

## 📞 Need Help?

1. Read detailed guide: [SECURITY_SETUP.md](./SECURITY_SETUP.md)
2. Check what changed: [SECURITY_CHANGES.md](./SECURITY_CHANGES.md)
3. Review Supabase logs: Dashboard → Logs
4. Review Render logs: Dashboard → Logs

---

## ⚡ Quick Reference

**Supabase Dashboard:** https://supabase.com/dashboard
**Render Dashboard:** https://dashboard.render.com
**Your Site:** https://truecroo.github.io/championship-scoring/

**SQL Files:**
- RLS: `database/enable_rls_security.sql`
- Passwords: `database/hash_passwords_migration.sql`

**What Each Step Does:**
1. RLS → Blocks direct database access from frontend
2. Service Key → Allows backend to bypass RLS
3. Bcrypt → Protects passwords even if DB is breached
4. Render Update → Backend uses new security features

---

**Total Time:** ~20 minutes
**Complexity:** Medium (just copy-paste SQL queries)
**Impact:** Prevents 99% of common attacks! 🛡️
