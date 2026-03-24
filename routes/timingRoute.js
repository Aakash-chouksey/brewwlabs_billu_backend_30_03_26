const router = require("express").Router();
const { createTiming, getTimings, updateTiming, deleteTiming } = require("../controllers/timingController");

const { tenantRoutingMiddleware } = require("../middlewares/tenantRouting");

const { authorize } = require("../middlewares/tenantMiddleware");

router.post("/", authorize(['SUPER_ADMIN', 'BusinessAdmin', 'Manager']), createTiming);
router.get("/", getTimings);
router.put("/:id", authorize(['SUPER_ADMIN', 'BusinessAdmin', 'Manager']), updateTiming);
router.delete("/:id", authorize(['SUPER_ADMIN', 'BusinessAdmin', 'Manager']), deleteTiming);

module.exports = router;
