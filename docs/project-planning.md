# PixSolve V1 Planning

## Epics

Create the following epics for PixSolve V1. The numbering shows the recommended delivery order, not a hard dependency in every case.

1. **Project Foundation**
   Establish the application structure, configuration, database connection, logging, error handling, and test foundation.

2. **Image Upload and Processing**
   Accept one validated image and implement the resize, compress, and convert operations with Sharp.

3. **Job Management**
   Persist jobs, model their lifecycle, create jobs, and retrieve individual job status.

4. **Background Processing**
   Introduce Redis, BullMQ, and the worker so image processing runs outside the HTTP request lifecycle.

5. **Cloudinary File Storage**
   Store original and processed images in Cloudinary and persist the required file metadata.

6. **Authentication**
   Implement the account and authentication behavior required by the final V1 scope.

7. **Processing History and Access Control**
   Associate jobs with users, expose processing history, enforce job ownership, and protect guest job access.

8. **Testing and Quality Assurance**
   Complete the required authentication, job, validation, worker, and authorization test coverage.

9. **API Documentation**
   Document the V1 API, request fields, responses, and common errors with Swagger/OpenAPI.

10. **Demo Frontend**
    Build the AI-assisted frontend required to demonstrate upload, processing status, download, authentication, and history.

11. **Docker and Deployment**
    Containerize the required services, verify the complete setup, deploy the application, and finish the repository documentation.

## Backlog Refinement Policy

- Create all epics at the beginning of V1.
- Create and fully refine only the next 8-10 executable GitHub issues.
- Do not create all later issues in advance; their work is already represented by the epics.
- Create the next batch of issues when the current batch is close to completion.
- Add acceptance criteria before moving an issue to `Ready`.
- Re-check every refined issue against `scope-v1.md`.
- Keep no more than one issue in `In Progress`.

## Issue Roadmap

This section stores issue titles, order, epic assignment, and review status. Complete issue bodies belong in GitHub and are not duplicated here. Add later batches only when they are needed for refinement.

### Batch 1 — Draft

#### Project Foundation

1. **Set up the Express application and health endpoint**
   - GitHub issue: #13
   - Review status: Approved
   - Delivery status: Done — merged in PR #22
2. **Add environment configuration and validation**
   - GitHub issue: #14
   - Review status: Approved
   - Delivery status: Done — merged
3. **Add the MongoDB Docker service and Mongoose connection**
   - GitHub issue: #15
   - Review status: Approved
   - Delivery status: Done — merged in PR #24
4. **Configure application logging with Pino**
   - Review status: Approved
   - Delivery status: Done — merged in PR #25
5. **Add centralized error handling**
   - GitHub issue: #17
   - Review status: Approved
   - Delivery status: Done — merged in PR #26
6. **Set up the automated test foundation**
   - Delivery status: Done — merged in PR #27
   - Verification: Existing automated tests passed (2) during HTTP logging verification.

#### Image Upload and Processing

7. **Set up single-image uploads with Multer**
   - Review status: Approved — implementation reviewed against the issue and V1 scope
   - Delivery status: Done — merge confirmed by project owner
   - Verification: All 5 tests passed with `npm.cmd test`, including single-file reception, multiple-file rejection, and unexpected-field rejection through the centralized error handler.
8. **Validate uploaded image files**
   - GitHub issue: #20
   - Review status: Approved — implementation reviewed against the issue, approved decisions, and V1 scope
   - Implementation status: Complete
   - Delivery status: Done — merge confirmed by project owner
   - Verification: All 11 automated tests passed with `npm.cmd test`, including valid JPEG, PNG, and WebP uploads and missing, oversized, unsupported, multiple-file, and unexpected-field rejection cases.
9. **Add reusable Zod request validation middleware**
   - GitHub issue: #32
   - Review status: Approved — implementation reviewed against the issue and V1 scope
   - Delivery status: Done — merged in PR #33
   - Verification: Independent in-memory checks passed for parsed and transformed request data, asynchronous validation, body/query/params error mapping, and the standardized HTTP 422 response; all 11 existing automated tests passed with `npm.cmd test`.
