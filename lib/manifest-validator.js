"use strict";

const fs = require("fs");
const path = require("path");

// Required top-level fields per Microsoft Copilot skill manifest schema
const REQUIRED_TOP_LEVEL_FIELDS = [
    "$schema",
    "name",
    "description",
    "version",
    "publisher",
    "schemaVersion",
    "actions",
  ];

// Required fields for each action
const REQUIRED_ACTION_FIELDS = ["id", "name", "description", "inputs", "outputs"];

// Valid auth types
const VALID_AUTH_TYPES = ["oauth2", "api_key", "none"];

// Valid JSON Schema types for action inputs/outputs
const VALID_SCHEMA_TYPES = ["string", "number", "integer", "boolean", "array", "object"];

/**
 * Loads and parses a JSON manifest file.
 * @param {string} filePath - Absolute or relative path to the manifest file.
 * @returns {{ data: object|null, error: string|null }}
 */
function loadManifest(filePath) {
    try {
          const resolved = path.resolve(filePath);
          if (!fs.existsSync(resolved)) {
                  return { data: null, error: `File not found: ${resolved}` };
          }
          const raw = fs.readFileSync(resolved, "utf-8");
          const data = JSON.parse(raw);
          return { data, error: null };
    } catch (err) {
          return { data: null, error: `Failed to parse JSON: ${err.message}` };
    }
}

/**
 * Validates that a manifest has all required top-level fields.
 * @param {object} manifest - Parsed manifest object.
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateTopLevelFields(manifest) {
    const errors = [];
    if (!manifest || typeof manifest !== "object") {
          return { valid: false, errors: ["Manifest is not a valid object"] };
    }
    for (const field of REQUIRED_TOP_LEVEL_FIELDS) {
          if (!(field in manifest)) {
                  errors.push(`Missing required field: "${field}"`);
          }
    }
    // Validate field types
  if (manifest.name && typeof manifest.name !== "string") {
        errors.push('"name" must be a string');
  }
    if (manifest.description && typeof manifest.description !== "string") {
          errors.push('"description" must be a string');
    }
    if (manifest.version && typeof manifest.version !== "string") {
          errors.push('"version" must be a string');
    }
    if (manifest.actions && !Array.isArray(manifest.actions)) {
          errors.push('"actions" must be an array');
    }
    return { valid: errors.length === 0, errors };
}

/**
 * Validates a single action object within a manifest.
 * @param {object} action - An action from the actions array.
 * @param {number} index - The index of the action in the array.
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateAction(action, index) {
    const errors = [];
    const prefix = `actions[${index}]`;

  if (!action || typeof action !== "object") {
        return { valid: false, errors: [`${prefix}: action is not a valid object`] };
  }

  for (const field of REQUIRED_ACTION_FIELDS) {
        if (!(field in action)) {
                errors.push(`${prefix}: missing required field "${field}"`);
        }
  }

  // Validate action ID format (should be snake_case or lowercase)
  if (action.id && typeof action.id === "string") {
        if (!/^[a-z][a-z0-9_]*$/.test(action.id)) {
                errors.push(`${prefix}: id "${action.id}" should be lowercase snake_case`);
        }
  }

  // Validate inputs schema
  if (action.inputs) {
        if (typeof action.inputs !== "object") {
                errors.push(`${prefix}: "inputs" must be an object`);
        } else if (action.inputs.type && !VALID_SCHEMA_TYPES.includes(action.inputs.type)) {
                errors.push(`${prefix}: inputs has invalid type "${action.inputs.type}"`);
        }
  }

  // Validate outputs schema
  if (action.outputs) {
        if (typeof action.outputs !== "object") {
                errors.push(`${prefix}: "outputs" must be an object`);
        } else if (action.outputs.type && !VALID_SCHEMA_TYPES.includes(action.outputs.type)) {
                errors.push(`${prefix}: outputs has invalid type "${action.outputs.type}"`);
        }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates auth configuration if present.
 * @param {object} manifest - Parsed manifest object.
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateAuth(manifest) {
    const errors = [];
    if (!manifest.auth) {
          return { valid: true, errors: [] };
    }
    if (typeof manifest.auth !== "object") {
          return { valid: false, errors: ['"auth" must be an object'] };
    }
    if (!manifest.auth.type) {
          errors.push('"auth.type" is required when auth is specified');
    } else if (!VALID_AUTH_TYPES.includes(manifest.auth.type)) {
          errors.push(`Invalid auth type: "${manifest.auth.type}". Valid types: ${VALID_AUTH_TYPES.join(", ")}`);
    }
    if (manifest.auth.type === "oauth2" && !manifest.auth.scopes) {
          errors.push('"auth.scopes" is required for oauth2 auth type');
    }
    if (manifest.auth.scopes && !Array.isArray(manifest.auth.scopes)) {
          errors.push('"auth.scopes" must be an array');
    }
    return { valid: errors.length === 0, errors };
}

/**
 * Checks for duplicate action IDs across a manifest.
 * @param {object} manifest - Parsed manifest object.
 * @returns {{ valid: boolean, errors: string[] }}
 */
