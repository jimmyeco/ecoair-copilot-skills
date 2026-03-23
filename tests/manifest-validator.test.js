"use strict";

const path = require("path");
const {
    validateTopLevelFields,
    validateAction,
    validateAuth,
    checkDuplicateActionIds,
    isValidVersion,
    validateManifest,
    discoverManifests,
    REQUIRED_TOP_LEVEL_FIELDS,
    REQUIRED_ACTION_FIELDS,
} = require("../lib/manifest-validator");

// ---------------------------------------------------------------------------
// Helper: minimal valid manifest
// ---------------------------------------------------------------------------
function validManifest(overrides = {}) {
    return {
          $schema: "https://schemas.microsoft.com/copilot/copilot-extensions/v1/skill-manifest.json",
          name: "Test Skill",
          description: "A test skill manifest",
          version: "1.0.0",
          publisher: "EcoAir Inc.",
          schemaVersion: "1.0",
          auth: { type: "oauth2", scopes: ["Mail.ReadWrite"] },
          actions: [
            {
                      id: "test_action",
                      name: "Test Action",
                      description: "Does something",
                      inputs: { type: "object", properties: {} },
                      outputs: { type: "object", properties: {} },
            },
                ],
          ...overrides,
    };
}

// ===========================================================================
// validateTopLevelFields
// ===========================================================================
describe("validateTopLevelFields", () => {
    test("accepts a fully valid manifest", () => {
          const result = validateTopLevelFields(validManifest());
          expect(result.valid).toBe(true);
          expect(result.errors).toHaveLength(0);
    });

           test.each(REQUIRED_TOP_LEVEL_FIELDS)("rejects manifest missing '%s'", (field) => {
                 const manifest = validManifest();
                 delete manifest[field];
                 const result = validateTopLevelFields(manifest);
                 expect(result.valid).toBe(false);
                 expect(result.errors.some((e) => e.includes(field))).toBe(true);
           });

           test("rejects null input", () => {
                 const result = validateTopLevelFields(null);
                 expect(result.valid).toBe(false);
                 expect(result.errors[0]).toMatch(/not a valid object/);
           });

           test("rejects undefined input", () => {
                 const result = validateTopLevelFields(undefined);
                 expect(result.valid).toBe(false);
           });

           test("rejects a non-object (string)", () => {
                 const result = validateTopLevelFields("hello");
                 expect(result.valid).toBe(false);
           });

           test("rejects a non-object (number)", () => {
                 const result = validateTopLevelFields(42);
                 expect(result.valid).toBe(false);
           });

           test("flags name that is not a string", () => {
                 const manifest = validManifest({ name: 123 });
                 const result = validateTopLevelFields(manifest);
                 expect(result.errors.some((e) => e.includes('"name" must be a string'))).toBe(true);
           });

           test("flags description that is not a string", () => {
                 const manifest = validManifest({ description: true });
                 const result = validateTopLevelFields(manifest);
                 expect(result.errors.some((e) => e.includes('"description" must be a string'))).toBe(true);
           });

           test("flags version that is not a string", () => {
                 const manifest = validManifest({ version: 1 });
                 const result = validateTopLevelFields(manifest);
                 expect(result.errors.some((e) => e.includes('"version" must be a string'))).toBe(true);
           });

           test("flags actions that is not an array", () => {
                 const manifest = validManifest({ actions: "not-array" });
                 const result = validateTopLevelFields(manifest);
                 expect(result.errors.some((e) => e.includes('"actions" must be an array'))).toBe(true);
           });

           test("accepts empty object (reports all missing fields)", () => {
                 const result = validateTopLevelFields({});
                 expect(result.valid).toBe(false);
                 expect(result.errors.length).toBe(REQUIRED_TOP_LEVEL_FIELDS.length);
           });
});

