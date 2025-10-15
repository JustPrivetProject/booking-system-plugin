# Brevo Email Notifications - Quick Start

## 🚀 Quick Setup (5 minutes)

### 1. Get Brevo API Key
1. Sign up at [brevo.com](https://www.brevo.com/)
2. Go to `Settings` → `SMTP & API` 
3. Click `Generate a new API key`
4. Copy the key (starts with `xkeysib-`)

### 2. Configure Environment

#### Local Development:
```bash
# Copy example file
cp env.example .env

# Add your API key to .env
echo "BREVO_API_KEY=xkeysib-your-api-key-here" >> .env
```

#### Production (GitHub Actions):
1. Go to repository `Settings` → `Secrets and variables` → `Actions`
2. Add new secret: `BREVO_API_KEY` = `your-api-key-here`

### 3. Test Setup
```bash
# Build extension
npm run build

# Test in browser console (background context)
brevoEmailService.testConnection().then(console.log);
```

### 4. Configure Notifications
1. Open extension popup
2. Click "Powiadomienia" button  
3. Enable email notifications
4. Enter your email address
5. Save settings

## ✅ Done!
Email notifications will now be sent automatically when bookings succeed.

---

📖 **Full Documentation**: [docs/ENVIRONMENT_SETUP.md](docs/ENVIRONMENT_SETUP.md)  
🔧 **Brevo Setup Guide**: [docs/implementation/BREVO_SETUP.md](docs/implementation/BREVO_SETUP.md)
