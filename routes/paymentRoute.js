const express = require("express");
const { tenantRoutingMiddleware } = require("../middlewares/tenantRouting");

const { createOrder, verifyPayment, webHookVerification } = require("../controllers/paymentController");

const { authorize } = require("../middlewares/tenantMiddleware");
const router = express.Router();

// Middleware is applied at app level: isVerifiedUser → tenantRoutingMiddleware → tenantOnlyMiddleware
// No middleware needed here - routes are already protected

// Webhook is public (Razorpay calls it)
router.route("/webhook-verification").post(webHookVerification);

router.route("/create-order").post(authorize(['SUPER_ADMIN', 'BusinessAdmin', 'Manager', 'Cashier', 'Waiter']), createOrder);
router.route("/verify-payment").post(authorize(['SUPER_ADMIN', 'BusinessAdmin', 'Manager', 'Cashier', 'Waiter']), verifyPayment);

module.exports = router;