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
router.post('/businesses/:id/reject', superAdminController.rejectBusiness);
router.post('/businesses/:id/subscription', superAdminController.updateBusinessSubscription);

// User Management (SuperAdmin only)
router.get('/users/all', superAdminController.getAllUsers);
router.post('/users/:userId/status', superAdminController.updateUserStatus);

// Orders
router.get('/orders/all', superAdminController.getAllOrders);

// Accounting Management (Admin Accounting APIs)
router.get('/accounting/accounts', adminAccountingController.getAllAccounts);
router.get('/accounting/transactions', adminAccountingController.getAllTransactions);
router.get('/accounting/analytics', adminAccountingController.getFinancialAnalytics);
router.get('/accounting/reconciliation', adminAccountingController.getAccountReconciliation);

// Membership Plans
router.get('/membership-plans', superAdminController.getMembershipPlans);
router.post('/membership-plans', superAdminController.createMembershipPlan);
router.put('/membership-plans/:id', superAdminController.updateMembershipPlan);
router.delete('/membership-plans/:id', superAdminController.deleteMembershipPlan);

// Partner Types
router.get('/partner-types', superAdminController.getPartnerTypes);
router.post('/partner-types', superAdminController.createPartnerType);
router.put('/partner-types/:id', superAdminController.updatePartnerType);
router.delete('/partner-types/:id', superAdminController.deletePartnerType);

// Partner Wallets
router.get('/partner-wallets', superAdminController.getPartnerWallets);
router.post('/partner-wallets/credit', superAdminController.creditPartnerWallet);

// Partner Memberships
router.get('/partner-memberships', superAdminController.getPartnerMemberships);

// Settings
router.get('/settings', superAdminController.getSettings);
router.put('/settings', superAdminController.updateSettings);

// Web Content
router.get('/web-content/:page', superAdminController.getWebContent);
router.put('/web-content/:page', superAdminController.updateWebContent);

// User Permissions
router.post('/users/:userId/permissions', superAdminController.updateSubAdminPermissions);

// Sub Admin Creation
router.post('/users/create-sub-admin', superAdminController.createSubAdmin);

// Feature Flags
router.get('/feature-flags', superAdminController.getFeatureFlags);
router.post('/feature-flags', superAdminController.createFeatureFlag);
router.put('/feature-flags/:id', superAdminController.updateFeatureFlag);
router.delete('/feature-flags/:id', superAdminController.deleteFeatureFlag);
router.post('/feature-flags/:id/toggle', superAdminController.toggleFeatureFlag);

// Audit Logs
router.get('/logs', superAdminController.getAuditLogs);

// Analytics & Infrastructure
router.get('/analytics', superAdminController.getAnalyticsData);
router.get('/infrastructure', superAdminController.getInfrastructureStatus);

// User Impersonation
router.post('/users/:userId/impersonate', superAdminController.impersonateUser);

// Stats
router.get('/stats', superAdminController.getPlatformStats);

module.exports = router;
