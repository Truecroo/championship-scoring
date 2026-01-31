# 🔒 Security Setup Guide

## CRITICAL: Apply These Security Measures BEFORE Production Use

### Step 1: Enable Row Level Security (RLS) in Supabase

**⚠️ IMPORTANT:** Without RLS, anyone can read/modify your database using the anon key!

1. **Go to Supabase Dashboard:**
   - URL: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/editor

2. **Open SQL Editor:**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run the RLS Migration:**
   - Open file: `database/enable_rls_security.sql`
   - Copy ALL contents
   - Paste into SQL Editor
   - Click "Run" or press Ctrl+Enter

4. **Verify RLS is Enabled:**
   - You should see output showing `rowsecurity = true` for all tables
   - If you see errors, read them carefully and fix issues

5. **Get Service Role Key:**
   - Go to: Settings → API
   - Copy the `service_role` key (NOT the anon key!)
   - This key bypasses RLS and should ONLY be used on your backend

---

### Step 2: Update Backend to Use Service Role Key

**Current Setup (INSECURE):**
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key  # ← Can only READ after RLS
```

**New Setup (SECURE):**
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key  # ← Can READ/WRITE everything
```

**Update your server/.env file:**
1. Add `SUPABASE_SERVICE_KEY` with the service role key
2. Update `server/index.js` to use it (already done in this commit)

**Update Render.com environment variables:**
1. Go to: https://dashboard.render.com
2. Select your service
3. Go to "Environment" tab
4. Add new variable:
   - Key: `SUPABASE_SERVICE_KEY`
   - Value: your service_role key from Supabase
5. Click "Save Changes"
6. Redeploy your service

---

### Step 3: Hash Passwords (CRITICAL)

**Why:** Passwords are currently stored in plaintext. If someone accesses your database, they see all passwords.

**What Changed:**
- Backend now uses bcrypt to hash passwords
- You need to update existing passwords in database

**Update Passwords in Supabase:**

1. Open SQL Editor in Supabase
2. Run this query to hash existing passwords:

```sql
-- Install pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Update judge passwords (all currently 'judge123')
-- bcrypt hash for 'judge123'
UPDATE judge_auth SET password = crypt('judge123', gen_salt('bf'));

-- Update admin password (currently 'admin123')
-- bcrypt hash for 'admin123'
UPDATE admin_auth SET password = crypt('admin123', gen_salt('bf'));
```

3. **IMPORTANT:** Change default passwords!

```sql
-- Change to your secure passwords
UPDATE judge_auth SET password = crypt('YourSecurePassword1', gen_salt('bf')) WHERE id = '1';
UPDATE judge_auth SET password = crypt('YourSecurePassword2', gen_salt('bf')) WHERE id = '2';
UPDATE judge_auth SET password = crypt('YourSecurePassword3', gen_salt('bf')) WHERE id = '3';
UPDATE admin_auth SET password = crypt('YourSecureAdminPassword', gen_salt('bf')) WHERE id = 1;
```

---

### Step 4: Update CORS Configuration

**Already done in code, but verify:**

1. Check your Render backend URL
2. Update `server/index.js` if your frontend URL changes
3. Current setting allows only your GitHub Pages domain

---

### Step 5: Deploy Changes

1. **Commit changes:**
   ```bash
   git add .
   git commit -m "Add critical security improvements: RLS, bcrypt, CORS"
   git push origin main
   ```

2. **Redeploy Backend (Render):**
   - Go to Render dashboard
   - Your service should auto-deploy after push
   - OR click "Manual Deploy" → "Deploy latest commit"

3. **Verify Everything Works:**
   - Try logging in as judge
   - Try logging in as admin
   - Try voting as spectator
   - Check that results display correctly

---

### Step 6: Security Checklist

After completing all steps, verify:

- [ ] RLS enabled on ALL tables in Supabase
- [ ] Service role key added to Render environment
- [ ] Passwords hashed with bcrypt in database
- [ ] Default passwords changed to secure ones
- [ ] CORS configured to allow only your domain
- [ ] Rate limiting enabled (already in code)
- [ ] `.env` files NOT committed to git
- [ ] Frontend and backend deployed and working

---

### What These Changes Protect Against:

✅ **RLS:** Prevents direct database access via anon key
✅ **Bcrypt:** Protects passwords even if database is breached
✅ **CORS:** Prevents other websites from using your API
✅ **Rate Limiting:** Prevents spam and DDoS attacks

---

### Testing Security

**Test 1: Try to read auth tables directly**
```javascript
// This should FAIL after RLS is enabled
const { data } = await supabase
  .from('judge_auth')
  .select('*')

// Expected: Error or empty result (policy blocks it)
```

**Test 2: Try to insert score without backend**
```javascript
// This should FAIL
const { data } = await supabase
  .from('scores')
  .insert({ judge_id: '1', team_id: 'xxx', ... })

// Expected: Policy violation error
```

**Test 3: Login with correct password**
```javascript
// This should WORK (via your backend API)
POST /api/auth/judge/login
Body: { judge_id: "1", password: "YourSecurePassword1" }

// Expected: { success: true, judge: {...} }
```

---

### Rollback Plan

If something breaks:

1. **Disable RLS temporarily:**
   ```sql
   ALTER TABLE tablename DISABLE ROW LEVEL SECURITY;
   ```

2. **Debug the issue**

3. **Re-enable RLS:**
   ```sql
   ALTER TABLE tablename ENABLE ROW LEVEL SECURITY;
   ```

---

### Support

If you encounter issues:
1. Check Supabase logs: Dashboard → Logs
2. Check Render logs: Dashboard → Logs
3. Check browser console for frontend errors
4. Verify all environment variables are set correctly
