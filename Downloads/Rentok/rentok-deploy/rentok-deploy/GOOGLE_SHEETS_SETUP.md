# Rentok Beta — Google Sheets Setup Guide

## Step 1: Create your Google Sheet

1. Go to sheets.google.com
2. Create a new sheet named: **Rentok Beta Registrations**
3. Add these headers in Row 1:
   - A1: Timestamp
   - B1: Name
   - C1: Phone
   - D1: Email
   - E1: City
   - F1: Flats
   - G1: Role
   - H1: Plan
   - I1: Source

---

## Step 2: Create the Google Apps Script

1. In your Google Sheet, click **Extensions → Apps Script**
2. Delete any existing code
3. Paste this code:

```javascript
function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = JSON.parse(e.postData.contents);
    
    sheet.appendRow([
      data.timestamp || new Date().toLocaleString(),
      data.name || "",
      data.phone || "",
      data.email || "",
      data.city || "",
      data.flats || "",
      data.role || "",
      data.plan || "",
      data.source || "Rentok Beta Landing Page",
    ]);
    
    return ContentService
      .createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Rentok Beta Registration API is running.");
}
```

4. Click **Save** (give it any project name, e.g. "Rentok Beta")

---

## Step 3: Deploy as Web App

1. Click **Deploy → New deployment**
2. Click the gear icon next to "Select type" → choose **Web app**
3. Set:
   - Description: `Rentok Beta Registration`
   - Execute as: **Me**
   - Who has access: **Anyone** ← IMPORTANT
4. Click **Deploy**
5. Click **Authorize access** → Choose your Google account → Allow
6. **Copy the Web App URL** — it looks like:
   `https://script.google.com/macros/s/AKfycb.../exec`

---

## Step 4: Add URL to the app

Open `src/App.jsx` and find this line (around line 162):

```javascript
const SHEET_URL="https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec";
```

Replace `YOUR_SCRIPT_ID` with your actual script ID from the URL above.

---

## Step 5: Test it

1. Open your Rentok site
2. Click "Join Beta →"
3. Fill the form and submit
4. Check your Google Sheet — a new row should appear within seconds!

---

## Troubleshooting

- **No data in sheet?** Make sure "Who has access" is set to "Anyone" (not "Anyone with Google account")
- **Old script URL not working?** Re-deploy with a new deployment (don't edit existing)
- **Want email alerts?** In Apps Script, go to the sheet and set up a notification rule via Tools → Notification rules

---

## What gets captured

Every registration records:
- Timestamp (Indian time)
- Name + WhatsApp number + Email
- City
- Number of flats/rooms
- Role (Owner / PG Owner / Both)
- Plan they're interested in
- Source (always "Rentok Beta Landing Page")
