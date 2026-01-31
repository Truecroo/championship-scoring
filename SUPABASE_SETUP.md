# Supabase Setup Guide

This guide will help you set up Supabase for the Championship Scoring System.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Choose an organization (or create one)
4. Set up your project:
   - **Name**: Championship Scoring (or any name)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free tier is sufficient for most competitions

## 2. Run Database Schema

1. In your Supabase project, go to **SQL Editor** (left sidebar)
2. Click "New Query"
3. Copy the entire contents of `/database/schema.sql`
4. Paste into the SQL Editor
5. Click "Run" or press `Ctrl+Enter`

You should see a success message. The following tables will be created:
- `nominations` - Championship nominations/categories
- `teams` - Participating teams
- `scores` - Judge scores with weighted criteria
- `spectator_scores` - Spectator votes
- `current_team` - Current team being shown to spectators

## 3. Get API Credentials

1. In Supabase, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public** key (under "Project API keys")

## 4. Configure Backend

### For Local Development:

1. Navigate to `/server` folder
2. Create a `.env` file (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```
3. Edit `.env` and add your Supabase credentials:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   PORT=5001
   ```

### For Render Deployment:

1. Go to your Render service dashboard
2. Click on **Environment** (left sidebar)
3. Add the following environment variables:
   - `SUPABASE_URL` = `https://your-project.supabase.co`
   - `SUPABASE_ANON_KEY` = `your-anon-key-here`
4. Click "Save Changes"
5. Render will automatically redeploy your service

## 5. Install Dependencies

```bash
cd server
npm install
```

This will install the new `@supabase/supabase-js` dependency.

## 6. Test the Setup

### Start the backend:
```bash
npm start
```

You should see:
```
✅ Server running on http://localhost:5001
📊 API available at http://localhost:5001/api
🗄️  Connected to Supabase
```

### Test API endpoints:
```bash
# Create a nomination
curl -X POST http://localhost:5001/api/nominations \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Category"}'

# Get nominations
curl http://localhost:5001/api/nominations
```

## 7. Database Features

### Row Level Security (RLS)
Currently RLS is **disabled** for simplicity. To enable it later:

1. In Supabase SQL Editor, uncomment and run the RLS lines from `schema.sql`
2. Create appropriate policies for your security needs

### Realtime Updates (Optional)
Supabase supports realtime subscriptions. To enable:

1. In Supabase, go to **Database** → **Replication**
2. Enable replication for tables you want to subscribe to
3. Update frontend to use Supabase realtime subscriptions

## 8. Data Migration (If migrating from lowdb)

If you have existing data in lowdb format (`db.json`), you'll need to:

1. Export your current data
2. Transform UUIDs (Supabase uses UUID instead of integers)
3. Import into Supabase tables

Contact the developer for migration script if needed.

## Troubleshooting

### Error: "Missing Supabase credentials"
- Make sure `.env` file exists in `/server` folder
- Check that `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set correctly
- Restart the server after changing `.env`

### Error: "relation does not exist"
- Make sure you ran the SQL schema from step 2
- Check that all tables are created in Supabase dashboard

### Error: "Invalid API key"
- Make sure you copied the **anon public** key, not the service_role key
- Check for extra spaces or quotes in the `.env` file

### Deployment fails on Render
- Ensure environment variables are set in Render dashboard
- Check Render logs for specific error messages
- Verify `npm start` command is set correctly

## Security Notes

- The **anon key** is safe to expose in frontend code
- Never expose the **service_role** key
- For production, consider enabling RLS policies
- Use environment variables for all secrets

## Useful Supabase Features

- **Table Editor**: View and edit data in GUI
- **SQL Editor**: Run custom queries
- **Logs**: Monitor API requests and errors
- **Auth** (optional): Add user authentication later if needed
