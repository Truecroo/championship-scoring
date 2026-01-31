# 🔒 Critical Security Updates

## What Changed

This commit adds **3 critical security improvements** to protect your championship scoring system from attacks.

---

## ⚠️ BREAKING CHANGES

**You MUST complete these steps before deploying:**

1. **Enable RLS in Supabase** (10 minutes)
2. **Hash passwords** (5 minutes)
3. **Update environment variables** (5 minutes)

**See:** [SECURITY_SETUP.md](./SECURITY_SETUP.md) for detailed instructions.

---

## 🛡️ Security Improvements

### 1. Row Level Security (RLS) ✅

**Problem:** Anyone with your Supabase anon key could read/modify ALL data
**Solution:** Enabled RLS with strict policies

**Files:**
- `database/enable_rls_security.sql` - SQL migration to enable RLS
- `server/index.js` - Updated to use SERVICE_ROLE key

**Protection:**
- ✅ Auth tables (passwords) now inaccessible from frontend
- ✅ Write operations only via backend API
- ✅ Prevents direct database manipulation

---

### 2. Password Hashing with Bcrypt ✅

**Problem:** Passwords stored in plaintext (visible if DB breached)
**Solution:** bcrypt hashing with salt

**Files:**
- `server/index.js` - Added bcrypt password verification
- `database/hash_passwords_migration.sql` - Migration script
- `server/package.json` - Added bcryptjs dependency

**Features:**
- ✅ Backward compatible (works with both hashed and plaintext during migration)
- ✅ Warning logs if plaintext passwords detected
- ✅ Each hash is unique (salted)

---

### 3. CORS + Rate Limiting ✅

**Problem:** Any website could spam your API
**Solution:** Strict CORS + rate limiting

**Files:**
- `server/index.js` - Added CORS whitelist and rate limiters
- `server/package.json` - Added express-rate-limit dependency

**Protection:**
- ✅ Only your GitHub Pages domain can access API
- ✅ 100 requests per 15 min (general)
- ✅ 10 login attempts per 15 min
- ✅ 20 votes per 5 min (spectators)

---

## 📊 Before vs After

| Attack Vector | Before | After |
|--------------|--------|-------|
| Read passwords from DB | ✗ Possible | ✅ Blocked by RLS |
| Steal passwords if DB breached | ✗ Plaintext visible | ✅ Hashed (unusable) |
| Spam votes from external site | ✗ Unlimited | ✅ Rate limited |
| Direct DB manipulation | ✗ Full access | ✅ Blocked by RLS |
| Brute force login | ✗ Unlimited attempts | ✅ 10 attempts/15min |

---

## 🚀 Migration Steps (Required)

### Step 1: Enable RLS in Supabase
```sql
-- Run in Supabase SQL Editor
-- Copy from: database/enable_rls_security.sql
ALTER TABLE nominations ENABLE ROW LEVEL SECURITY;
-- ... (see file for complete script)
```

### Step 2: Hash Existing Passwords
```sql
-- Run in Supabase SQL Editor
-- Copy from: database/hash_passwords_migration.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
UPDATE judge_auth SET password = crypt('judge123', gen_salt('bf'));
-- ... (see file for complete script)
```

### Step 3: Update Environment Variables

**Render.com:**
1. Dashboard → Environment
2. Add: `SUPABASE_SERVICE_KEY` = (your service role key from Supabase)
3. Save & Redeploy

**Supabase Dashboard:**
- Settings → API → Copy `service_role` key

---

## 🧪 Testing

After deployment, verify:

```bash
# 1. Frontend builds
npm run build

# 2. Login works
# Try logging in as judge/admin

# 3. RLS blocks direct access
# Open DevTools → Console:
const { createClient } = supabase
const client = createClient('YOUR_URL', 'YOUR_ANON_KEY')
const { data } = await client.from('judge_auth').select('*')
console.log(data) // Should be empty (blocked by RLS)
```

---

## 🔄 Backward Compatibility

- ✅ Works with existing plaintext passwords (during migration)
- ✅ Frontend unchanged (no breaking changes)
- ✅ API endpoints unchanged
- ⚠️ Requires service role key environment variable

---

## 📝 Files Changed

**New Files:**
- `database/enable_rls_security.sql` - RLS migration
- `database/hash_passwords_migration.sql` - Password hashing
- `SECURITY_SETUP.md` - Setup guide
- `SECURITY_CHANGES.md` - This file

**Modified Files:**
- `server/index.js` - Security updates
- `server/package.json` - New dependencies
- `server/.env.example` - Updated template

---

## 🆘 Rollback Plan

If something breaks:

1. **Disable RLS temporarily:**
   ```sql
   ALTER TABLE tablename DISABLE ROW LEVEL SECURITY;
   ```

2. **Use ANON_KEY instead of SERVICE_KEY:**
   - Remove `SUPABASE_SERVICE_KEY` from Render
   - Code will fallback to `SUPABASE_ANON_KEY`

3. **Revert to previous commit:**
   ```bash
   git revert HEAD
   git push origin main
   ```

---

## 🎯 Next Steps (Optional)

After these critical fixes, consider:

1. Enable HTTPS for backend (Render does this automatically)
2. Add 2FA for admin login
3. Implement audit logging
4. Set up monitoring/alerts

---

## 📞 Support

If you encounter issues:
1. Check: [SECURITY_SETUP.md](./SECURITY_SETUP.md)
2. Verify: Supabase logs
3. Verify: Render logs
4. Check: Browser console errors
