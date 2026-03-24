#!/usr/bin/env node

/**
 * 👑 SUPER ADMIN CREATION SCRIPT
 * 
 * Creates a Super Admin user in the control plane.
 * Usage: node scripts/create_super_admin.js <email> <password> <name>
 */

require('dotenv').config({ override: true });
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { controlPlaneSequelize, SuperAdminUser } = require('../control_plane_models');

async function createAdmin() {
    const [,, email, password, name] = process.argv;

    if (!email || !password || !name) {
        console.error('❌ Usage: node scripts/create_super_admin.js <email> <password> <name>');
        process.exit(1);
    }

    try {
        console.log(`🚀 Creating Super Admin: ${email}...`);
        
        await controlPlaneSequelize.authenticate();
        console.log('✅ DB Connected');

        const hashedPassword = await bcrypt.hash(password, 10);

        await controlPlaneSequelize.transaction(async (transaction) => {
            const [admin, created] = await SuperAdminUser.findOrCreate({
                where: { email: email.toLowerCase() },
                defaults: {
                    id: uuidv4(),
                    email: email.toLowerCase(),
                    passwordHash: hashedPassword,
                    role: 'SUPER_ADMIN',
                    tokenVersion: 0
                },
                transaction
            });

            if (created) {
                console.log(`✅ Super Admin created successfully: ${email}`);
            } else {
                console.log(`⚠️  Super Admin already exists: ${email}. Updating password...`);
                await admin.update({ passwordHash: hashedPassword }, { transaction });
                console.log('✅ Password updated.');
            }
        });

        process.exit(0);

    } catch (error) {
        console.error('❌ Failed to create Super Admin:', error.message);
        process.exit(1);
    }
}

createAdmin();
