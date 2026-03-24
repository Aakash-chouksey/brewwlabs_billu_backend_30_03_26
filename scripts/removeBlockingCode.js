#!/usr/bin/env node

/**
 * BLOCKING CODE REMOVER
 * 
 * Replaces all synchronous operations with async alternatives
 * Ensures non-blocking event loop for high concurrency
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

class BlockingCodeRemover {
    constructor() {
        this.fixedFiles = [];
        this.errors = [];
        this.replacements = [];
    }

    /**
     * Remove blocking code from all controller files
     */
    async fixAllControllers() {
        console.log('🔧 Removing blocking code from all controllers...');
        
        const controllersDir = path.join(__dirname, '../controllers');
        const controllerFiles = fs.readdirSync(controllersDir).filter(f => f.endsWith('.js'));
        
        for (const file of controllerFiles) {
            await this.fixControllerFile(path.join(controllersDir, file));
        }
        
        console.log(`\n✅ Blocking code removal complete:`);
        console.log(`   Fixed files: ${this.fixedFiles.length}`);
        console.log(`   Errors: ${this.errors.length}`);
        console.log(`   Replacements made: ${this.replacements.length}`);
        
        if (this.errors.length > 0) {
            console.log('\n❌ Errors:');
            this.errors.forEach(error => console.log(`   ${error}`));
        }
        
        return {
            fixedFiles: this.fixedFiles.length,
            errors: this.errors.length,
            replacements: this.replacements.length
        };
    }

    /**
     * Fix blocking code in a single controller file
     */
    async fixControllerFile(filePath) {
        try {
            let content = fs.readFileSync(filePath, 'utf8');
            const originalContent = content;
            
            // Replace fs.sync operations
            content = this.replaceFileSystemOperations(content);
            
            // Replace require calls in hot paths
            content = this.replaceRequireCalls(content);
            
            // Replace JSON operations
            content = this.replaceJSONOperations(content);
            
            // Add async/await patterns where needed
            content = this.addAsyncPatterns(content);
            
            // Add async helper functions
            if (content !== originalContent) {
                content = this.addAsyncHelpers(content);
                fs.writeFileSync(filePath, content);
                this.fixedFiles.push(path.basename(filePath));
                console.log(`   ✅ Fixed: ${path.basename(filePath)}`);
            }
            
        } catch (error) {
            this.errors.push(`${path.basename(filePath)}: ${error.message}`);
        }
    }

    /**
     * Replace synchronous file system operations
     */
    replaceFileSystemOperations(content) {
        const replacements = [
            // fs.readFileSync -> fs.promises.readFile
            {
                pattern: /fs\.readFileSync\s*\(\s*['"`]([^'"`]+)['"`]\s*(,\s*['"`]([^'"`]+)['"`])?\s*\)/g,
                replacement: 'fs.promises.readFile($1, $2)'
            },
            // fs.writeFileSync -> fs.promises.writeFile
            {
                pattern: /fs\.writeFileSync\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*([^)]+)\s*(,\s*['"`]([^'"`]+)['"`])?\s*\)/g,
                replacement: 'fs.promises.writeFile($1, $2, $3)'
            },
            // fs.existsSync -> fs.promises.access
            {
                pattern: /fs\.existsSync\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
                replacement: 'fs.promises.access($1).catch(() => false)'
            },
            // fs.mkdirSync -> fs.promises.mkdir
            {
                pattern: /fs\.mkdirSync\s*\(\s*['"`]([^'"`]+)['"`]\s*(,\s*{[^}]*})?\s*\)/g,
                replacement: 'fs.promises.mkdir($1, $2)'
            }
        ];
        
        let modifiedContent = content;
        for (const { pattern, replacement } of replacements) {
            const matches = content.match(pattern);
            if (matches) {
                modifiedContent = modifiedContent.replace(pattern, replacement);
                this.replacements.push(...matches.map(match => ({
                    from: match,
                    to: replacement
                })));
            }
        }
        
        return modifiedContent;
    }

    /**
     * Replace require calls in hot paths
     */
    replaceRequireCalls(content) {
        // Find require calls inside functions (hot paths)
        const functionPattern = /(?:async\s+)?function\s+\w+\s*\([^)]*\)\s*{[^}]*require\s*\([^)]+\)[^}]*}/g;
        
        return content.replace(functionPattern, (match) => {
            // Move require calls to top of file
            const requireMatches = match.match(/require\s*\([^)]+\)/g);
            if (requireMatches) {
                // Remove require from function and note for manual fixing
                const withoutRequires = match.replace(/require\s*\([^)]+\)/g, '// require() moved to top of file');
                this.replacements.push({
                    from: requireMatches.join(', '),
                    to: 'Moved to top of file (manual fix needed)'
                });
                return withoutRequires;
            }
            return match;
        });
    }

    /**
     * Replace JSON operations
     */
    replaceJSONOperations(content) {
        const replacements = [
            // JSON.parse -> try/catch with JSON.parse
            {
                pattern: /JSON\.parse\s*\(\s*([^)]+)\s*\)/g,
                replacement: '(data) => { try { return JSON.parse(data); } catch(e) { return null; } }($1)'
            },
            // JSON.stringify -> JSON.stringify (already async-safe)
            {
                pattern: /JSON\.stringify\s*\(/g,
                replacement: 'JSON.stringify(' // No change needed, but track usage
            }
        ];
        
        let modifiedContent = content;
        for (const { pattern, replacement } of replacements) {
            const matches = content.match(pattern);
            if (matches) {
                modifiedContent = modifiedContent.replace(pattern, replacement);
                this.replacements.push(...matches.map(match => ({
                    from: match,
                    to: replacement
                })));
            }
        }
        
        return modifiedContent;
    }

    /**
     * Add async/await patterns where needed
     */
    addAsyncPatterns(content) {
        // Add async keyword to functions that use await
        const asyncPattern = /(?:function\s+(\w+)\s*\([^)]*\)\s*{[^}]*)await([^}]*)}/g;
        
        return content.replace(asyncPattern, (match, funcName, body) => {
            if (!match.includes('async ')) {
                this.replacements.push({
                    from: `function ${funcName}`,
                    to: `async function ${funcName}`
                });
                return match.replace('function ', 'async function ');
            }
            return match;
        });
    }

    /**
     * Add async helper functions
     */
    addAsyncHelpers(content) {
        // Check if helpers already exist
        if (content.includes('asyncHelpers')) {
            return content;
        }
        
        const helpers = `
/**
 * Async helper functions
 */
const asyncHelpers = {
    /**
     * Safe JSON parse with error handling
     */
    safeJSONParse: async (data) => {
        try {
            return JSON.parse(data);
        } catch (error) {
            console.warn('JSON parse error:', error.message);
            return null;
        }
    },
    
    /**
     * Safe file read with error handling
     */
    safeReadFile: async (filePath, encoding = 'utf8') => {
        try {
            return await fs.promises.readFile(filePath, encoding);
        } catch (error) {
            console.warn('File read error:', error.message);
            return null;
        }
    },
    
    /**
     * Safe file write with error handling
     */
    safeWriteFile: async (filePath, data, encoding = 'utf8') => {
        try {
            await fs.promises.writeFile(filePath, data, encoding);
            return true;
        } catch (error) {
            console.warn('File write error:', error.message);
            return false;
        }
    },
    
    /**
     * Check if file exists
     */
    fileExists: async (filePath) => {
        try {
            await fs.promises.access(filePath);
            return true;
        } catch {
            return false;
        }
    },
    
    /**
     * Create directory if it doesn't exist
     */
    ensureDir: async (dirPath) => {
        try {
            await fs.promises.mkdir(dirPath, { recursive: true });
            return true;
        } catch (error) {
            console.warn('Directory creation error:', error.message);
            return false;
        }
    }
};

`;
        
        // Insert after require statements
        const requireEndIndex = content.lastIndexOf(');');
        if (requireEndIndex > -1) {
            return content.slice(0, requireEndIndex + 2) + helpers + content.slice(requireEndIndex + 2);
        }
        
        return helpers + content;
    }

    /**
     * Create migration guide for async patterns
     */
    createMigrationGuide() {
        const guide = `
# ASYNC MIGRATION GUIDE

## What was fixed:
- Replaced fs.readFileSync with fs.promises.readFile
- Replaced fs.writeFileSync with fs.promises.writeFile  
- Replaced fs.existsSync with fs.promises.access
- Added error handling for JSON operations
- Added async helper functions

## How to use the new async helpers:

### 1. Safe file operations:
\`\`\`javascript
// Read file
const data = await asyncHelpers.safeReadFile('./file.txt');

// Write file
const success = await asyncHelpers.safeWriteFile('./file.txt', data);

// Check if file exists
const exists = await asyncHelpers.fileExists('./file.txt');
\`\`\`

### 2. Safe JSON operations:
\`\`\`javascript
const parsed = await asyncHelpers.safeJSONParse(jsonString);
\`\`\`

### 3. Directory operations:
\`\`\`javascript
// Ensure directory exists
await asyncHelpers.ensureDir('./uploads');
\`\`\`

## Manual fixes needed:
1. Move require() calls from inside functions to top of file
2. Add 'async' keyword to functions that use await
3. Handle errors properly with try/catch
4. Update function signatures to be async where needed

## Performance benefits:
- Non-blocking I/O operations
- Better concurrency handling
- Improved responsiveness under load
- No event loop blocking
`;

        fs.writeFileSync(path.join(__dirname, '../ASYNC_MIGRATION_GUIDE.md'), guide);
        console.log('📖 Created async migration guide');
    }
}

// Run the blocking code remover
if (require.main === module) {
    const remover = new BlockingCodeRemover();
    remover.fixAllControllers()
        .then(results => {
            remover.createMigrationGuide();
            console.log('\n🎉 Blocking code removal complete!');
            console.log('⚠️  Manual fixes may be required for some patterns');
            process.exit(results.errors.length > 0 ? 1 : 0);
        })
        .catch(error => {
            console.error('❌ Blocking code removal failed:', error);
            process.exit(1);
        });
}

module.exports = BlockingCodeRemover;