// ===========================================================================
// validateAction
// ===========================================================================
describe("validateAction", () => {
    const validAction = {
          id: "my_action",
          name: "My Action",
          description: "Does stuff",
          inputs: { type: "object", properties: {} },
          outputs: { type: "object", properties: {} },
    };

           test("accepts a valid action", () => {
                 const result = validateAction(validAction, 0);
                 expect(result.valid).toBe(true);
                 expect(result.errors).toHaveLength(0);
           });

           test.each(REQUIRED_ACTION_FIELDS)("rejects action missing '%s'", (field) => {
                 const action = { ...validAction };
                 delete action[field];
                 const result = validateAction(action, 0);
                 expect(result.valid).toBe(false);
                 expect(result.errors.some((e) => e.includes(field))).toBe(true);
           });

           test("rejects null action", () => {
                 const result = validateAction(null, 0);
                 expect(result.valid).toBe(false);
                 expect(result.errors[0]).toMatch(/not a valid object/);
           });

           test("rejects non-object action", () => {
                 const result = validateAction("string", 0);
                 expect(result.valid).toBe(false);
           });

           test("flags camelCase action id", () => {
                 const action = { ...validAction, id: "myAction" };
                 const result = validateAction(action, 0);
                 expect(result.errors.some((e) => e.includes("snake_case"))).toBe(true);
           });

           test("flags action id starting with number", () => {
                 const action = { ...validAction, id: "1bad_id" };
                 const result = validateAction(action, 0);
                 expect(result.errors.some((e) => e.includes("snake_case"))).toBe(true);
           });

           test("accepts valid snake_case id", () => {
                 const action = { ...validAction, id: "get_account_summary" };
                 const result = validateAction(action, 0);
                 expect(result.errors.filter((e) => e.includes("snake_case"))).toHaveLength(0);
           });

           test("flags invalid inputs type", () => {
                 const action = { ...validAction, inputs: { type: "invalid_type" } };
                 const result = validateAction(action, 0);
                 expect(result.errors.some((e) => e.includes("invalid type"))).toBe(true);
           });

           test("flags invalid outputs type", () => {
                 const action = { ...validAction, outputs: { type: "nope" } };
                 const result = validateAction(action, 0);
                 expect(result.errors.some((e) => e.includes("invalid type"))).toBe(true);
           });

           test("flags non-object inputs", () => {
                 const action = { ...validAction, inputs: "bad" };
                 const result = validateAction(action, 0);
                 expect(result.errors.some((e) => e.includes('"inputs" must be an object'))).toBe(true);
           });

           test("flags non-object outputs", () => {
                 const action = { ...validAction, outputs: 42 };
                 const result = validateAction(action, 0);
                 expect(result.errors.some((e) => e.includes('"outputs" must be an object'))).toBe(true);
           });

           test("includes correct index in error prefix", () => {
                 const result = validateAction(null, 5);
                 expect(result.errors[0]).toMatch(/actions\[5\]/);
           });
});

// ===========================================================================
// validateAuth
// ===========================================================================
describe("validateAuth", () => {
    test("passes when auth is absent", () => {
          const result = validateAuth({});
          expect(result.valid).toBe(true);
    });

           test("passes for valid oauth2 auth", () => {
                 const result = validateAuth({ auth: { type: "oauth2", scopes: ["Mail.ReadWrite"] } });
                 expect(result.valid).toBe(true);
           });

           test("passes for api_key auth", () => {
                 const result = validateAuth({ auth: { type: "api_key" } });
                 expect(result.valid).toBe(true);
           });

           test("passes for none auth", () => {
                 const result = validateAuth({ auth: { type: "none" } });
                 expect(result.valid).toBe(true);
           });

           test("fails for unknown auth type", () => {
                 const result = validateAuth({ auth: { type: "bearer" } });
                 expect(result.valid).toBe(false);
                 expect(result.errors.some((e) => e.includes("Invalid auth type"))).toBe(true);
           });

           test("fails when auth.type is missing", () => {
                 const result = validateAuth({ auth: {} });
                 expect(result.valid).toBe(false);
                 expect(result.errors.some((e) => e.includes("auth.type"))).toBe(true);
           });

           test("fails when oauth2 has no scopes", () => {
                 const result = validateAuth({ auth: { type: "oauth2" } });
                 expect(result.valid).toBe(false);
                 expect(result.errors.some((e) => e.includes("auth.scopes"))).toBe(true);
           });

           test("fails when scopes is not an array", () => {
                 const result = validateAuth({ auth: { type: "oauth2", scopes: "Mail.ReadWrite" } });
                 expect(result.valid).toBe(false);
                 expect(result.errors.some((e) => e.includes("must be an array"))).toBe(true);
           });

           test("fails when auth is not an object", () => {
                 const result = validateAuth({ auth: "oauth2" });
                 expect(result.valid).toBe(false);
                 expect(result.errors[0]).toMatch(/"auth" must be an object/);
           });
});