10. **Implement image resize with Sharp**
   - Review status: Approved — implementation reviewed against the issue, approved resize decision, and V1 scope
   - Implementation status: Complete
   - Delivery status: Done — merge confirmed by project owner
   - Verification: All 20 automated tests passed with `npm.cmd test`, including successful JPEG, PNG, and WebP resizing to known output dimensions and rejection of invalid resize options before Sharp processing.

The existing initial commit already covers basic npm initialization, package metadata, development scripts, `.gitignore`, and the V1 scope file. Do not create a retrospective issue for that completed work.

### Batch 1 Supplement — Approved (2026-09-04)

1. **Add structured HTTP request logging**
   - Epic: Project Foundation
   - Delivery order: After Batch 1 item 6, **Set up the automated test foundation**, and before Batch 1 item 7, **Set up single-image uploads with Multer**.
   - Review status: Approved — including request UUIDs, the `X-Request-Id` response header, and status-based log levels
   - Delivery status: Done — merge confirmed by project owner
   - Verification: Existing tests passed (2); additional in-memory checks passed for 200/404/400/500 summaries, request IDs, log levels, query-free paths, sensitive request/response data exclusion, and a single original unexpected-error stack.
   - GitHub issue: Number not recorded; project owner manages GitHub status

This supplement extends Project Foundation with the agreed HTTP logging work. Keep the existing issue order otherwise unchanged and implement only one issue at a time.

Project Foundation is complete: all required foundation issues above have been implemented and verified. Image Upload and Processing continues in Batch 2 below.

### Batch 2 — Draft (2026-09-07)

1. **Implement image compression with Sharp**
   - Epic: Image Upload and Processing
   - Review status: Approved — implementation reviewed against the issue, approved compression decision, and V1 scope
   - Implementation status: Complete
   - Delivery status: Done — merge confirmed by project owner
   - Verification: All 29 automated tests passed with `npm.cmd test`, including successful JPEG, PNG, and WebP compression with preserved format and dimensions, and rejection of invalid compression options before Sharp processing.
2. **Implement image format conversion with Sharp**
   - Epic: Image Upload and Processing
   - Review status: Approved — implementation reviewed against the issue and V1 scope
   - Implementation status: Complete
   - Delivery status: Done — merge confirmed by project owner
   - Verification: All 43 automated tests passed with `npm.cmd test`, including all nine JPEG, PNG, and WebP input/output conversion combinations and rejection of unsupported conversion formats before Sharp processing.
3. **Validate job operation requests and operation-specific options**
   - Epic: Image Upload and Processing
   - Review status: Approved — implementation reviewed against the issue, confirmed request-format and resize-limit decisions, and V1 scope
   - Implementation status: Complete
   - Delivery status: Done — merge confirmed by project owner
   - Verification: All 66 automated tests passed with `npm.cmd test`, including normalized multipart data for every supported operation and rejection of unsupported operations, missing or malformed options, invalid limits, mismatched options, and extra options through the standard HTTP 422 validation response.
4. **Add a dispatcher for supported image operations**
   - Epic: Image Upload and Processing
   - Review status: Approved — implementation reviewed against the issue and V1 scope
   - Implementation status: Complete
   - Delivery status: Done — merge confirmed by project owner
   - Verification: All 70 automated tests passed with `npm.cmd test`, including dispatcher coverage for resize, compression, conversion, processed-buffer metadata, and clear rejection of unsupported operations.
5. **Define the Job model and status lifecycle**
   - Epic: Job Management
   - Review status: Approved — implementation reviewed against the issue, approved Job metadata and lifecycle decisions, and V1 scope
   - Implementation status: Complete
   - Delivery status: Done — merged in PR #49
   - Verification: All 78 automated tests passed with `npm.cmd test`, including 8 database-backed Job model tests covering guest persistence, lifecycle states, required completion/failure metadata, invalid enums, and the default pending status.
6. **Add Redis to the local Docker environment**
   - Epic: Background Processing
   - Review status: Approved — implementation reviewed against the issue, Context7-backed Redis and Zod configuration guidance, and V1 scope
   - Implementation status: Complete
   - Delivery status: Done — merge confirmed by project owner
   - Verification: Docker Compose configuration validated; MongoDB and Redis started together; Redis reported healthy and returned `PONG`; host port `6379` was reachable; MongoDB returned `{ ok: 1 }`; invalid `REDIS_URL` failed startup clearly; and all 78 automated tests passed with `npm.cmd test`.
