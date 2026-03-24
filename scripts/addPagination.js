#!/usr/bin/env node

/**
 * AUTOMATIC PAGINATION FIXER
 * 
 * Adds pagination to all findAll queries to prevent memory explosion
 */

const fs = require('fs');
const path = require('path');

class PaginationFixer {
    constructor() {
        this.fixedFiles = [];
        this.errors = [];
    }

    /**
     * Add pagination to all controller files
     */
    async fixAllControllers() {
        console.log('🔧 Adding pagination to all controllers...');
        
        const controllersDir = path.join(__dirname, '../controllers');
        const controllerFiles = fs.readdirSync(controllersDir).filter(f => f.endsWith('.js'));
        
        for (const file of controllerFiles) {
            await this.fixControllerFile(path.join(controllersDir, file));
        }
        
        console.log(`\n✅ Pagination fix complete:`);
        console.log(`   Fixed files: ${this.fixedFiles.length}`);
        console.log(`   Errors: ${this.errors.length}`);
        
        if (this.errors.length > 0) {
            console.log('\n❌ Errors:');
            this.errors.forEach(error => console.log(`   ${error}`));
        }
        
        return {
            fixedFiles: this.fixedFiles.length,
            errors: this.errors.length
        };
    }

    /**
     * Fix pagination in a single controller file
     */
    async fixControllerFile(filePath) {
        try {
            let content = fs.readFileSync(filePath, 'utf8');
            const originalContent = content;
            
            // Fix findAll calls without pagination
            content = this.fixFindAllQueries(content);
            
            // Fix other query patterns
            content = this.fixOtherQueryPatterns(content);
            
            // Add pagination helper function if needed
            if (content !== originalContent) {
                content = this.addPaginationHelper(content);
                fs.writeFileSync(filePath, content);
                this.fixedFiles.push(path.basename(filePath));
                console.log(`   ✅ Fixed: ${path.basename(filePath)}`);
            }
            
        } catch (error) {
            this.errors.push(`${path.basename(filePath)}: ${error.message}`);
        }
    }

    /**
     * Fix findAll queries to include pagination
     */
    fixFindAllQueries(content) {
        // Pattern to find findAll calls
        const findAllPattern = /(\w+)\.findAll\s*\(\s*({[^}]*})?\s*\)/g;
        
        return content.replace(findAllPattern, (match, modelObj, options) => {
            // Skip if already has limit/offset
            if (options && (options.includes('limit') || options.includes('offset'))) {
                return match;
            }
            
            // Parse existing options
            let existingOptions = {};
            if (options) {
                try {
                    // Simple parsing for common cases
                    existingOptions = this.parseOptions(options);
                } catch (e) {
                    // If parsing fails, use as-is
                    existingOptions = {};
                }
            }
            
            // Add pagination with reasonable defaults
            const paginationOptions = {
                ...existingOptions,
                limit: existingOptions.limit || 50,
                offset: existingOptions.offset || 0
            };
            
            return `${modelObj}.findAll(${JSON.stringify(paginationOptions)})`;
        });
    }

    /**
     * Fix other query patterns that might return large datasets
     */
    fixOtherQueryPatterns(content) {
        // Fix raw queries without LIMIT
        const rawQueryPattern = /sequelize\.query\s*\(\s*['"`]([^'"`]*SELECT[^'"`]*)['"`]\s*,\s*({[^}]*})?\s*\)/g;
        
        return content.replace(rawQueryPattern, (match, query, options) => {
            // Skip if already has LIMIT
            if (query.toUpperCase().includes('LIMIT')) {
                return match;
            }
            
            // Parse existing options
            let existingOptions = {};
            if (options) {
                try {
                    existingOptions = JSON.parse(options);
                } catch (e) {
                    existingOptions = {};
                }
            }
            
            // Add LIMIT to query
            const limitedQuery = query + ' LIMIT 100';
            
            return `sequelize.query('${limitedQuery}', ${JSON.stringify(existingOptions)})`;
        });
    }

    /**
     * Parse options object from string (simple implementation)
     */
    parseOptions(optionsStr) {
        const options = {};
        
        // Extract limit
        const limitMatch = optionsStr.match(/limit\s*:\s*(\d+)/);
        if (limitMatch) {
            options.limit = parseInt(limitMatch[1]);
        }
        
        // Extract offset
        const offsetMatch = optionsStr.match(/offset\s*:\s*(\d+)/);
        if (offsetMatch) {
            options.offset = parseInt(offsetMatch[1]);
        }
        
        return options;
    }

    /**
     * Add pagination helper function to controllers
     */
    addPaginationHelper(content) {
        // Check if helper already exists
        if (content.includes('getPaginationOptions')) {
            return content;
        }
        
        // Add helper function at the top of the file
        const helperFunction = `
/**
 * Get pagination options from request query
 */
const getPaginationOptions = (req) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    
    return {
        limit: Math.min(limit, 100), // Max 100 records per request
        offset: Math.max(0, offset),
        order: req.query.sort ? [[req.query.sort, req.query.order || 'ASC']] : [['createdAt', 'DESC']]
    };
};

/**
 * Format paginated response
 */
const formatPaginatedResponse = (data, total, page, limit) => {
    const totalPages = Math.ceil(total / limit);
    
    return {
        data,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
        }
    };
};

`;
        
        // Insert after require statements
        const requireEndIndex = content.lastIndexOf(');');
        if (requireEndIndex > -1) {
            return content.slice(0, requireEndIndex + 2) + helperFunction + content.slice(requireEndIndex + 2);
        }
        
        return helperFunction + content;
    }

    /**
     * Create pagination migration guide
     */
    createMigrationGuide() {
        const guide = `
# PAGINATION MIGRATION GUIDE

## What was fixed:
- Added pagination to all findAll() queries
- Added LIMIT to raw SQL queries
- Added pagination helper functions

## How to use:

### 1. Basic pagination in controllers:
\`\`\`javascript
const paginationOptions = getPaginationOptions(req);
const result = await Model.findAll(paginationOptions);
\`\`\`

### 2. With filters:
\`\`\`javascript
const paginationOptions = {
    ...getPaginationOptions(req),
    where: { status: 'active' }
};
const result = await Model.findAll(paginationOptions);
\`\`\`

### 3. Format response:
\`\`\`javascript
const total = await Model.count();
const response = formatPaginatedResponse(result, total, page, limit);
res.json(response);
\`\`\`

### 4. Client-side usage:
\`\`\`javascript
// GET /api/products?page=2&limit=20&sort=name&order=ASC
\`\`\`

## Query parameters:
- page: Page number (default: 1)
- limit: Records per page (default: 50, max: 100)
- sort: Sort field
- order: Sort direction (ASC/DESC)
`;

        fs.writeFileSync(path.join(__dirname, '../PAGINATION_MIGRATION_GUIDE.md'), guide);
        console.log('📖 Created pagination migration guide');
    }
}

// Run the pagination fixer
if (require.main === module) {
    const fixer = new PaginationFixer();
    fixer.fixAllControllers()
        .then(results => {
            fixer.createMigrationGuide();
            console.log('\n🎉 Pagination fix complete!');
            process.exit(results.errors.length > 0 ? 1 : 0);
        })
        .catch(error => {
            console.error('❌ Pagination fix failed:', error);
            process.exit(1);
        });
}

module.exports = PaginationFixer;
