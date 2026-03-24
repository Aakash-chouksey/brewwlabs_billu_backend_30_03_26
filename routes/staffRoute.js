/**
 * STAFF ROUTES
 * Maps to frontend API calls from StaffMaster.jsx
 */

const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');

// GET /api/tenant/staff
router.get('/staff', staffController.getStaff);

// POST /api/tenant/staff
router.post('/staff', staffController.createStaff);

// PUT /api/tenant/staff/:id
router.put('/staff/:id', staffController.updateStaff);

// DELETE /api/tenant/staff/:id
router.delete('/staff/:id', staffController.deleteStaff);

// Also support /api/tenant/users (alias)
router.get('/users', staffController.getStaff);

module.exports = router;