7. **Configure the BullMQ connection and processing queue**
   - Epic: Background Processing
   - Review status: Approved — implementation reviewed against the issue, approved queue policy, Context7-backed BullMQ and ioredis guidance, and V1 scope
   - Implementation status: Complete
   - Delivery status: Done — merge confirmed by project owner
   - Verification: All 80 automated tests passed with `npm.cmd test`, including queue-name, minimal-payload, retry-policy, cleanup-policy, Redis persistence, and clean resource-shutdown coverage.
8. **Configure Cloudinary and add image storage helpers**
   - Epic: Cloudinary File Storage
   - Review status: Approved — implementation reviewed against the combined issue, approved Cloudinary storage/access decisions, Context7-backed Cloudinary SDK guidance, and V1 scope
   - Implementation status: Complete
   - Delivery status: Done — merged in PR #66
   - Verification: All 91 automated tests passed with `npm.cmd test`, including central client configuration, missing-variable validation, secret-safe errors, original and processed buffer uploads, approved public-ID organization, incomplete-response handling, callback and stream failures, and Sharp-readable original retrieval. A development-account integration check also uploaded original PNG and processed WebP assets under the approved prefixes, retrieved the original as a Sharp-readable 120×80 PNG buffer, and successfully deleted both temporary assets.
9. **Implement the BullMQ image-processing worker**
    - Epic: Background Processing
    - Review status: Approved — implementation reviewed against the issue, confirmed worker decisions, Context7-backed BullMQ guidance, and V1 scope
    - Implementation status: Complete
    - Delivery status: Done — merge confirmed by project owner
    - Verification: All 95 automated tests passed with `npm.cmd test`, including successful processing, final failure handling, retry-state behavior, and completed-job redelivery protection. Development integration checks verified a separate worker process consuming real BullMQ jobs, `pending` to `processing` to `completed` and `pending` to `processing` to `failed` MongoDB transitions, three failed attempts, persisted output metadata and safe failure details, and start, completion, and failure logs. Temporary MongoDB, Redis, and Cloudinary verification records were removed.

Image Upload and Processing is complete: all required V1 upload validation, operation validation, Sharp processors, and dispatcher work has been implemented, verified, and merged. The next epic is **Job Management**, beginning with **Define the Job model and status lifecycle**.

Background Processing is complete: Redis, the shared BullMQ queue, and the separate image-processing worker have been implemented, verified, and merged. The next planned executable issue is **Create image-processing jobs for guest users** under Job Management.

### Batch 3 — Draft (2026-09-13)

1. **Create image-processing jobs for guest users**
   - Epic: Job Management
   - Review status: Approved — implementation reviewed against the issue, approved guest-access, response, API-versioning, and partial-failure decisions, and V1 scope
   - Implementation status: Complete
   - Delivery status: Done — merged in PR #65
   - Verification: All 95 infrastructure-independent automated tests passed, including successful guest job acceptance, request validation before side effects, storage failure, persistence compensation, queue compensation, compensation failure handling, Cloudinary deletion, deterministic BullMQ IDs, safe guest-token persistence, and the `/api/v1/image-processing/jobs` route contract. The MongoDB/Redis-backed full-suite portion and live end-to-end request remained pending at the time of review because the local Docker engine was unavailable in the review environment.
2. **Retrieve and protect guest job status**
   - Epic: Job Management
   - GitHub issue: #55
   - Review status: Approved — implementation reviewed against the issue, confirmed guest-access and download decisions, and V1 scope
   - Implementation status: Complete
   - Delivery status: Done — merge confirmed by project owner (commit `d19c55a`)
   - Verification: Eight focused HTTP tests passed for all four statuses, missing and malformed credentials, invalid and nonexistent IDs, cross-job token rejection, safe response fields, and sanitized database failures. The full automated suite passed (116 tests). Live Cloudinary download was not exercised by these mocked retrieval tests.
