const fs = require('fs').promises;
const path = require('path');

class DeploymentConfig {
    constructor() {
        this.configPath = path.join(__dirname, '../config/deployment.json');
        this.config = null;
        this.defaultConfig = {
            backend: {
                protocol: 'http',
                host: 'localhost',
                port: 3003,
                httpsPort: 3002,
                publicUrl: '',
                useHttps: false
            },
            frontend: {
                protocol: 'https',
                host: 'localhost',
                port: 5173,
                publicUrl: ''
            },
            cors: {
                allowedOrigins: [
                    'https://localhost:5173',
                    'http://localhost:5173',
                    'https://discover-gozo.com',
                    'https://www.discover-gozo.com'
                ]
            },
            environment: 'development' // development, staging, production
        };
    }

    async ensureConfigDirectory() {
        const configDir = path.dirname(this.configPath);
        try {
            await fs.access(configDir);
        } catch {
            await fs.mkdir(configDir, { recursive: true });
        }
    }

    async loadConfig() {
        try {
            await this.ensureConfigDirectory();
            const data = await fs.readFile(this.configPath, 'utf8');
            this.config = JSON.parse(data);
            console.log('✅ Deployment configuration loaded from file');
            return this.config;
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('⚙️ No deployment config found, creating default configuration');
                await this.saveConfig(this.defaultConfig);
                this.config = this.defaultConfig;
                return this.config;
            }
            console.error('❌ Error loading deployment config:', error);
            this.config = this.defaultConfig;
            return this.config;
        }
    }

    async saveConfig(config) {
        try {
            await this.ensureConfigDirectory();
            await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf8');
            this.config = config;
            console.log('✅ Deployment configuration saved');
            return true;
        } catch (error) {
            console.error('❌ Error saving deployment config:', error);
            throw error;
        }
    }

    getConfig() {
        return this.config || this.defaultConfig;
    }

    getBackendUrl() {
        const cfg = this.getConfig();
        const backend = cfg.backend;
        
        // Use public URL if in production and it's set
        if (cfg.environment === 'production' && backend.publicUrl) {
            return backend.publicUrl;
        }
        
        // Otherwise construct from host and port
        const protocol = backend.useHttps ? 'https' : backend.protocol;
        const port = backend.useHttps ? backend.httpsPort : backend.port;
        return `${protocol}://${backend.host}:${port}`;
    }

    getFrontendUrl() {
        const cfg = this.getConfig();
        const frontend = cfg.frontend;
        
        // Use public URL if in production and it's set
        if (cfg.environment === 'production' && frontend.publicUrl) {
            return frontend.publicUrl;
        }
        
        // Otherwise construct from host and port
        return `${frontend.protocol}://${frontend.host}:${frontend.port}`;
    }

    getCorsOrigins() {
        const cfg = this.getConfig();
        return cfg.cors.allowedOrigins || [];
    }

    async updateConfig(updates) {
        const currentConfig = this.getConfig();
        const newConfig = {
            ...currentConfig,
            ...updates,
            backend: {
                ...currentConfig.backend,
                ...(updates.backend || {})
            },
            frontend: {
                ...currentConfig.frontend,
                ...(updates.frontend || {})
            },
            cors: {
                ...currentConfig.cors,
                ...(updates.cors || {})
            }
        };
        
        await this.saveConfig(newConfig);
        return newConfig;
    }

    isProduction() {
        return this.getConfig().environment === 'production';
    }

    isDevelopment() {
        return this.getConfig().environment === 'development';
    }

    getEnvironment() {
        return this.getConfig().environment || 'development';
    }
}

// Singleton instance
const deploymentConfig = new DeploymentConfig();

module.exports = deploymentConfig;