function checkDuplicateActionIds(manifest) {
    const errors = [];
    if (!manifest.actions || !Array.isArray(manifest.actions)) {
          return { valid: true, errors: [] };
    }
    const ids = new Set();
    for (const action of manifest.actions) {
          if (action.id) {
                  if (ids.has(action.id)) {
                            errors.push(`Duplicate action id: "${action.id}"`);
                  }
                  ids.add(action.id);
          }
    }
    return { valid: errors.length === 0, errors };
}

/**
 * Validates version string format (semver-like).
 * @param {string} version - Version string to validate.
 * @returns {boolean}
 */
function isValidVersion(version) {
    if (typeof version !== "string") return false;
    return /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(version);
}

/**
 * Full validation of a manifest object.
 * @param {object} manifest - Parsed manifest object.
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateManifest(manifest) {
    const allErrors = [];
    const warnings = [];

  // Top-level fields
  const topLevel = validateTopLevelFields(manifest);
    allErrors.push(...topLevel.errors);

  // Auth
  const auth = validateAuth(manifest);
    allErrors.push(...auth.errors);

  // Version format
  if (manifest.version && !isValidVersion(manifest.version)) {
        warnings.push(`Version "${manifest.version}" is not valid semver format`);
  }

  // Actions
  if (manifest.actions && Array.isArray(manifest.actions)) {
        if (manifest.actions.length === 0) {
                warnings.push("Manifest has empty actions array");
        }
        for (let i = 0; i < manifest.actions.length; i++) {
                const actionResult = validateAction(manifest.actions[i], i);
                allErrors.push(...actionResult.errors);
        }
        const dupes = checkDuplicateActionIds(manifest);
        allErrors.push(...dupes.errors);
  }

  // Schema URL check
  if (manifest.$schema && !manifest.$schema.startsWith("https://")) {
        warnings.push("$schema URL should use HTTPS");
  }

  return {
        valid: allErrors.length === 0,
        errors: allErrors,
        warnings,
  };
}

/**
 * Discovers all JSON manifest files in a directory.
 * @param {string} dirPath - Path to directory containing manifests.
 * @returns {string[]} Array of absolute file paths.
 */
function discoverManifests(dirPath) {
    const resolved = path.resolve(dirPath);
    if (!fs.existsSync(resolved)) {
          return [];
    }
    return fs
      .readdirSync(resolved)
      .filter((f) => f.endsWith("-manifest.json"))
      .map((f) => path.join(resolved, f));
}

module.exports = {
    loadManifest,
    validateTopLevelFields,
    validateAction,
    validateAuth,
    checkDuplicateActionIds,
    isValidVersion,
    validateManifest,
    discoverManifests,
    REQUIRED_TOP_LEVEL_FIELDS,
    REQUIRED_ACTION_FIELDS,
    VALID_AUTH_TYPES,
    VALID_SCHEMA_TYPES,
};
