const router = require("express").Router();
const { addCategory, getCategories, updateCategory, deleteCategory } = require("../controllers/inventoryCategoryController");

router.post("/", addCategory);
router.get("/", getCategories);
router.put("/:id", updateCategory);
router.delete("/:id", deleteCategory);

module.exports = router;