3. **Implement email service**
   - Epic: Authentication
   - GitHub issue: #58
   - Review status: Approved — implementation reviewed against the issue and V1 scope; project owner confirmed that the synthetic error cause may contain Resend's reported error name
   - Implementation status: Complete
   - Delivery status: Done — merge confirmed by project owner on 2026-09-22
   - Verification: Six focused email-service and configuration tests passed. The full automated suite passed (122 tests). Provider delivery was mocked; a live Resend send was not exercised.
4. **define the user model and Implement user signup**
   - Epic: Authentication
   - GitHub issue: #57
   - Review status: Approved — implementation reviewed against the issue, confirmed authentication decisions, and V1 scope
   - Implementation status: Complete
   - Delivery status: Done — merge confirmed by project owner on 2026-09-23
   - Verification: All 133 automated tests passed with `npm.cmd test`, including 11 focused User-model, signup, and email-verification tests. Verification email delivery was mocked; a live Resend delivery was not exercised.
5. **Implement JWT-based login**
   - Epic: Authentication
   - GitHub issue: #59
   - Review status: Approved — body updated by project owner; includes required and optional JWT middleware
   - Delivery status: Done — merge confirmed by project owner on 2026-09-24
   - Verification: All 140 automated tests passed with `npm.cmd test`, including successful login, common invalid-credentials responses, unverified-user handling, Zod validation, reusable Argon2 password comparison, and required/optional JWT middleware behavior.
6. **Implement the refresh-token flow**
   - Epic: Authentication
   - GitHub issue: #61
   - Review status: Deferred — removed from V1 scope on 2026-09-24; revisit in a post-V1 version
7. **Implement the forgot-password and password-reset flow**
   - Epic: Authentication
   - GitHub issue: #62
   - Review status: Approved — implementation reviewed against the combined issue, `scope-v1.md`, and the approved password-recovery decisions
   - Implementation status: Complete
   - Delivery status: Done — merged in commit `e1f07ee`
   - Verification: The focused password-recovery tests cover indistinguishable forgot-password responses, hashed expiring reset tokens, one-time use, atomic password replacement, old/new login behavior, access-token invalidation, and sanitized email-delivery failure handling.
8. **Implement the password reset**
   - Epic: Authentication
   - GitHub issue: #63
   - Review status: Superseded — close as duplicate of #62 after the combined issue body is saved on GitHub
9. **Implement update password**
   - Epic: Authentication
   - GitHub issue: #68
   - Review status: Approved — implementation reviewed against the issue, `scope-v1.md`, and approved password-update decisions
   - Implementation status: Complete
   - Delivery status: Done — merge confirmed by project owner on 2026-09-26
   - Verification: All 152 automated tests passed with `npm.cmd test`, including six focused password-update tests for success, required JWT authentication, Zod validation and confirmation, incorrect-current-password rejection, old/new login behavior, access-token invalidation, and best-effort password-change notification delivery. Notification HTML metadata escaping is covered by the email-service tests.

Authentication issue restructure confirmed by the project owner on 2026-09-21. The seven issues above replace the original eight authentication issues. Email verification remains in #57; required and optional JWT middleware remains in #59. Superseded issues #56 and #60 are closed. No application implementation is included in this restructure.

### Batch 4 — Draft (2026-09-26)

1. **Create image-processing jobs for authenticated users**
   - Epic: Processing History and Access Control
   - GitHub issue: #78
   - Review status: Approved — implementation reviewed against the issue, `scope-v1.md`, and the confirmed authenticated creation-response decision
   - Implementation status: Complete
   - Delivery status: Done — merge confirmed by project owner on 2026-09-26
   - Verification: The focused job-creation suite passed all 13 tests, covering guest regression, authenticated ownership and response safety, owner-injection rejection, invalid/password-invalidated JWT rejection before side effects, and authenticated storage/persistence/queue failure compensation. The full MongoDB/Redis-backed suite could not complete in the review environment because Redis and Docker were unavailable.
