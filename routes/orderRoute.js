const express = require("express");
const { addOrder, getOrders, getOrderById, updateOrder } = require("../controllers/orderController");
const { tenantRoutingMiddleware } = require("../middlewares/tenantRouting");

const { authorize } = require("../middlewares/tenantMiddleware");
const router = express.Router();

// Middleware is applied at app level: isVerifiedUser → tenantRoutingMiddleware → tenantOnlyMiddleware
// No middleware needed here - routes are already protected

//  // Temporarily disabled for testing

const checkSubscriptionLimit = require("../middlewares/subscriptionCheck");

router.route("/").post(checkSubscriptionLimit, addOrder);
router.route("/").get(getOrders);
router.route("/:id").get(getOrderById);
router.route("/:id").put(updateOrder);

module.exports = router;