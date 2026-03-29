const express = require('express');
const router = express.Router();

// Import admin controllers
const superAdminController = require('../controllers/superAdminController');
const adminAccountingController = require('../controllers/adminAccountingController');

// SuperAdmin Dashboard
router.get('/dashboard', superAdminController.getPlatformStats);

// Business Management
router.get('/businesses', superAdminController.getBusinesses);
router.post('/businesses/:id/status', superAdminController.updateBusinessStatus);
router.post('/businesses/:id/approve', superAdminController.approveBusiness);
router.post('/businesses/:id/reject', superAdminController.notImplemented);
router.post('/businesses/:id/subscription', superAdminController.notImplemented);

// User Management (SuperAdmin only)
router.get('/users/all', superAdminController.notImplemented);
router.post('/users/:userId/status', superAdminController.notImplemented);

// Orders
router.get('/orders/all', superAdminController.notImplemented);

// Accounting Management (Admin Accounting APIs)
router.get('/accounting/accounts', adminAccountingController.getAllAccounts);
router.get('/accounting/transactions', adminAccountingController.getAllTransactions);
router.get('/accounting/analytics', adminAccountingController.getFinancialAnalytics);
router.get('/accounting/reconciliation', adminAccountingController.getAccountReconciliation);

// Membership Plans
router.get('/membership-plans', superAdminController.notImplemented);
router.post('/membership-plans', superAdminController.notImplemented);
router.put('/membership-plans/:id', superAdminController.notImplemented);
router.delete('/membership-plans/:id', superAdminController.notImplemented);

// Partner Types
router.get('/partner-types', superAdminController.notImplemented);
router.post('/partner-types', superAdminController.notImplemented);
router.put('/partner-types/:id', superAdminController.notImplemented);
router.delete('/partner-types/:id', superAdminController.notImplemented);

// Partner Wallets
router.get('/partner-wallets', superAdminController.notImplemented);
router.post('/partner-wallets/credit', superAdminController.notImplemented);

// Partner Memberships
router.get('/partner-memberships', superAdminController.notImplemented);

// Settings
router.get('/settings', superAdminController.notImplemented);
router.put('/settings', superAdminController.notImplemented);

// Web Content
router.get('/web-content/:page', superAdminController.notImplemented);
router.put('/web-content/:page', superAdminController.notImplemented);

// User Permissions
router.post('/users/:userId/permissions', superAdminController.notImplemented);

// Sub Admin Creation
router.post('/users/create-sub-admin', superAdminController.notImplemented);

// Feature Flags
router.get('/feature-flags', superAdminController.notImplemented);
router.post('/feature-flags', superAdminController.notImplemented);
router.put('/feature-flags/:id', superAdminController.notImplemented);
router.delete('/feature-flags/:id', superAdminController.notImplemented);
router.post('/feature-flags/:id/toggle', superAdminController.notImplemented);

// Audit Logs
router.get('/logs', superAdminController.notImplemented);

// Analytics & Infrastructure
router.get('/analytics', superAdminController.notImplemented);
router.get('/infrastructure', superAdminController.notImplemented);

// User Impersonation
router.post('/users/:userId/impersonate', superAdminController.notImplemented);

// Stats
router.get('/stats', superAdminController.getPlatformStats);

module.exports = router;