2. **Retrieve account-owned jobs and enforce job access rules**
   - Epic: Processing History and Access Control
   - GitHub issue: #79
   - Review status: Approved — implementation reviewed against the issue, `scope-v1.md`, and the confirmed credential-precedence decision
   - Implementation status: Complete
   - Delivery status: Done — merged in commit `1455c75`
   - Verification: The focused account and guest retrieval suites passed all 20 tests, covering all four job statuses, owner-only lookup, cross-account concealment, unauthenticated and guest/account isolation, JWT precedence, invalid JWT rejection without fallback, malformed and nonexistent IDs, safe response fields, and centralized database-failure handling.
3. **Implement authenticated Processing History**
   - Epic: Processing History and Access Control
   - GitHub issue: #80
   - Review status: Approved — implementation reviewed against the issue, `scope-v1.md`, and the confirmed Processing History pagination decision
   - Implementation status: Complete
   - Delivery status: Done — merged in commit `172e214`
   - Verification: All six focused Processing History HTTP tests passed, covering required/invalid JWT authentication, owner-only list and count filters, guest and other-account exclusion through the owner filter, default and valid pagination, maximum limit, malformed and unsupported query rejection, deterministic sort and offset, safe fields for every status, empty and beyond-range results, and sanitized database failures.
4. **Verify the integrated V1 job lifecycle and account isolation**
   - Epic: Testing and Quality Assurance
   - GitHub issue: #81
   - Review status: Approved — implementation reviewed against the issue and the implemented V1 lifecycle contracts
   - Implementation status: Complete
   - Delivery status: Done — merged in commit `63723c8`
   - Verification: The opt-in live integration test exercises guest resize, authenticated compression and conversion, terminal success and failure states, HTTP retrieval, Processing History ownership, cross-account and cross-access-mode isolation, output metadata and downloads, separate-worker logging, and cleanup across MongoDB, BullMQ, Cloudinary, Sharp, and the API.
5. **Document the V1 API with OpenAPI and Swagger UI**
   - Epic: API Documentation
   - GitHub issue: #82
   - Review status: Approved — implementation reviewed against the issue, `scope-v1.md`, and the confirmed API-documentation decision
   - Implementation status: Complete
   - Delivery status: Done — merge confirmed by project owner on 2026-09-27
   - Verification: `npm.cmd test` passed with 184 passing tests and one existing external-infrastructure integration test skipped. The new focused OpenAPI tests validate the OpenAPI 3.0.3 document and all references, verify every implemented V1 operation is documented, and confirm the specification, Swagger UI, initializer, and UI bundle are served successfully under Helmet's existing CSP.

API Documentation is complete: its required V1 OpenAPI and Swagger UI work has been implemented, verified, and merged. The integrated lifecycle verification listed above was subsequently completed and merged. Demo Frontend work is recorded below.
6. **Define the V1 frontend design direction and architecture**
   - Epic: Demo Frontend
   - GitHub issue: #83
   - Review status: Approved — project owner confirmed the visual direction, React/Vite architecture, session-scoped credentials, account navigation, and polling policy on 2026-09-27
   - Implementation status: Complete — documentation only, as required by the issue
   - Delivery status: Done — project owner confirmed completion on 2026-09-27
   - Verification: The approved reference in `docs/frontend-design.md` maps all V1 screens to existing API contracts, includes desktop/mobile layout notes and representative states, documents access-token and guest-credential behavior, and preserves deferred V1 boundaries.
7. **Build the guest image-processing demo frontend**
   - Epic: Demo Frontend
   - Review status: Approved — implementation reviewed against the approved frontend design and guest API contracts
   - Implementation status: Complete
   - Delivery status: Done — merged in commit `f9734c9`
   - Verification: The merged frontend provides guest image upload and operation selection, safe guest-credential storage, accepted-job navigation, terminal-state polling, completed-result download, failed-job handling, validation feedback, and responsive desktop/mobile presentation.
8. **Add V1 authentication flows to the demo frontend**
   - Epic: Demo Frontend
   - Review status: Approved — implementation reviewed against the approved frontend design and authentication API contracts
   - Implementation status: Complete
   - Delivery status: Done — merged in commit `4988803`
   - Verification: The merged frontend provides signup, email verification, login, forgot-password, reset-password, authenticated password update, protected navigation, session-scoped access-token state, and the required re-login behavior after password changes.
