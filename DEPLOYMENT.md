# Render Deployment Guide

## IPv6/IPv4 Connection Fix

This deployment includes fixes for the "ENETUNREACH" error that occurs when deploying Node.js applications with PostgreSQL on Render.

### Key Changes Made

1. **IPv4-First DNS Resolution**: Forces Node.js to use IPv4 instead of IPv6
2. **Neon PostgreSQL SSL Configuration**: Proper SSL settings for Neon database
3. **Channel Binding Removal**: Removes `channel_binding=require` from connection string
4. **Enhanced Error Handling**: Better error messages for network issues

### Environment Variables

Set these in your Render dashboard:

```bash
NODE_ENV=production
POSTGRES_URI=your_neon_database_url
JWT_SECRET=your_jwt_secret
PORT=8000
```

### Render Configuration

#### Build Command
```bash
npm install
```

#### Start Command
```bash
npm run render-start
```

### What the Fix Does

1. **DNS Configuration** (in `app.js`):
   ```javascript
   const dns = require('dns');
   dns.setDefaultResultOrder('ipv4first');
   
   if (process.env.NODE_ENV === 'production') {
     dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1']);
   }
   ```

2. **Database Configuration** (in `config/database_postgres.js`):
   - Forces IPv4 connection with `family: 4`
   - Proper SSL settings for Neon
   - Removes channel binding issues
   - Enhanced connection pooling

3. **URI Processing** (in `config/config.js`):
   - Automatically removes `channel_binding=require`
   - Adds `sslmode=require` for Neon databases
   - Validates and cleans the connection string

### Troubleshooting

If you still encounter connection issues:

1. **Check Database URL**: Ensure your Neon database URL is correct
2. **Verify SSL**: Neon requires SSL connections
3. **Network Rules**: Ensure Render can reach external databases
4. **Environment Variables**: Double-check all required env vars

### Local Development

For local development, the app will work with the original configuration:

```bash
npm run dev
```

The IPv4 fixes only activate in production mode.

### Monitoring

The app now provides better error messages:
- `ENETUNREACH`: IPv6/IPv4 resolution issue
- `ENOTFOUND`: DNS resolution problem
- Connection retry logic with exponential backoff

This should resolve the IPv6/IPv4 connection issues on Render while maintaining compatibility with local development.
