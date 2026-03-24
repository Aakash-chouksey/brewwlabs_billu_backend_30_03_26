const express = require("express");
const { addTable, getTables, updateTable, deleteTable } = require("../controllers/tableController");
const { tenantRoutingMiddleware } = require("../middlewares/tenantRouting");

const { authorize } = require("../middlewares/tenantMiddleware");
const router = express.Router();

// Middleware is applied at app level: isVerifiedUser → tenantRoutingMiddleware → tenantOnlyMiddleware
// No middleware needed here - routes are already protected

router.route("/").post(authorize(['SUPER_ADMIN', 'BusinessAdmin', 'Manager']), addTable).get(getTables);
router.route("/:id").put(authorize(['SUPER_ADMIN', 'BusinessAdmin', 'Manager']), updateTable).delete(authorize(['SUPER_ADMIN', 'BusinessAdmin', 'Manager']), deleteTable);

module.exports = router;