9. **Add authenticated processing and history to the demo frontend**
   - Epic: Demo Frontend
   - Review status: Approved — implementation reviewed against the approved frontend design and account-owned job contracts
   - Implementation status: Complete
   - Delivery status: Done — merged in commit `5d90034`
   - Verification: The merged frontend supports authenticated job creation, account-mode polling and job details, owner-only Processing History, pagination, authentication-expiry handling, and separation between guest and account access modes.

Demo Frontend is complete: all three required implementation issues have been implemented and merged. The documentation reconciliation under Project Foundation has also been completed and merged. The deployment topology, containerization, local stack, production configuration, and public frontend/API connection have since been completed. The next planned issue is **Write the V1 README, setup guide, and architecture overview** under Docker and Deployment.

### Batch 5 — Draft (2026-09-28)

1. **Reconcile V1 scope and planning records with approved decisions and merged work**
   - Epic: Project Foundation
   - Review status: Approved — project owner approved the documentation-only reconciliation against the implemented contracts and merged work
   - Implementation status: Complete
   - Delivery status: Done — merge confirmed by project owner on 2026-09-28
   - Verification: The revised documentation was compared with the implemented routes, OpenAPI document, frontend, tests, and commits `63723c8`, `f9734c9`, `4988803`, and `5d90034`. The full backend suite passed with 184 tests and one opt-in external-infrastructure lifecycle test skipped; the frontend production build also passed. Refresh-token and stale incomplete-work statements were checked without deciding deployment topology or file-retention policy.
   - Recovery status: Reconstructed on 2026-09-30 after the merged `scope-v1.md` changes were accidentally lost. Twenty unreachable scope snapshots were audited alongside the decision log, planning record, implementation, OpenAPI document, tests, frontend, Docker configuration, and deployed topology. Every documented API operation now matches OpenAPI exactly, the contradiction scan is clean, and the frontend production build passed. The recovered correction is ready for review and PR.
2. **Decide the V1 deployment topology and production environment contract**
   - Epic: Docker and Deployment
   - Review status: Approved — project owner approved the documented V1 topology and production environment contract
   - Implementation status: Complete
   - Delivery status: Done — merged, as confirmed by project owner on 2026-09-28
   - Verification: Confirmed a Vercel frontend with the final custom origin `https://pixsolve.org`; Caddy and the API at `https://api.pixsolve.org`; a separate BullMQ worker and Redis on one Oracle Cloud Always Free VM; MongoDB Atlas Free; Cloudinary; and Resend. Documented the HTTPS, internal-service, and environment-variable contract in `scope-v1.md` and `docs/project-decisions.md`; no secrets were committed.
3. **Containerize the Node.js API and image-processing worker**
   - Epic: Docker and Deployment
   - Review status: Approved — implementation merged, as confirmed by project owner on 2026-09-28
   - Implementation status: Complete
   - Delivery status: Done — merge confirmed by project owner on 2026-09-28
4. **Containerize the PixSolve frontend for production serving**
   - Epic: Docker and Deployment
   - Review status: Approved — implementation verified against the issue, approved production environment contract, and V1 scope
   - Implementation status: Complete
   - Delivery status: Done — merge confirmed by project owner on 2026-09-28
   - Verification: A clean Docker build completed with the public `VITE_API_BASE_URL` build argument; the final Nginx image returned HTTP 200 for `/`, the direct React route `/login`, and a generated JavaScript asset. The public API base was embedded in the production bundle, and the final image contained no frontend environment variables or backend credentials.
5. **Run the complete local PixSolve stack with Docker Compose**
   - Epic: Docker and Deployment
   - Review status: Approved — Compose implementation reviewed against the issue, V1 scope, and local environment contract
   - Implementation status: Complete
   - Delivery status: Done — merge confirmed by project owner on 2026-09-28
   - Verification: `docker compose config` validated; `docker compose down --volumes` followed by `docker compose up --build -d` created a clean five-service stack; MongoDB, Redis, and API became healthy; frontend and API returned HTTP 200; a supported guest resize was accepted by the API, completed by the worker, downloaded from Cloudinary, and inspected by Sharp as a 16×12 PNG. A non-destructive stop/start check also confirmed the MongoDB named volume remained usable.
