# Login API Verification Guide

## 🎯 Overview
This guide provides comprehensive steps to verify that the login API is working properly.

## 📋 Verification Steps

### Step 1: Run Comprehensive Verification
```bash
cd /Users/admin/Downloads/Projects/brewwlabs_billing/pos-backend
node comprehensive_login_verification.js
```

### Step 2: Run End-to-End Test
```bash
node end_to_end_login_test.js
```

### Step 3: Manual HTTP Test
After running the tests, use the credentials from the test output:

```bash
curl --location 'http://localhost:8000/api/auth/login' \
--header 'Content-Type: application/json' \
--data-raw '{
  "email": "loginadmintest1738139456@cafe.com",
  "password": "Password123!"
}'
```

## 🔍 Expected Results

### Successful Response:
```json
{
    "success": true,
    "message": "Login successful",
    "user": {
        "id": "uuid-here",
        "name": "Login Test Admin",
        "email": "loginadmintest1738139456@cafe.com",
        "role": "ADMIN",
        "businessId": "uuid-here",
        "outletId": "uuid-here",
        "panelType": "TENANT"
    },
    "accessToken": "jwt-token-here",
    "refreshToken": "jwt-token-here"
}
```

## 🚨 Troubleshooting

### If "Invalid credentials" error:
1. Check if user was created in shared database
2. Verify email spelling and case
3. Ensure password is exactly "Password123!"

### If connection errors:
1. Ensure server is running: `npm start`
2. Check database connections
3. Verify environment variables

### If server not responding:
1. Check if port 8000 is available
2. Look for server startup errors
3. Try different port if needed

## 🔧 Components Being Tested

1. **Database Connections**: Shared and control plane databases
2. **Model Loading**: User model with proper schema
3. **Password Hashing**: bcrypt password verification
4. **AuthService**: Core login logic
5. **Token Generation**: JWT access and refresh tokens
6. **HTTP Endpoint**: /api/auth/login route
7. **Middleware**: Public route access (no auth required)

## 📊 Verification Checklist

- [ ] Server starts without errors
- [ ] Database connections successful
- [ ] User model loads correctly
- [ ] Test user created successfully
- [ ] Password verification works
- [ ] AuthService login succeeds
- [ ] Tokens generated properly
- [ ] HTTP endpoint returns success
- [ ] Response contains user data and tokens
- [ ] No authentication errors in logs

## 🎉 Success Criteria

The login API is working properly when:
1. ✅ Onboarding creates users in shared database
2. ✅ AuthService validates credentials correctly
3. ✅ JWT tokens are generated successfully
4. ✅ HTTP endpoint returns success response
5. ✅ Response contains all required user fields
6. ✅ No errors in server logs

## 📞 Support

If issues persist, check the log files:
- `login_verification.log` - from comprehensive verification
- Server console output for real-time errors
- Database logs for connection issues
