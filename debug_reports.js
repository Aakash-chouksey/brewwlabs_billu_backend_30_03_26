/**
 * Test script to debug reports endpoint without authentication
 */

const express = require('express');
const { Sequelize, Op } = require('sequelize');

async function testReportsLogic() {
    console.log('🔍 Testing Reports Logic...\n');
    
    try {
        // Mock request object similar to what the middleware creates
        const mockReq = {
            models: {
                Order: {
                    findAll: async (options) => {
                        console.log('📊 Order.findAll called with:', JSON.stringify(options, null, 2));
                        return []; // Return empty array for testing
                    },
                    sum: async (field, options) => {
                        console.log('💰 Order.sum called with:', field, JSON.stringify(options, null, 2));
                        return 0; // Return 0 for testing
                    },
                    count: async (options) => {
                        console.log('🔢 Order.count called with:', JSON.stringify(options, null, 2));
                        return 0; // Return 0 for testing
                    }
                },
                OrderItem: {
                    findAll: async (options) => {
                        console.log('📦 OrderItem.findAll called with:', JSON.stringify(options, null, 2));
                        return []; // Return empty array for testing
                    }
                },
                sequelize: {
                    query: async (query, options) => {
                        console.log('🔍 sequelize.query called with:', query);
                        return []; // Return empty array for testing
                    },
                    QueryTypes: {
                        SELECT: 'SELECT'
                    }
                }
            },
            businessId: '9a678339-9741-4d58-987c-eebed5192794',
            outletId: 'a5018257-02fa-49a9-b74e-a4c6cd25692f',
            query: {
                reportType: 'overview',
                period: 'today'
            }
        };
        
        // Mock response object
        const mockRes = {
            status: (code) => ({
                json: (data) => {
                    console.log('✅ Response:', JSON.stringify(data, null, 2));
                    return { status: code, data };
                }
            })
        };
        
        // Mock next function
        const mockNext = (error) => {
            console.log('❌ Error passed to next():', error.message);
            console.log('Stack:', error.stack);
        };
        
        // Import and test the controller function
        const { getReportsOverview } = require('./controllers/reportController');
        
        console.log('1️⃣ Testing getReportsOverview...');
        await getReportsOverview(mockReq, mockRes, mockNext);
        
        console.log('\n🎉 Reports logic test completed!');
        
    } catch (error) {
        console.error('💥 Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

testReportsLogic();
