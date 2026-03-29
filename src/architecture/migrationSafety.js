/**
 * MIGRATION SAFETY - Concurrent & Idempotent Migration Controller
 * 
 * Prevents concurrent migrations
 * Ensures idempotency
 * Verifies rollback capability
 */

const { Sequelize } = require('sequelize');
const crypto = require('crypto');

class MigrationSafety {
    constructor(sequelize) {
        this.sequelize = sequelize;
        this.lockTable = 'migration_locks';
        this.lockTimeout = 300000; // 5 minutes
        this.instanceId = crypto.randomUUID();
    }

    /**
     * Initialize migration safety tables
     */
    async initialize() {
        try {
            // Create lock table
            await this.sequelize.query(`
                CREATE TABLE IF NOT EXISTS ${this.lockTable} (
                    id SERIAL PRIMARY KEY,
                    lock_name VARCHAR(100) UNIQUE NOT NULL,
                    instance_id VARCHAR(100) NOT NULL,
                    acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP NOT NULL,
                    metadata JSONB
                )
            `);

            // Create migration audit log
            await this.sequelize.query(`
                CREATE TABLE IF NOT EXISTS migration_audit_log (
                    id SERIAL PRIMARY KEY,
                    migration_name VARCHAR(255) NOT NULL,
                    direction VARCHAR(10) NOT NULL, -- 'up' or 'down'
                    tenant_schema VARCHAR(100),
                    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP,
                    status VARCHAR(20) NOT NULL, -- 'running', 'success', 'failed', 'rolled_back'
                    error_message TEXT,
                    checksum VARCHAR(64),
                    execution_time_ms INTEGER,
                    instance_id VARCHAR(100)
                )
            `);

            console.log('✅ [MigrationSafety] Safety tables initialized');
        } catch (error) {
            console.error('❌ [MigrationSafety] Failed to initialize:', error.message);
            throw error;
        }
    }

    /**
     * Acquire distributed lock for migration
     */
    async acquireLock(lockName, timeoutMs = this.lockTimeout) {
        const expiresAt = new Date(Date.now() + timeoutMs);
        
        try {
            // First, clear expired locks
            await this.sequelize.query(`
                DELETE FROM ${this.lockTable} WHERE expires_at < CURRENT_TIMESTAMP
            `);

            // Try to acquire lock
            await this.sequelize.query(`
                INSERT INTO ${this.lockTable} (lock_name, instance_id, expires_at, metadata)
                VALUES (:lockName, :instanceId, :expiresAt, :metadata)
            `, {
                replacements: {
                    lockName,
                    instanceId: this.instanceId,
                    expiresAt,
                    metadata: JSON.stringify({ pid: process.pid, nodeEnv: process.env.NODE_ENV })
                }
            });

            console.log(`🔒 [MigrationSafety] Lock acquired: ${lockName}`);
            return { acquired: true, instanceId: this.instanceId };

        } catch (error) {
            // Check if lock exists
            const [existing] = await this.sequelize.query(`
                SELECT * FROM ${this.lockTable} WHERE lock_name = :lockName
            `, {
                replacements: { lockName },
                type: Sequelize.QueryTypes.SELECT
            });

            if (existing) {
                return {
                    acquired: false,
                    lockedBy: existing.instance_id,
                    acquiredAt: existing.acquired_at,
                    expiresAt: existing.expires_at,
                    message: `Migration locked by ${existing.instance_id} since ${existing.acquired_at}`
                };
            }

            throw error;
        }
    }

    /**
     * Release distributed lock
     */
    async releaseLock(lockName) {
        try {
            await this.sequelize.query(`
                DELETE FROM ${this.lockTable} 
                WHERE lock_name = :lockName AND instance_id = :instanceId
            `, {
                replacements: { lockName, instanceId: this.instanceId }
            });

            console.log(`🔓 [MigrationSafety] Lock released: ${lockName}`);
            return true;
        } catch (error) {
            console.error(`❌ [MigrationSafety] Failed to release lock ${lockName}:`, error.message);
            return false;
        }
    }

    /**
     * Execute migration with full safety
     */
    async executeSafely(migrationName, migrationFn, options = {}) {
        const {
            tenantSchema = null,
            direction = 'up',
            checksum = null
        } = options;

        const lockName = tenantSchema 
            ? `migrate_${tenantSchema}_${migrationName}` 
            : `migrate_control_${migrationName}`;

        // 1. Acquire lock
        const lock = await this.acquireLock(lockName);
        if (!lock.acquired) {
            throw new Error(`Cannot execute migration - ${lock.message}`);
        }

        const auditId = await this._startAudit(migrationName, direction, tenantSchema, checksum);
        const startTime = Date.now();

        try {
            // 2. Check if already executed (idempotency)
            if (await this._isAlreadyExecuted(migrationName, tenantSchema, direction)) {
                console.log(`⏭️ [MigrationSafety] Skipping already executed: ${migrationName}`);
                await this._completeAudit(auditId, 'skipped', null, Date.now() - startTime);
                await this.releaseLock(lockName);
                return { executed: false, status: 'skipped', reason: 'already_executed' };
            }

            // 3. Execute migration in transaction
            console.log(`▶️ [MigrationSafety] Executing: ${migrationName}`);
            const result = await this.sequelize.transaction(async (transaction) => {
                return await migrationFn(transaction);
            });

            // 4. Record success
            const executionTime = Date.now() - startTime;
            await this._completeAudit(auditId, 'success', null, executionTime);
            
            console.log(`✅ [MigrationSafety] Completed: ${migrationName} (${executionTime}ms)`);
            
            await this.releaseLock(lockName);
            return { executed: true, status: 'success', result, executionTime };

        } catch (error) {
            const executionTime = Date.now() - startTime;
            await this._completeAudit(auditId, 'failed', error.message, executionTime);
            await this.releaseLock(lockName);

            console.error(`❌ [MigrationSafety] Failed: ${migrationName}`, error.message);
            throw error;
        }
    }

