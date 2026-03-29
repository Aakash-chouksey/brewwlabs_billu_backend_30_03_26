const tenantStatusMiddleware = require('../middlewares/tenantStatusMiddleware');
const { TENANT_STATUS } = require('../src/utils/tenantConstants');

// Mock dependencies
jest.mock('../config/unified_database', () => ({
    sequelize: {
        models: {
            TenantRegistry: {
                schema: () => ({
                    findOne: jest.fn()
                })
            }
        }
    }
}));

const { sequelize } = require('../config/unified_database');

describe('TenantStatusMiddleware Verification', () => {
    let req, res, next;

    beforeEach(() => {
        req = {
            businessId: 'test-business-id',
            path: '/api/tenant/dashboard',
            user: { role: 'BusinessAdmin' }
        };
        res = {};
        next = jest.fn();
        jest.clearAllMocks();
    });

    test('Should allow ACTIVE tenants', async () => {
        sequelize.models.TenantRegistry.schema().findOne.mockResolvedValue({ status: 'ACTIVE' });
        
        await tenantStatusMiddleware(req, res, next);
        
        expect(next).toHaveBeenCalledWith();
        expect(next).not.toHaveBeenCalledWith(expect.any(Error));
    });

    test('Should block INACTIVE tenants with 403', async () => {
        sequelize.models.TenantRegistry.schema().findOne.mockResolvedValue({ status: 'INACTIVE' });
        
        await tenantStatusMiddleware(req, res, next);
        
        expect(next).toHaveBeenCalledWith(expect.objectContaining({
            status: 403,
            message: 'Tenant account is INACTIVE. Access denied.'
        }));
    });

    test('Should block CREATING tenants with 503', async () => {
        sequelize.models.TenantRegistry.schema().findOne.mockResolvedValue({ status: 'CREATING' });
        
        await tenantStatusMiddleware(req, res, next);
        
        expect(next).toHaveBeenCalledWith(expect.objectContaining({
            status: 503,
            message: 'Tenant is being initialized. Please try again shortly.'
        }));
    });

    test('Should allow public paths regardless of status', async () => {
        req.path = '/api/tenant/status';
        sequelize.models.TenantRegistry.schema().findOne.mockResolvedValue({ status: 'CREATING' });
        
        await tenantStatusMiddleware(req, res, next);
        
        expect(next).toHaveBeenCalledWith();
    });

    test('Should allow Super Admin to bypass', async () => {
        req.user.role = 'SUPER_ADMIN';
        sequelize.models.TenantRegistry.schema().findOne.mockResolvedValue({ status: 'SUSPENDED' });
        
        await tenantStatusMiddleware(req, res, next);
        
        expect(next).toHaveBeenCalledWith();
    });
});
