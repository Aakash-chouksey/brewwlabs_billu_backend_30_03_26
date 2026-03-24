-- Migration to align inventory and recipe tables with new requirements

-- 1. Update inventory_items table
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS sku VARCHAR(255);
ALTER TABLE inventory_items RENAME COLUMN minimum_stock_level TO minimum_stock;

-- 2. Update inventory_transactions table
-- Handle ENUM update for transaction_type
-- type: DataTypes.ENUM('PURCHASE', 'SELL', 'SELF_CONSUME', 'WASTAGE', 'ADJUSTMENT', 'TRANSFER_IN', 'TRANSFER_OUT')
-- New requirements: PURCHASE, SALE, SELF_CONSUME, WASTAGE, ADJUSTMENT

ALTER TABLE inventory_transactions RENAME COLUMN type TO transaction_type;
ALTER TABLE inventory_transactions RENAME COLUMN note TO reason;

-- 3. Update recipe_items table
ALTER TABLE recipe_items RENAME COLUMN quantity_required TO quantity_required_new;
ALTER TABLE recipe_items ADD COLUMN quantity_required DECIMAL(10, 3);
UPDATE recipe_items SET quantity_required = CAST(quantity_required_new AS DECIMAL(10, 3));
ALTER TABLE recipe_items DROP COLUMN quantity_required_new;
