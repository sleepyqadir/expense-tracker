# Google Authentication Setup Guide

This guide will help you set up Google OAuth authentication for the Expense Tracker application.

## Step 1: Install Dependencies

First, install the required NextAuth package:

```bash
npm install next-auth@beta
```

## Step 2: Enable Google Drive API

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** > **Library**
4. Search for "Google Drive API"
5. Click on it and press **Enable**

## Step 3: Create Google OAuth Credentials

1. Navigate to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. If prompted, configure the OAuth consent screen:
   - Choose **External** user type
   - Fill in the required information (App name, User support email, Developer contact)
   - Add your email to test users if needed
   - **Important**: In the "Scopes" section, add:
     - `https://www.googleapis.com/auth/drive.file` (for Google Drive file access)
4. Create OAuth client ID:
   - Application type: **Web application**
   - Name: Expense Tracker (or any name you prefer)
   - Authorized JavaScript origins:
     - `http://localhost:3000` (for development)
     - `https://yourdomain.com` (for production)
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (for development)
     - `https://yourdomain.com/api/auth/callback/google` (for production)
5. Click **Create**
6. Copy the **Client ID** and **Client Secret**

## Step 4: Install Dependencies

Install the required Google APIs package:

```bash
npm install googleapis
```

## Step 5: Set Up Environment Variables

1. Create a `.env.local` file in the root of your project (if it doesn't exist)
2. Add the following variables:

```env
# Google OAuth Credentials
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# NextAuth Configuration
# Generate a random secret using: openssl rand -base64 32
NEXTAUTH_SECRET=your_generated_secret_here
NEXTAUTH_URL=http://localhost:3000
```

### Generate NEXTAUTH_SECRET

Run this command to generate a secure random secret:

```bash
openssl rand -base64 32
```

Copy the output and use it as your `NEXTAUTH_SECRET` value.

## Step 4: Update Environment Variables for Production

When deploying to production (e.g., Vercel, Netlify), make sure to:

1. Add the same environment variables in your hosting platform's dashboard
2. Update `NEXTAUTH_URL` to your production domain:
   ```
   NEXTAUTH_URL=https://yourdomain.com
   ```
3. Update the authorized redirect URIs in Google Cloud Console to include your production URL

## Step 5: Test the Authentication

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:3000`
3. You should be redirected to the login page
4. Click "Continue with Google" and sign in with your Google account
5. **Important**: When signing in, you'll be asked to grant permission to access Google Drive - click "Allow"
6. You should be redirected back to the expense tracker dashboard
7. Your expenses and categories will be automatically saved to Google Drive:
   - `expense-tracker-expenses.json` - Contains all your expenses
   - `expense-tracker-categories.json` - Contains all your categories
8. These files will be created in your Google Drive and synced automatically

## Troubleshooting

### "Invalid credentials" error
- Double-check that your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Make sure there are no extra spaces or quotes in your `.env.local` file

### Redirect URI mismatch
- Ensure the redirect URI in Google Cloud Console exactly matches: `http://localhost:3000/api/auth/callback/google`
- For production, use: `https://yourdomain.com/api/auth/callback/google`

### Session not persisting
- Check that `NEXTAUTH_SECRET` is set and is a valid random string
- Ensure `NEXTAUTH_URL` matches your current domain

## Files Created

The following files have been created for authentication:

- `auth.ts` - NextAuth configuration
- `app/api/auth/[...nextauth]/route.ts` - API route handlers
- `app/login/page.tsx` - Login page
- `components/session-provider.tsx` - Session provider wrapper
- `app/page.tsx` - Protected home page (redirects to login if not authenticated)
- `expense-tracker.tsx` - Updated with sign-out functionality

## Security Notes

- Never commit your `.env.local` file to version control
- Keep your `GOOGLE_CLIENT_SECRET` and `NEXTAUTH_SECRET` secure
- Use strong, randomly generated secrets
- Regularly rotate your secrets in production