    /**
     * Verify rollback capability
     */
    async verifyRollback(migrationName, rollbackFn, options = {}) {
        const { tenantSchema = null, testData = null } = options;

        console.log(`🔄 [MigrationSafety] Testing rollback for: ${migrationName}`);

        // Create savepoint
        const savepointName = `rollback_test_${Date.now()}`;
        
        try {
            await this.sequelize.transaction(async (transaction) => {
                // Set savepoint
                await transaction.query(`SAVEPOINT ${savepointName}`);

                // Apply test changes
                if (testData) {
                    await transaction.query(testData.setup);
                }

                // Execute rollback
                await rollbackFn(transaction);

                // Verify rollback worked
                if (testData && testData.verify) {
                    const [result] = await transaction.query(testData.verify);
                    if (!result) {
                        throw new Error('Rollback verification failed');
                    }
                }

                // Rollback to savepoint
                await transaction.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
            });

            console.log(`✅ [MigrationSafety] Rollback verified: ${migrationName}`);
            return { verified: true };

        } catch (error) {
            console.error(`❌ [MigrationSafety] Rollback test failed: ${migrationName}`, error.message);
            return { verified: false, error: error.message };
        }
    }

    /**
     * Check if migration already executed (idempotency check)
     */
    async _isAlreadyExecuted(migrationName, tenantSchema, direction) {
        const [rows] = await this.sequelize.query(`
            SELECT id FROM migration_audit_log 
            WHERE migration_name = :migrationName 
            AND direction = :direction
            AND status = 'success'
            ${tenantSchema ? "AND tenant_schema = :tenantSchema" : "AND tenant_schema IS NULL"}
            LIMIT 1
        `, {
            replacements: { migrationName, direction, tenantSchema },
            type: Sequelize.QueryTypes.SELECT
        });

        return rows && rows.length > 0;
    }

    /**
     * Start audit log entry
     */
    async _startAudit(migrationName, direction, tenantSchema, checksum) {
        const [result] = await this.sequelize.query(`
            INSERT INTO migration_audit_log 
            (migration_name, direction, tenant_schema, status, checksum, instance_id)
            VALUES (:migrationName, :direction, :tenantSchema, 'running', :checksum, :instanceId)
            RETURNING id
        `, {
            replacements: {
                migrationName,
                direction,
                tenantSchema,
                checksum,
                instanceId: this.instanceId
            },
            type: Sequelize.QueryTypes.INSERT
        });

        return result[0].id;
    }

    /**
     * Complete audit log entry
     */
    async _completeAudit(auditId, status, errorMessage, executionTime) {
        await this.sequelize.query(`
            UPDATE migration_audit_log 
            SET status = :status, 
                completed_at = CURRENT_TIMESTAMP,
                error_message = :errorMessage,
                execution_time_ms = :executionTime
            WHERE id = :auditId
        `, {
            replacements: { auditId, status, errorMessage, executionTime }
        });
    }

    /**
     * Get migration status
     */
    async getStatus(tenantSchema = null) {
        const whereClause = tenantSchema 
            ? 'WHERE tenant_schema = :tenantSchema' 
            : 'WHERE tenant_schema IS NULL';

        const [stats] = await this.sequelize.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'success') as successful,
                COUNT(*) FILTER (WHERE status = 'failed') as failed,
                COUNT(*) FILTER (WHERE status = 'running') as running,
                MAX(completed_at) as last_migration
            FROM migration_audit_log
            ${whereClause}
        `, {
            replacements: { tenantSchema },
            type: Sequelize.QueryTypes.SELECT
        });

        const [recent] = await this.sequelize.query(`
            SELECT * FROM migration_audit_log
            ${whereClause}
            ORDER BY started_at DESC
            LIMIT 10
        `, {
            replacements: { tenantSchema },
            type: Sequelize.QueryTypes.SELECT
        });

        return {
            stats: stats[0],
            recent: recent
        };
    }

    /**
     * Emergency unlock (admin only)
     */
    async emergencyUnlock(lockName) {
        console.warn(`🚨 [MigrationSafety] EMERGENCY UNLOCK: ${lockName}`);
        
        await this.sequelize.query(`
            DELETE FROM ${this.lockTable} WHERE lock_name = :lockName
        `, {
            replacements: { lockName }
        });

        return true;
    }

    /**
     * Health check
     */
    async healthCheck() {
        try {
            // Check for stuck locks
            const [stuckLocks] = await this.sequelize.query(`
                SELECT * FROM ${this.lockTable} 
                WHERE expires_at < CURRENT_TIMESTAMP
            `);

            // Check for failed migrations
            const [failedMigrations] = await this.sequelize.query(`
                SELECT * FROM migration_audit_log 
                WHERE status = 'failed' 
                AND completed_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
            `);

            return {
                status: 'healthy',
                stuckLocks: stuckLocks.length,
                recentFailures: failedMigrations.length,
                instanceId: this.instanceId
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }
}

module.exports = MigrationSafety;
