const express = require("express");
const { addArea, getAreas, updateArea, deleteArea } = require("../controllers/areaController");

const { tenantRoutingMiddleware } = require("../middlewares/tenantRouting");

const { authorize } = require("../middlewares/tenantMiddleware");
const router = express.Router();

// Middleware is applied at app level: isVerifiedUser → tenantRoutingMiddleware → tenantOnlyMiddleware
// No middleware needed here - routes are already protected

router.route("/").post(authorize(['SUPER_ADMIN', 'BusinessAdmin', 'Manager']), addArea).get(getAreas);
router.route("/:id").put(authorize(['SUPER_ADMIN', 'BusinessAdmin', 'Manager']), updateArea).delete(authorize(['SUPER_ADMIN', 'BusinessAdmin', 'Manager']), deleteArea);

module.exports = router;
