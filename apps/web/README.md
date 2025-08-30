# TheraVillage Frontend

A modern, responsive login page with Google Sign-In integration.

## 🚀 Quick Start

### 1. Get Your Firebase Web App Client ID
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your TheraVillage project
3. Go to **Project Settings** → **General** tab
4. Scroll down to **Your apps** section
5. Click **Add app** → **Web app** if you don't have one
6. Copy the **Client ID** (looks like: `123456789-abcdef...`)

### 2. Update the Client ID
In `index.html`, replace:
```html
data-client_id="YOUR_FIREBASE_WEB_APP_CLIENT_ID"
```
with your actual Client ID.

### 3. Test Locally
Open `index.html` in your browser to test the design.

## 📁 Files

- **`index.html`** - Main login page with Google Sign-In
- **`styles.css`** - Modern, responsive styling
- **`app.js`** - JavaScript for authentication logic

## 🔧 Features

✅ **Google Sign-In** - Integrated with Firebase  
✅ **Responsive Design** - Works on all devices  
✅ **Modern UI** - Clean, professional look  
✅ **Demo Mode** - Test without Google account  
✅ **Error Handling** - User-friendly messages  

## 🚀 Deploy to Firebase Hosting

Once you're ready to deploy:

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase Hosting
firebase init hosting

# Deploy
firebase deploy
```

## 🔗 Connect to Backend

This frontend is ready to connect to your Cloud Run API. The JavaScript will send authentication tokens to your backend for verification.

## 🎨 Customization

- **Colors**: Update the CSS variables in `styles.css`
- **Logo**: Replace the emoji with your actual logo
- **Branding**: Update text and styling to match your brand
