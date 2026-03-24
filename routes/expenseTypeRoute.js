const router = require("express").Router();
const { createExpenseType, getExpenseTypes, updateExpenseType, deleteExpenseType } = require("../controllers/expenseTypeController");
const { tenantRoutingMiddleware } = require("../middlewares/tenantRouting");

router.post("/", createExpenseType);
router.get("/", getExpenseTypes);
router.put("/:id", updateExpenseType);
router.delete("/:id", deleteExpenseType);

module.exports = router;
