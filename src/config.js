import { existsSync } from 'node:fs';

if (existsSync('.env')) {
    process.loadEnvFile('.env');
}

function required(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Set ${name} in your environment.`);
    }
    return value
}

export const SHOP = required('SHOPIFY_SHOP');
export const CLIENT_ID = required('SHOPIFY_CLIENT_ID');
export const CLIENT_SECRET = required('SHOPIFY_CLIENT_SECRET');