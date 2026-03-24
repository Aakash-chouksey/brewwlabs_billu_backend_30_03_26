const express = require("express");
const { createAccount, getAccounts, addTransaction, getTransactions } = require("../controllers/accountingController");

const { tenantRoutingMiddleware } = require("../middlewares/tenantRouting");
const { authorize } = require("../middlewares/tenantMiddleware");
const router = express.Router();

// Apply tenant routing middleware to all accounting routes
router.use(tenantRoutingMiddleware);

// Apply authorization middleware to all accounting routes
router.use(authorize(['SUPER_ADMIN', 'BusinessAdmin', 'Manager', 'Cashier']));

// Accounting routes
router.route("/accounts").post(createAccount);
router.route("/accounts").get(getAccounts);
router.route("/transactions").post(addTransaction);
router.route("/transactions").get(getTransactions);

module.exports = router;
