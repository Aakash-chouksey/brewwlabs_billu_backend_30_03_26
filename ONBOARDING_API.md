# Business Onboarding API Documentation

## Overview
The business onboarding API allows new businesses to register and create an admin account. The registration process creates a pending business that requires SuperAdmin approval before the admin can access the system.

## Endpoint
```
POST /api/user/onboard
```

## Authentication
- **Required**: No (Public endpoint)
- **Headers**: 
  - `Content-Type: application/json`

## Request Body

### Required Fields
| Field | Type | Description | Validation |
|-------|------|-------------|------------|
| `businessName` | String | Name of the business | Required, non-empty |
| `businessEmail` | String | Business email address | Required, valid email format |
| `adminName` | String | Admin account name | Required, non-empty |
| `adminEmail` | String | Admin email address | Required, valid email format |
| `adminPassword` | String | Admin account password | Required, min 6 characters |

### Optional Fields
| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `businessPhone` | String | Business phone number | null |
| `businessAddress` | String | Business physical address | null |
| `adminPhone` | String | Admin phone number | null |
| `subscriptionPlan` | String | Subscription plan tier | "basic" |

### Subscription Plan Options
- `"basic"` - $29.99/month (1 outlet, 5 users, 100 products)
- `"pro"` - $99.99/month (5 outlets, 20 users, 500 products)  
- `"enterprise"` - $299.99/month (unlimited)

## Request Example

### Successful Registration
```json
{
  "businessName": "My Restaurant",
  "businessEmail": "contact@myrestaurant.com",
  "businessPhone": "+1234567890",
  "businessAddress": "123 Main Street, City, Country",
  "adminName": "John Doe",
  "adminEmail": "john@myrestaurant.com",
  "adminPhone": "+1234567891",
  "adminPassword": "secure123",
  "subscriptionPlan": "basic"
}
```

## Response

### Success Response (201 Created)
```json
{
  "success": true,
  "message": "Business registration submitted successfully. Your account is pending approval.",
  "data": {
    "business": {
      "id": "uuid-string",
      "name": "My Restaurant",
      "email": "contact@myrestaurant.com",
      "status": "pending",
      "subscription_plan": "basic"
    },
    "nextSteps": "Wait for SuperAdmin approval. You will be notified once your business is approved."
  }
}
```

### Error Responses

#### Missing Required Fields (400 Bad Request)
```json
{
  "success": false,
  "status": 400,
  "message": "Missing required fields: businessName, businessEmail, adminName, adminEmail, adminPassword",
  "errorType": "BadRequestError"
}
```

#### Invalid Email Format (400 Bad Request)
```json
{
  "success": false,
  "status": 400,
  "message": "Invalid business email format",
  "errorType": "BadRequestError"
}
```

#### Password Too Short (400 Bad Request)
```json
{
  "success": false,
  "status": 400,
  "message": "Admin password must be at least 6 characters long",
  "errorType": "BadRequestError"
}
```

#### Business Email Already Exists (409 Conflict)
```json
{
  "success": false,
  "status": 409,
  "message": "Business with this email already exists",
  "errorType": "ConflictError"
}
```

#### Server Error (500 Internal Server Error)
```json
{
  "success": false,
  "status": 500,
  "message": "Internal server error",
  "errorType": "InternalServerError"
}
```

## Business Status Flow

1. **pending** - Business registered, awaiting SuperAdmin approval
2. **active** - Business approved, admin can access the system
3. **suspended** - Business temporarily suspended
4. **trial** - Business in trial period

## Frontend Implementation Guidelines

### Form Validation
Implement client-side validation for better user experience:

```javascript
const validateForm = (formData) => {
    const errors = {};
    
    // Required fields
    if (!formData.businessName?.trim()) {
        errors.businessName = 'Business name is required';
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.businessEmail?.trim()) {
        errors.businessEmail = 'Business email is required';
    } else if (!emailRegex.test(formData.businessEmail)) {
        errors.businessEmail = 'Invalid email format';
    }
    
    // Password validation
    if (!formData.adminPassword?.trim()) {
        errors.adminPassword = 'Password is required';
    } else if (formData.adminPassword.length < 6) {
        errors.adminPassword = 'Password must be at least 6 characters';
    }
    
    return errors;
};
```

### Error Handling
Handle backend errors gracefully:

```javascript
try {
    const response = await fetch('/api/user/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
    });
    
    const result = await response.json();
    
    if (result.success) {
        // Show success message
        showSuccess(result.message);
        // Reset form
        resetForm();
    } else {
        // Handle specific errors
        handleBackendError(result.message);
    }
} catch (error) {
    // Handle network errors
    showError('Network error. Please try again.');
}
```

### Success Flow
After successful registration:

1. Display success message with business details
2. Inform user about approval process
3. Optionally provide business ID for reference
4. Clear the form
5. Show next steps (wait for approval)

## Security Considerations

- Passwords are hashed using bcrypt (10 rounds)
- Input validation prevents SQL injection
- Email format validation prevents invalid data
- Rate limiting should be implemented for abuse prevention
- HTTPS should be used in production

## Testing

### Test Cases
1. ✅ Valid registration with all fields
2. ✅ Missing required fields
3. ✅ Invalid email formats
4. ✅ Short password
5. ✅ Duplicate business email
6. ✅ Optional fields omitted
7. ✅ Different subscription plans

### Test Command
```bash
curl -X POST http://localhost:8000/api/user/onboard \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Test Restaurant",
    "businessEmail": "test@restaurant.com",
    "adminName": "Test Admin",
    "adminEmail": "admin@testrestaurant.com",
    "adminPassword": "test123"
  }'
```

## Next Steps After Registration

1. **SuperAdmin Approval**: Business must be approved by SuperAdmin
2. **Tenant Database Creation**: After approval, tenant database is created
3. **Admin Account Creation**: Admin user account is activated
4. **Login**: Admin can login with provided credentials
5. **Setup**: Admin can configure outlets, categories, products, etc.

## Support

For issues with the onboarding API:
- Check server logs for detailed error messages
- Verify database connection and schema
- Ensure all required environment variables are set
- Contact development team for assistance
