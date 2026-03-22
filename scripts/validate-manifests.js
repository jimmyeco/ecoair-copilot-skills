#!/usr/bin/env node
"use strict";

/**
 * validate-manifests.js
 * CLI script to validate all Copilot skill manifests in the manifests/ directory.
 * Usage: node scripts/validate-manifests.js [--verbose]
 */

const path = require("path");
const { discoverManifests, loadManifest, validateManifest } = require("../lib/manifest-validator");

const verbose = process.argv.includes("--verbose");
const manifestsDir = path.join(__dirname, "..", "manifests");

console.log("=== EcoAir Copilot Skill Manifest Validator ===\n");

const files = discoverManifests(manifestsDir);

if (files.length === 0) {
    console.error("No manifest files found in:", manifestsDir);
    process.exit(1);
}

console.log(`Found ${files.length} manifest(s) in ${manifestsDir}\n`);

let totalErrors = 0;
let totalWarnings = 0;

for (const filePath of files) {
    const filename = path.basename(filePath);
    const { data, error } = loadManifest(filePath);

  if (error) {
        console.error(`FAIL  ${filename}: ${error}`);
        totalErrors++;
        continue;
  }

  const result = validateManifest(data);
    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;

  if (result.valid) {
        console.log(`PASS  ${filename} (${data.actions ? data.actions.length : 0} actions)`);
  } else {
        console.error(`FAIL  ${filename}`);
  }

  if (verbose || !result.valid) {
        for (const err of result.errors) {
                console.error(`  ERROR: ${err}`);
        }
  }
    if (verbose && result.warnings.length > 0) {
          for (const warn of result.warnings) {
                  console.warn(`  WARN:  ${warn}`);
          }
    }
}

console.log(`\n--- Summary ---`);
console.log(`Manifests: ${files.length}`);
console.log(`Errors:    ${totalErrors}`);
console.log(`Warnings:  ${totalWarnings}`);

if (totalErrors > 0) {
    console.error("\nValidation FAILED");
    process.exit(1);
} else {
    console.log("\nAll manifests valid!");
    process.exit(0);
}
