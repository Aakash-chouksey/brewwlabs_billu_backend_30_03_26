# Complete System Analysis: Multi-Tenant Backend (Sequelize + Neon)

## 🧠 Part 1: Identify System Layers

| Layer | Responsibility | Key Files | Interaction |
| :--- | :--- | :--- | :--- |
| **API Layer** | Routes & Request Handling | `routes/`, `controllers/` | Entry point; calls Service Layer. |
| **Service Layer** | Business Logic Orchestration | `services/onboarding.service.js` | Orchestrates logic; calls Executor Layer for DB ops. |
| **Executor Layer** | Transaction & Isolation Manager | `services/neonTransactionSafeExecutor.js` | Critical: Manages transactions, `search_path`, and model-schema binding. |
| **Model Loader** | Dynamic Model Initialization | `src/architecture/modelLoader.js` | Segregates Control Plane vs Tenant models; handles sync order. |
| **Model Factory** | Model Registration | `src/architecture/modelFactory.js` | Registry of all model definitions; initializes Sequelize models. |
| **Middleware** | Context & Isolation Guards | `middlewares/unifiedModelInjection.js` | Injects models/tenant context into `req`. |
| **Database Layer** | Physical Storage | PostgreSQL (Public + Tenant Schemas) | Schema-per-tenant isolation on Neon. |

---

## 🧠 Part 2: Trace Onboarding Flow (`POST /api/onboarding/business`)

Execution flow for business onboarding:

1.  **Entry**: `routes/onboardingRoute.js` receives request.
2.  **Validation**: `onboardingRoute.js` (validateOnboarding) checks fields.
3.  **Controller**: `controllers/onboardingController.js` (`onboardBusiness`) extracts data and calls Service.
4.  **Service Entry**: `services/onboarding.service.js` (`onboardBusiness`) starts.
5.  **Transaction Start**: Calls `neonTransactionSafeExecutor.executeInPublic`.
    -   `Sequelize.transaction()` is created.
    -   `search_path` is set to `public`.
6.  **Control Plane Init**: `modelLoader.initControlPlaneModels(sequelize)` loads `Business`, `User`, `TenantRegistry` etc. into `public`.
7.  **Business Insert**: `Business.create()` inserts into `public.businesses`.
8.  **Schema Creation**: `CREATE SCHEMA IF NOT EXISTS "tenant_uuid"` is executed via raw query.
9.  **Tenant Sync (The Heavy Lift)**: `modelLoader.syncTenantModels(sequelize, schemaName, transaction)`:
    -   Sets `setInitializationPhase(true)` to bypass strict transaction interceptor for DDL.
    -   Sets `SET LOCAL search_path TO "tenant_uuid"`.
    -   Loops through `TENANT_MODEL_SYNC_ORDER` (Categories -> Outlets -> ... -> Orders).
    -   Calls `model.schema(schemaName).sync({ transaction })` for each of the ~40 models.
10. **Tenant Data Insert**: `Outlet.create()` inserts into `tenant_uuid.outlets`.
11. **Admin User Insert**: `User.schema('public').create()` inserts admin into `public.users`.
12. **Registry Insert**: `TenantRegistry.schema('public').create()` links business to schema in `public.tenant_registries`.
13. **Commit**: Transaction commits; `onboardingController` returns tokens.

---

## 🧠 Part 3: Transaction Flow Analysis

-   **Start**: Always in the Service layer via `neonTransactionSafeExecutor`.
-   **Passing**:
    -   **Explicit**: Passed as `{ transaction }` options to every Sequelize call.
    -   **Implicit**: `cls-hooked` namespace `neon-safe-namespace` is used to track transactions automatically.
-   **Enforcement**: `config/unified_database.js` overrides `Sequelize.prototype.query` to **throw errors** if a non-safe query runs without a transaction (unless `isInitializationPhase` is true).

> [!CAUTION]
> **Transaction Loss Risk**: If a library or raw query bypasses Sequelize or the CLS context is lost (e.g., due to un-awaited promises), the interceptor will crash the request.

---

## 🧠 Part 4: Schema Flow Analysis

-   **Control Plane**: Uses `public` schema. models like `User`, `Business` are explicitly bound with `.schema('public')`.
-   **Tenant Schema**: Switched via `SET LOCAL search_path` within the transaction context in `neonTransactionSafeExecutor`.
-   **Inter-Schema Safety**: Tenant queries are forced to a SINGLE schema path (no public fallback) to prevent accidental reading from `public` if a table is missing in the tenant.

❌ **Highlight**: Syncing 40+ models sequentially while holding a transaction open is high-risk on Neon due to connection pinning and potential timeouts.

---

## 🧠 Part 5: Model System Analysis

-   **Model Re-use**: Models are defined once per Sequelize instance but "cloned" for schemas using `.schema(name)`.
-   **Caching**: `neonTransactionSafeExecutor` uses `tenantModelCache` (Map) to store schema-bound models.
-   **Contamination**: Prevented by `modelLoader.validateNoControlPlaneModels`, which throws if `Business` or `User` are initialized as tenant models.

---

## 🧠 Part 6: Sync Flow Analysis

-   **Order**: Strictly defined in `TENANT_MODEL_SYNC_ORDER` in `modelLoader.js`.
-   **Concurrency**: Currently **Sequential** (loop).
-   **Transaction**: Fully wrapped in the onboarding transaction.

---

## 🧠 Part 7: Error Root Cause Identification

1.  **Slowness (10–15s)**: Caused by sequential `model.sync()` of 40+ models inside a transaction. Each `sync()` call involves multiple metadata queries to PostgreSQL.
2.  **Transaction Aborts**: If any `sync()` fails (e.g., FK constraint issue), the entire onboarding fails.
3.  **Relation Not Found**: Occurs if `search_path` drifts or if a model is used before it is synced.

---

## 🧠 Part 8: Performance Analysis

APIs are slow primarily due to:
-   **Sequential Sync**: 40+ models * [Check Table + Check Indices + Create Table] = ~400-800ms per model.
-   **Transaction Overhead**: Holding a transaction open for 15s pins a connection.

---

## 🧠 Part 9: Final Summary

1.  **Total Layers**: 7
2.  **Clean Architecture Diagram**:
    ```text
    [Client] -> [API (Routes/Controllers)] 
                    |
               [Service (Onboarding)]
                    |
          [Executor (Transaction/Schema Manager)]
           /        |        \
    [Models]  [Model Loader]  [PostgreSQL (Neon)]
    (Cache)   (Sync Order)     (Public/Tenant)
    ```
3.  **Step-by-Step Onboarding**:
    -   `Route` -> `Controller` -> `Service`
    -   `Executor.executeInPublic(TX)`
    -   `CP_Models.init()`
    -   `Business.create()`
    -   `CREATE SCHEMA`
    -   `Tenant_Models.sync(Deterministic Order)` -> **Bottleneck**
    -   `Outlet.create()`
    -   `User/Registry.create(public)`
    -   `Commit`

### Top 3 Root Causes:
1.  **Sequential Syncing Overhead**: Syncing 40+ models one-by-one inside a transaction is the primary latency source.
2.  **Strict Transaction Interceptor**: While safe, it causes crashes if any query (even internal ones) doesn't perfectly align with the transaction context.
3.  **Implicit Schema Dependencies**: Relying on `search_path` within a transaction.