// ===========================================================================
// checkDuplicateActionIds
// ===========================================================================
describe("checkDuplicateActionIds", () => {
    test("passes with unique ids", () => {
          const manifest = validManifest({
                  actions: [
                    { id: "action_one", name: "A1", description: "d", inputs: {}, outputs: {} },
                    { id: "action_two", name: "A2", description: "d", inputs: {}, outputs: {} },
                          ],
          });
          const result = checkDuplicateActionIds(manifest);
          expect(result.valid).toBe(true);
    });

           test("fails with duplicate ids", () => {
                 const manifest = validManifest({
                         actions: [
                           { id: "same_id", name: "A1", description: "d", inputs: {}, outputs: {} },
                           { id: "same_id", name: "A2", description: "d", inputs: {}, outputs: {} },
                                 ],
                 });
                 const result = checkDuplicateActionIds(manifest);
                 expect(result.valid).toBe(false);
                 expect(result.errors[0]).toMatch(/Duplicate action id/);
           });

           test("passes when actions is missing", () => {
                 const result = checkDuplicateActionIds({});
                 expect(result.valid).toBe(true);
           });

           test("passes when actions is not an array", () => {
                 const result = checkDuplicateActionIds({ actions: "nope" });
                 expect(result.valid).toBe(true);
           });
});

// ===========================================================================
// isValidVersion
// ===========================================================================
describe("isValidVersion", () => {
    test.each(["1.0.0", "0.1.0", "10.20.30", "1.0.0-beta.1", "2.0.0-rc.1"])(
          "accepts valid version: %s",
          (v) => {
                  expect(isValidVersion(v)).toBe(true);
          }
        );

           test.each(["1.0", "v1.0.0", "1", "abc", "", "1.0.0.0", "1.0.0-"])(
                 "rejects invalid version: %s",
                 (v) => {
                         expect(isValidVersion(v)).toBe(false);
                 }
               );

           test("rejects non-string input", () => {
                 expect(isValidVersion(100)).toBe(false);
                 expect(isValidVersion(null)).toBe(false);
                 expect(isValidVersion(undefined)).toBe(false);
           });
});

