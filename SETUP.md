# Quick Setup Guide

## Installation

1. Copy the following files to your Obsidian vault's plugins folder:
   ```
   <vault>/.obsidian/plugins/blockhead-calendar/
   ├── main.js
   ├── manifest.json
   └── styles.css
   ```

2. Enable the plugin in Obsidian:
   - Open Settings
   - Go to Community Plugins
   - Enable "Blockhead Calendar"

## Azure AD Configuration

### Step 1: Create App Registration

1. Visit [Azure Portal](https://portal.azure.com)
2. Go to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Configure:
   - **Name**: Blockhead Calendar
   - **Account types**: "Accounts in any organizational directory and personal Microsoft accounts"
   - **Redirect URI**: Leave blank (not needed for device code flow)
5. Click **Register**

**IMPORTANT**: After registration, you must enable Device Code Flow:
1. In your app, go to **Authentication**
2. Scroll down to **Advanced settings** → **Allow public client flows**
3. Set **Enable the following mobile and desktop flows** to **Yes**
4. Click **Save**

### Step 2: Add API Permissions

1. In your app, go to **API permissions**
2. Click **Add a permission** → **Microsoft Graph** → **Delegated permissions**
3. Add these permissions:
   - `Calendars.Read`
   - `User.Read`
4. Click **Add permissions**

**Note for Work/School Accounts**: If you see "Admin consent required", you have two options:
- **Option A**: Ask your IT administrator to click **"Grant admin consent for [Your Org]"**
- **Option B**: Use a personal Microsoft account instead (see troubleshooting below)

### Step 3: Get Your IDs

From the **Overview** page, copy:
- **Application (client) ID** - looks like: `12345678-1234-1234-1234-123456789abc`
- **Directory (tenant) ID** - looks like: `87654321-4321-4321-4321-cba987654321`

### Step 4: Configure Plugin

1. In Obsidian, go to Settings → Blockhead Calendar
2. Paste your **Client ID**
3. Paste your **Tenant ID** (or use `common` for multi-tenant)
4. Click **Sign In**
5. A dialog will appear with a code (e.g., `ABC-DEF-GHI`)
6. Click "Copy Code" and "Open Login Page"
7. In your browser, go to the Microsoft device activation page
8. Paste the code and sign in with your Microsoft account
9. After successful authorization, return to Obsidian
10. Click "I've Signed In" in the dialog

## Usage

### View Calendar
- Click the calendar icon in the left ribbon
- Or use Command Palette: "Open Calendar View"

### Insert Today's Events
1. Open your daily note
2. Place cursor where you want events
3. Command Palette: "Insert Today's Events"

## Troubleshooting

### Authentication Issues

**"Admin consent required" error**:
- This happens with work/school accounts that require admin approval
- **Solution 1**: Ask your IT admin to grant consent in Azure Portal
- **Solution 2**: Use Tenant ID `consumers` to use a personal Microsoft account instead
- **Solution 3**: Create a new app with "Personal Microsoft accounts only" in Azure Portal

**Other authentication issues**:
- Make sure you enabled "Allow public client flows" in Azure AD (see Step 1)
- If the device code expires (15 minutes), just click Sign In again to get a new code
- Check that Client ID and Tenant ID are correct
- Verify you completed the sign-in in your browser before clicking "I've Signed In"
- After signing in, you may need to refresh the calendar view

**Using Personal Microsoft Account**:
- In plugin settings, set Tenant ID to: `consumers`
- This bypasses organizational restrictions
- Works with @outlook.com, @hotmail.com, @live.com accounts

### No Events Showing
- Click the Refresh button in the calendar view
- Check your Microsoft 365 account actually has calendar events
- Open browser console (Ctrl+Shift+I) to check for errors

### Build Issues
If you need to rebuild:
```bash
npm install
npm run build
```

## For Daily Notes

Add this template to automatically prompt for calendar insertion:

```markdown
# {{date:YYYY-MM-DD}}

## Calendar Events
<!-- Insert Today's Events command here -->

## Notes

```