6. **Configure production service credentials and email delivery**
   - Epic: Docker and Deployment
   - GitHub issue: #102
   - Review status: Approved — project owner confirmed completion on 2026-09-30
   - Implementation status: Complete
   - Delivery status: Done — merged in PR #111
   - Verification: Production configuration uses MongoDB Atlas, Cloudinary, Resend with verified `pixsolve.org` and sender `contact@pixsolve.org`, an explicit CORS origin of `https://pixsolve.org`, and a shared API/worker JWT secret. Environment validation passed without committing secrets. Project owner confirmed the deployed frontend and backend verification is complete.
7. **Deploy the API, worker, database, and Redis services**
   - Epic: Docker and Deployment
   - Review status: Approved — production backend topology and configuration reviewed against the approved V1 deployment contract
   - Implementation status: Complete
   - Delivery status: Done — merged in PR #109
   - Verification: The production Compose topology runs Caddy, the API, the separate worker, and persistent Redis on the Oracle Cloud VM, connects API and worker to MongoDB Atlas, Cloudinary, and Resend through an external secrets file, exposes only Caddy publicly, and serves the healthy API at `https://api.pixsolve.org`.
8. **Deploy the frontend and connect it to the public API**
   - Epic: Docker and Deployment
   - Review status: Approved — public frontend deployment and production API integration verified
   - Implementation status: Complete
   - Delivery status: Done — merged in PR #110
   - Verification: The Vercel production deployment is ready and serves `https://pixsolve.org` over HTTPS. Direct loads of all V1 client routes return the React entry point through the SPA fallback. The production bundle contains `https://api.pixsolve.org/api/v1` and no detected backend-secret names. The public API health endpoint returned HTTP 200; CORS preflight from `https://pixsolve.org` returned HTTP 204 and allowed the required `Authorization` and `X-Guest-Access-Token` headers. A guest conversion job was accepted, completed by the worker, and downloaded successfully from Cloudinary as a JPEG. Project owner approved completion on 2026-09-30.
9. **Write the V1 README, setup guide, and architecture overview**
   - Epic: Docker and Deployment
   - Review status: Approved — implementation reviewed against the issue, `scope-v1.md`, and the deployed V1 topology
   - Implementation status: Complete
   - Delivery status: Done — merge confirmed by project owner on 2026-09-30
   - Verification: The root README documents the implemented V1 feature set, local and Docker Compose workflows, separate API and worker processes, environment examples, deployed frontend/API/OpenAPI links, architecture, job lifecycle, and V1 limitations. Referenced README assets are committed. The frontend production build passed; the public-link targets match the previously verified deployment record.

Docker and Deployment is complete: all required V1 containerization, local-stack, production-topology, deployment, and README documentation work has been implemented, verified, and merged. The next planned issue is **Perform public V1 release verification** under Testing and Quality Assurance.

10. **Perform public V1 release verification**
   - Epic: Testing and Quality Assurance
   - Review status: Draft

### Maintenance Backlog — Draft (2026-09-05)

1. **Rename the error handler module to use kebab-case**
   - Epic: Project Foundation
   - Review status: Draft
   - Delivery status: Backlog
   - V1 impact: Optional maintenance follow-up; not required to keep the Project Foundation epic complete
   - GitHub issue: Not yet created

## Board Workflow

```text
Backlog -> Ready -> In Progress -> In Review -> Done
```

An executable work item follows this path:

```text
Issue -> Branch -> Implementation -> Verification -> Pull Request -> Self-review -> Merge -> Done
```

## Collaboration Workflow

1. The project owner asks for the next issue or refinement batch.
2. The assistant drafts the issue bodies within `scope-v1.md`.
3. The project owner reviews the drafts and creates the approved issues on GitHub.
4. The assistant provides implementation guidance without modifying application source code.
5. The project owner writes the code and shares the completed changes for review.
6. The assistant reviews the changes against the issue acceptance criteria and project scope.
7. The project owner applies any required corrections and completes the GitHub workflow.
8. When every required issue in an epic is verified, the assistant reports that the epic is complete and identifies the next work.