// ===========================================================================
// validateManifest (integration)
// ===========================================================================
describe("validateManifest", () => {
    test("fully valid manifest passes with no errors or warnings", () => {
          const result = validateManifest(validManifest());
          expect(result.valid).toBe(true);
          expect(result.errors).toHaveLength(0);
          expect(result.warnings).toHaveLength(0);
    });

           test("accumulates errors from multiple validators", () => {
                 const bad = { name: 123, auth: { type: "invalid" } };
                 const result = validateManifest(bad);
                 expect(result.valid).toBe(false);
                 expect(result.errors.length).toBeGreaterThan(2);
           });

           test("warns on empty actions array", () => {
                 const manifest = validManifest({ actions: [] });
                 const result = validateManifest(manifest);
                 expect(result.warnings.some((w) => w.includes("empty actions"))).toBe(true);
           });

           test("warns on non-semver version", () => {
                 const manifest = validManifest({ version: "v1" });
                 const result = validateManifest(manifest);
                 expect(result.warnings.some((w) => w.includes("semver"))).toBe(true);
           });

           test("warns on non-HTTPS schema URL", () => {
                 const manifest = validManifest({ $schema: "http://example.com/schema.json" });
                 const result = validateManifest(manifest);
                 expect(result.warnings.some((w) => w.includes("HTTPS"))).toBe(true);
           });

           test("detects duplicate action IDs", () => {
                 const manifest = validManifest({
                         actions: [
                           { id: "dup", name: "A", description: "d", inputs: {}, outputs: {} },
                           { id: "dup", name: "B", description: "d", inputs: {}, outputs: {} },
                                 ],
                 });
                 const result = validateManifest(manifest);
                 expect(result.valid).toBe(false);
                 expect(result.errors.some((e) => e.includes("Duplicate"))).toBe(true);
           });
});

// ===========================================================================
// discoverManifests
// ===========================================================================
describe("discoverManifests", () => {
    test("discovers manifests in the manifests directory", () => {
          const manifestsDir = path.join(__dirname, "..", "manifests");
          const files = discoverManifests(manifestsDir);
          expect(files.length).toBeGreaterThanOrEqual(1);
          files.forEach((f) => {
                  expect(f).toMatch(/-manifest\.json$/);
          });
    });

           test("returns empty array for non-existent directory", () => {
                 const files = discoverManifests("/non/existent/path");
                 expect(files).toEqual([]);
           });
});

// ===========================================================================
// Live manifest validation (integration with real files)
// ===========================================================================
describe("live manifest validation", () => {
    const manifestsDir = path.join(__dirname, "..", "manifests");
    const files = require("fs")
      .readdirSync(manifestsDir)
      .filter((f) => f.endsWith("-manifest.json"));

           test.each(files)("%s is valid JSON", (filename) => {
                 const filePath = path.join(manifestsDir, filename);
                 const raw = require("fs").readFileSync(filePath, "utf-8");
                 expect(() => JSON.parse(raw)).not.toThrow();
           });

           test.each(files)("%s passes schema validation", (filename) => {
                 const filePath = path.join(manifestsDir, filename);
                 const data = JSON.parse(require("fs").readFileSync(filePath, "utf-8"));
                 const result = validateManifest(data);
                 expect(result.valid).toBe(true);
                 if (result.errors.length > 0) {
                         console.error(`Errors in ${filename}:`, result.errors);
                 }
                 expect(result.errors).toHaveLength(0);
           });

           test.each(files)("%s has a non-empty name", (filename) => {
                 const filePath = path.join(manifestsDir, filename);
                 const data = JSON.parse(require("fs").readFileSync(filePath, "utf-8"));
                 expect(data.name).toBeTruthy();
                 expect(data.name.length).toBeGreaterThan(0);
           });

           test.each(files)("%s has at least one action", (filename) => {
                 const filePath = path.join(manifestsDir, filename);
                 const data = JSON.parse(require("fs").readFileSync(filePath, "utf-8"));
                 expect(data.actions.length).toBeGreaterThanOrEqual(1);
           });

           test.each(files)("%s has unique action IDs", (filename) => {
                 const filePath = path.join(manifestsDir, filename);
                 const data = JSON.parse(require("fs").readFileSync(filePath, "utf-8"));
                 const ids = data.actions.map((a) => a.id);
                 expect(new Set(ids).size).toBe(ids.length);
           });

           test.each(files)("%s publisher is EcoAir Inc.", (filename) => {
                 const filePath = path.join(manifestsDir, filename);
                 const data = JSON.parse(require("fs").readFileSync(filePath, "utf-8"));
                 expect(data.publisher).toBe("EcoAir Inc.");
           });
});
