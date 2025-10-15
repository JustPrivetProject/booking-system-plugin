# Environment Variables Setup

This document explains how to configure environment variables for the Brama Extension.

## Overview

The extension uses environment variables for:
- **Email notifications** via Brevo API
- **Data encryption** for secure storage
- **Backend services** via Supabase
- **Build configuration** for different environments

## Required Variables

### Core Variables
| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `BREVO_API_KEY` | Brevo API key for email notifications | Yes* | `xkeysib-...` |
| `CRYPTO_SECRET_KEY` | Secret key for data encryption | Yes | `your_secret_key` |
| `SUPABASE_URL` | Supabase project URL | Yes | `https://xyz.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Yes | `eyJhbGciOiJ...` |

*Required only if email notifications are used

## Local Development Setup

### 1. Create Environment File
```bash
# Copy the example file
cp env.example .env

# Or create manually
touch .env
```

### 2. Configure Variables
Edit `.env` file with your actual values:

```env
# Brevo API for email notifications
BREVO_API_KEY=xkeysib-1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z

# Crypto secret for encryption
CRYPTO_SECRET_KEY=your_very_secure_secret_key_here

# Supabase configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Verify Setup
The variables are automatically loaded during build:
```bash
npm run build:dev    # Development build
npm run build        # Production build
```

## Production Deployment

### GitHub Actions Secrets
Set these secrets in your GitHub repository settings (`Settings` → `Secrets and variables` → `Actions`):

#### Production Environment (`prod`)
- `BREVO_API_KEY`
- `CRYPTO_SECRET_KEY`  
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

#### Development Environment (`dev`)
- Same variables as production (can use different values for testing)

### CI/CD Integration
The variables are automatically injected during build in GitHub Actions:

```yaml
# .github/workflows/release.yml
- name: Setup environment variables
  run: |
      echo "BREVO_API_KEY=${{ secrets.BREVO_API_KEY }}" >> .env
      echo "CRYPTO_SECRET_KEY=${{ secrets.CRYPTO_SECRET_KEY }}" >> .env
      echo "SUPABASE_URL=${{ secrets.SUPABASE_URL }}" >> .env
      echo "SUPABASE_ANON_KEY=${{ secrets.SUPABASE_ANON_KEY }}" >> .env
```

## Service-Specific Setup

### Brevo Email Service

#### 1. Create Brevo Account
- Sign up at [brevo.com](https://www.brevo.com/)
- Verify your account and domain (if using custom sender)

#### 2. Generate API Key
- Go to `Settings` → `SMTP & API`
- Click `Generate a new API key`
- Copy the key (starts with `xkeysib-`)

#### 3. Configure Sender Email
Update `src/services/brevoEmailService.ts`:
```typescript
sender: {
    name: 'Your App Name',
    email: 'noreply@yourdomain.com', // Must be verified in Brevo
}
```

### Supabase Backend

#### 1. Create Project
- Sign up at [supabase.com](https://supabase.com/)
- Create a new project

#### 2. Get Credentials
- Go to `Settings` → `API`
- Copy the `Project URL` and `anon public` key

### Crypto Secret Key

Generate a secure random key:
```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using OpenSSL
openssl rand -hex 32

# Using Python
python -c "import secrets; print(secrets.token_hex(32))"
```

## Build Process Integration

### Webpack Configuration
The extension uses `dotenv-webpack` to load environment variables:

```javascript
// webpack.config.js
plugins: [
    new Dotenv(), // Automatically loads .env file
    // ... other plugins
]
```

### Runtime Access
Variables are available in the code as:
```typescript
const apiKey = process.env.BREVO_API_KEY;
const supabaseUrl = process.env.SUPABASE_URL;
```

## Security Considerations

### Environment Files
- ✅ `.env` is in `.gitignore` (never commit)
- ✅ Use `env.example` for documentation
- ✅ Different values for dev/staging/prod environments

### API Keys
- 🔒 Store in GitHub Secrets (encrypted)
- 🔒 Use least-privilege permissions
- 🔒 Rotate keys regularly
- 🔒 Monitor usage in service dashboards

### Best Practices
1. **Never log** environment variables
2. **Validate** required variables at startup
3. **Use different keys** for different environments
4. **Document** all required variables
5. **Test** builds without variables to catch missing dependencies

## Troubleshooting

### Common Issues

#### Build Fails with "BREVO_API_KEY is not defined"
```bash
# Check if .env file exists
ls -la .env

# Verify content
cat .env | grep BREVO_API_KEY
```

#### Email notifications not working
```bash
# Verify API key in browser console (background context)
console.log(process.env.BREVO_API_KEY ? 'API key loaded' : 'API key missing');

# Test connection
brevoEmailService.testConnection().then(console.log);
```

#### Webpack not loading variables
```bash
# Reinstall dotenv-webpack
npm install --save-dev dotenv-webpack

# Clean build
rm -rf dist/ && npm run build
```

### Debug Commands

Check loaded variables (in browser console, background context):
```javascript
// Check if variables are loaded
console.log({
    brevo: !!process.env.BREVO_API_KEY,
    crypto: !!process.env.CRYPTO_SECRET_KEY,
    supabase: !!process.env.SUPABASE_URL
});

// Test services
notificationService.getNotificationStatus().then(console.log);
```

## Migration Notes

### From Hardcoded to Environment Variables
If migrating from hardcoded API keys:

1. **Extract** hardcoded values to environment variables
2. **Update** service configurations
3. **Add** variables to CI/CD pipelines
4. **Test** builds in all environments
5. **Remove** old hardcoded values

### Version Compatibility
- **v2.1.13+**: Uses `process.env.BREVO_API_KEY`
- **Earlier versions**: Required manual configuration in code

For questions or issues, see the main [README.md](../README.md) or create an issue on GitHub.
