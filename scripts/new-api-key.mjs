#!/usr/bin/env node
/**
 * Create an INTEGRATION_API_KEYS entry for another system.
 *   npm run new-api-key -- atlas
 * Prints `name:key`. Put it in INTEGRATION_API_KEYS (comma-separate several)
 * and give the key part — after the colon — to the other system.
 */
import { randomBytes } from "node:crypto";

const name = (process.argv[2] || "integration").replace(/[^a-z0-9-]/gi, "").toLowerCase() || "integration";
const key = `pce_${randomBytes(32).toString("base64url")}`;
console.log(`\nAdd to INTEGRATION_API_KEYS:\n\n${name}:${key}\n\nThe other system sends:  Authorization: Bearer ${key}\n`);
