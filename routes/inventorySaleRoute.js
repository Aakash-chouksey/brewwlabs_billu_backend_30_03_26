const router = require("express").Router();
const { addInventorySale, getInventorySales } = require("../controllers/inventorySaleController");
const { tenantRoutingMiddleware } = require("../middlewares/tenantRouting");

// Apply authentication and tenant routing

router.post("/", addInventorySale);
router.get("/", getInventorySales);

module.exports = router;
