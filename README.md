# EcoAir Copilot Skills

Microsoft Copilot skill manifests for EcoAir HVAC operations. Each manifest defines actions, inputs, outputs, and authentication for a Copilot skill extension.

## Manifests

| Manifest | Description |
|---|---|
| `crm-intelligence-manifest.json` | Client relationship and account intelligence |
| `daily-brief-manifest.json` | Executive daily briefing engine |
| `dispatch-intelligence-manifest.json` | Field operations optimizer and technician routing |
| `doc-generator-manifest.json` | Professional business document generator |
| `financial-ops-manifest.json` | Financial operations intelligence |
| `inbox-triage-manifest.json` | Email triage and reply drafting |
| `onedrive-dedup-manifest.json` | OneDrive duplicate file consolidation |
| `shop-parts-ops-manifest.json` | Shop repair lifecycle and parts inventory |

## Prerequisites

- Node.js >= 18
- - npm
 
  - ## Getting Started
 
  - ```bash
    # Install dependencies
    npm install

    # Run tests
    npm test

    # Validate manifests only
    node scripts/validate-manifests.js

    # Validate manifests with details
    node scripts/validate-manifests.js --verbose
    ```

    ## Running Tests Locally

    The test suite validates both the manifest validator library and all actual manifest files:

    ```bash
    # Run all tests with verbose output
    npm test

    # Run tests in CI mode with coverage
    npm run test:ci
    ```

    The test suite covers:
    - Top-level field validation (happy path, missing fields, wrong types)
    - - Action validation (required fields, snake_case IDs, schema types)
      - - Auth configuration (oauth2, api_key, none, invalid types)
        - - Duplicate action ID detection
          - - Semver version format validation
            - - Integration tests against all 8 real manifest files
              - - JSON parse validation for every manifest
               
                - ## Staging Rollout
               
                - The rollout script supports a safe staging-first deployment workflow:
               
                - ```bash
                  # Deploy to staging
                  bash scripts/rollout_staging.sh

                  # Preview what would happen (dry run)
                  bash scripts/rollout_staging.sh --dry-run

                  # Promote staging to production (requires explicit confirmation)
                  bash scripts/rollout_staging.sh --promote

                  # Deploy a specific tag
                  bash scripts/rollout_staging.sh --tag v1.2.0

                  # See all options
                  bash scripts/rollout_staging.sh --help
                  ```

                  ### Rollout Steps

                  1. **Preflight checks** - Validates git repo, Node.js, manifests directory, clean working tree
                  2. 2. **Run tests** - Executes manifest validation and full test suite
                     3. 3. **Build/package** - Creates timestamped build artifact with metadata
                        4. 4. **Deploy to staging** - Copies build to staging target
                           5. 5. **Smoke tests** - Validates build artifact, JSON integrity, health check endpoint
                              6. 6. **Promote to production** (optional) - Requires `--promote` flag and explicit `yes` confirmation
                                
                                 7. ### Environment Variables
                                
                                 8. | Variable | Default | Description |
                                 9. |---|---|---|
                                 10. | `DEPLOY_TARGET_STAGING` | *(simulated)* | Staging deployment target (path or rsync URL) |
                                 11. | `DEPLOY_TARGET_PROD` | *(simulated)* | Production deployment target |
                                 12. | `HEALTH_CHECK_URL_STAGING` | *(none)* | URL to check after staging deploy |
                                 13. | `HEALTH_CHECK_URL_PROD` | *(none)* | URL to check after production deploy |
                                 14. | `HEALTH_CHECK_TIMEOUT` | `30` | Timeout in seconds for health checks |
                                
                                 15. ## CI/CD
                                
                                 16. Pull requests and pushes to `main` automatically trigger:
                                 17. - Unit tests on Node.js 18 and 20
                                     - - Manifest validation (both JSON syntax and schema)
                                       - - Coverage report generation
                                        
                                         - ## Project Structure
                                        
                                         - ```
                                           ecoair-copilot-skills/
                                             .github/workflows/ci.yml    # GitHub Actions CI pipeline
                                             lib/manifest-validator.js    # Manifest validation library
                                             manifests/                   # Copilot skill manifest JSON files
                                             scripts/
                                               validate-manifests.js      # CLI manifest validation tool
                                               rollout_staging.sh         # Staging rollout script
                                             tests/
                                               manifest-validator.test.js # Unit and integration tests
                                             package.json
                                             .gitignore
                                             README.md
                                           ```
