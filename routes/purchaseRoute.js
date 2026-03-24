const router = require("express").Router();
const { addPurchase, getPurchases } = require("../controllers/purchaseController");
const { tenantRoutingMiddleware } = require("../middlewares/tenantRouting");

const { authorize } = require("../middlewares/tenantMiddleware");

router.post("/", authorize(['SUPER_ADMIN', 'BusinessAdmin', 'Manager']), addPurchase);
router.get("/", getPurchases);

module.exports = router;
