# PixSolve Scope V1

## 1. Project Goal

PixSolve is an image processing platform.

A user can upload an image, request a processing operation, and track the processing job until it is completed or failed.

The main purpose of this project is to demonstrate backend engineering skills such as:

* REST API design
* Authentication and authorization
* File uploads
* Database modeling
* Background jobs
* Queues and workers
* Image processing
* Error handling
* Validation
* Logging
* Testing
* Docker
* API documentation

This is a portfolio project, not a production SaaS product.

## 2. Core User Flow

### Guest User

```text
User uploads one image
        ↓
User selects one operation
        ↓
A processing job is created
        ↓
The job enters the queue
        ↓
A worker processes the image
        ↓
Job becomes completed or failed
        ↓
User checks the job status
        ↓
User downloads the processed image
```

### Registered User

```text
User signs up / logs in
        ↓
User uploads one image
        ↓
User selects one operation
        ↓
A processing job is created
        ↓
The job is associated with the user's account
        ↓
The job enters the queue
        ↓
A worker processes the image
        ↓
Job becomes completed or failed
        ↓
User can view it later in Processing History
```

## 3. Supported Operations

PixSolve v1 supports only these operations:

### Resize

The user can provide:

* width
* height

Example:

```json
{
  "operation": "resize",
  "options": {
    "width": 800,
    "height": 600
  }
}
```

### Compress

The user can reduce the image quality.

Example:

```json
{
  "operation": "compress",
  "options": {
    "quality": 70
  }
}
```

### Convert

Supported output formats:

* JPEG
* PNG
* WebP

Example:

```json
{
  "operation": "convert",
  "options": {
    "format": "webp"
  }
}
```

No other image operations are supported in v1.

## 4. Users

Creating an account is optional.

### Guest Users Can:

* Upload one image.
* Create a processing job.
* Check the status of that job.
* Download the processed image.

Guest jobs are not added to a permanent processing history.

### Registered Users Can:

* Sign up.
* Verify their email address.
* Log in.
* Recover and update their password.
* Perform all normal image processing operations.
* View their previous processing jobs through Processing History.
* View a specific job from their history.
* Download the processed result again while the file is still available.

A registered user cannot access another user's processing history or jobs.

The only account-specific image-processing feature in v1 is Processing History.

## 5. Authentication

Authentication is optional for using PixSolve.

Its purpose in v1 is to identify registered users and enable Processing History.

Authentication uses:

* Email
* Password
* Email verification
* JWT access tokens
* Forgot-password and reset-password flows
* Authenticated password updates

V1 uses access tokens only. Refresh tokens are not part of V1.

Signup requires `name`, `email`, `password`, and `confirmPassword`. Names are trimmed, internal whitespace is collapsed, and the resulting value must contain 2 through 100 characters. Emails are trimmed and normalized to lowercase. Passwords must contain 8 through 72 characters with at least one lowercase letter, uppercase letter, number, and symbol; password confirmation must match. Passwords are stored only as Argon2id hashes.

New accounts begin unverified and cannot log in until email verification succeeds. Email verification uses a random opaque token, stores only its SHA-256 hash and expiry, and consumes it atomically. Resend is the only V1 authentication-email provider; messages include plain-text and HTML variants, and provider failures are returned through a sanitized application error.

Login returns a configurable, expiring HS256 JWT access token for the Bearer authorization scheme. Required and optional authentication middleware reject malformed, invalid, expired, inactive-user, and password-invalidated tokens.

Forgot-password returns the same response for known and unknown accounts. Reset tokens are random, expiring, single-use credentials stored only as SHA-256 hashes. Password reset and authenticated password update invalidate access tokens issued before the password change and require the user to log in again. Authenticated password update requires the current password and a confirmed, different new password; it does not issue a replacement token, and its notification email is best effort.

Required endpoints:

```text
POST  /api/v1/auth/signup
POST  /api/v1/auth/verify-email
POST  /api/v1/auth/login
POST  /api/v1/auth/forgot-password
PATCH /api/v1/auth/reset-password
PATCH /api/v1/auth/update-password
```

All authentication routes share the configured V1 authentication rate limiter. Browser access to the API is allowed only from configured HTTP or HTTPS origins, including the required CORS preflight behavior.

Not included:

* Refresh tokens
* Social login
* Two-factor authentication

These features may be added after v1 is completed, but they are not part of the current project scope.

## 6. Image Uploads

A job accepts exactly:

```text
1 image
```

Supported formats:

* JPEG
* PNG
* WebP

Maximum upload size:

```text
5 MiB
```

The API must reject:

* Files larger than 5 MB
* Unsupported file types
* Missing files

No batch uploads.

V1 enforces the limit with Multer. Earlier infrastructure-level rejection of oversized request bodies is deferred until after V1 because it depends on the request path and deployment infrastructure.

## 7. Jobs

Each image processing request creates one job.

A job may belong to a registered user, or it may be a guest job.

A job contains approximately:

```text
id
user: ObjectId | null
operation
status
inputFile
outputFile
options
errorMessage
createdAt
updatedAt
```

Store only Cloudinary `publicId` and `secureUrl` for each original and processed image. Original-file metadata is required for every job. Processed-file metadata is required for completed jobs, and a safe error message is required for failed jobs. Mongoose does not enforce status-to-status transitions in model hooks; the worker owns lifecycle orchestration.

For a registered user, the job is associated with their account and becomes part of their Processing History.


## 8. Job Status

A job can have only one of these statuses:

```text
pending
processing
completed
failed
```

Typical lifecycle:

```text
pending
   ↓
processing
   ↓
completed
```

or:

```text
pending
   ↓
processing
   ↓
failed
```

## 9. Job Endpoints

### Create Job

```text
POST /api/v1/image-processing/jobs
```

Submit job creation as `multipart/form-data` with the image in the `image` file field, the operation in the `operation` text field, and the operation-specific options as a JSON-encoded object in the `options` text field.

For guest creation, generate a random 256-bit opaque guest access token, return it once after acceptance, and store only its SHA-256 hash. Return HTTP `202 Accepted`, set `Location` to `/api/v1/image-processing/jobs/:id`, and return a safe pending-job representation with the one-time credential. Do not return original-file metadata or internal queue data.

For authenticated creation, derive ownership from the valid optional access token, reject client-supplied ownership, return the same safe asynchronous job representation, and omit the guest credential.

Report acceptance only after Cloudinary upload, MongoDB persistence, and BullMQ enqueueing succeed. Persistence and queue failures trigger best-effort compensation of earlier steps. Compensation failures are logged safely and do not change the sanitized `503 JOB_CREATION_FAILED` response. Use a deterministic BullMQ job ID derived from the MongoDB Job ID.

Authentication is optional.

Responsibilities:

* Accept an authenticated user if a valid token is provided
* Allow guest users to create jobs without logging in
* Receive image
* Validate operation
* Validate operation options
* Save original image
* Create job
* Associate the job with the user when authenticated
* Add job to processing queue
* Return the created job

### Processing History

```text
GET /api/v1/image-processing/jobs
```

Requires authentication.

Returns only jobs belonging to the authenticated user.

This endpoint is the user's Processing History.

Processing History is sorted by `createdAt` and `_id` descending. Pagination defaults to page 1 with 10 jobs and accepts page and limit values from 1 through 50. Responses contain safe job representations and pagination metadata.

Example:

?page=1&limit=10

Do not add:

Advanced filtering
Search
Tags
Folders
Favorites
Analytics

### Get One Job

```text
GET /api/v1/image-processing/jobs/:id
```

A registered user can retrieve jobs belonging to their own account.

Guest jobs must use the job access mechanism implemented by PixSolve so that knowing another job ID alone is not enough to access a private result.

Do not build a full guest account or session system for this.

Guest retrieval requires `X-Guest-Access-Token`. A missing or blank credential returns `401 GUEST_ACCESS_TOKEN_REQUIRED`. Invalid credentials, credentials for another job, malformed IDs, and nonexistent guest jobs use the same concealed `404 JOB_NOT_FOUND` response. Pending and processing responses omit result metadata; completed responses expose only `result.downloadUrl`; failed responses expose only the sanitized processing message as `error.message`.

Account retrieval uses the Bearer access token and returns only jobs owned by that account. If an `Authorization` header is supplied, account authentication takes precedence and an invalid JWT does not fall back to a simultaneously supplied guest credential. Inaccessible account jobs also use the concealed `404 JOB_NOT_FOUND` response.

Input metadata, Cloudinary public IDs, credential hashes, user fields, and queue data are never returned by retrieval or history responses.

## 10. Image Processing

Image processing will use:

```text
Sharp
```

Resize preserves the source aspect ratio using Sharp's `cover` fit with centered cropping. It produces exactly the requested width and height, allows enlargement, and does not expose fit or crop position as V1 options. Width and height must each be integers from 1 through 4096 inclusive.

Compression re-encodes the image without changing its dimensions or format. JPEG and WebP use Sharp's lossy `quality` setting. PNG uses Sharp's palette-based `quality` setting and may reduce color detail. Compression aims to reduce file size but does not guarantee a smaller output.

Conversion supports only JPEG, PNG, and WebP output.

The worker receives a job and performs the requested operation.

Example:

```text
Queue
  ↓
Worker
  ↓
Load input image
  ↓
Process using Sharp
  ↓
Save output image
  ↓
Update job status
```

## 11. Backend Processing

Processing must happen outside the HTTP request lifecycle.

Technology:

```text
Redis
BullMQ
```

Enqueue only the persisted MongoDB Job ID. Each image-processing job receives 3 total attempts with exponential backoff beginning at 1 second. Retain completed BullMQ records for up to 24 hours with a maximum of 100, and failed records for up to 7 days with a maximum of 500. MongoDB remains the authoritative job record.

The V1 worker processes one job at a time. Higher worker concurrency remains a post-V1 optimization.

Responsibilities:

### API process

```text
Receive request
Create job
Push job to queue
Return response
```

### Worker process

```text
Receive queue job
Mark processing
Process image
Save result
Mark completed
```

If processing fails:

```text
status = failed
errorMessage = ...
```

## 12. File Storage

The application must support storing:

* Original image
* Processed image

V1 uses Cloudinary as its only storage provider.

Store original and processed images using Cloudinary's default `upload` delivery type. Generate collision-resistant public IDs under `pixsolve/originals/` and `pixsolve/processed/`, disable overwriting, and retrieve originals internally through the stored HTTPS `secureUrl`.

V1 does not add multiple providers, Cloudinary authenticated delivery, signed download URLs, or an API download proxy.

## 13. Validation

Validation should cover:

* Authentication payloads
* Uploaded files
* Operation type
* Operation options

Examples:

Resize:

```text
width > 0
height > 0
```

Compress:

```text
quality between 1 and 100
```

Convert:

```text
format must be jpeg, png, or webp
```

Use:

```text
Zod
```

## 14. Error Handling

The application should have centralized error handling.

Important errors include:

```text
Invalid credentials

Unauthorized access

Validation failure

Unsupported file type

File too large

Job not found

Job does not belong to user

Image processing failure

Storage upload failure

Queue failure
```

Do not attempt to model every theoretical infrastructure failure.

## 15. Logging

Use:

```text
Pino
```

Important events to log:

```text
Server started

Database connection

Job created

Job processing started

Job completed

Job failed

Unexpected application errors
```

Use `pino-http` with the shared Pino logger for structured HTTP request logging. Include request IDs and the `X-Request-Id` response header, use status-based log levels, exclude sensitive request and response data, and log an unexpected error stack only once. No external monitoring platform is required for V1.

## 16. Database
Use one database only.

V1 uses:

```text
MongoDB + Mongoose
```

Required models:

```text
User
Job
```

Do not create additional collections unless they become absolutely necessary.

## 17. Testing

Minimum required tests:

### Authentication

```text
Signup succeeds
Email verification succeeds
Login succeeds
Invalid login fails
Forgot-password does not reveal account existence
Password reset succeeds and invalidates earlier access tokens
Authenticated password update succeeds and invalidates earlier access tokens
```

### Jobs

```text
Guest user can create a job
Authenticated user can create a job
Authenticated user's job is associated with their account
Authenticated user can retrieve Processing History
User cannot retrieve another user's account job
Guest job access is protected by the chosen guest access mechanism
```

### Validation

```text
Invalid operation is rejected
Invalid options are rejected
Invalid file type is rejected
```

### Worker

At least one successful image processing test.
At least one failed processing test.
100% test coverage is NOT required.

## 18. API Documentation

Use:

```text
Swagger / OpenAPI
```

Document:

* Authentication endpoints
* Job endpoints
* Request fields
* Responses
* Common errors

Keep the V1 OpenAPI 3.0.3 document in the repository. Serve the specification at `/api/v1/openapi.json` and Swagger UI under `/api/v1/docs`. The document must cover every implemented V1 authentication and job operation and use the same safe request, response, and error contracts as the application.

All V1 API endpoints use the `/api/v1` prefix.

## 19. Docker

The finished project should be runnable using Docker.

The local Docker Compose stack contains:

```text
API
Worker
Redis
MongoDB
Frontend
```

The API and worker run as separate containers from the same Node.js application image. The frontend is built with Vite and served by Nginx. MongoDB and Redis use health checks, and MongoDB uses a named volume so local data survives normal container recreation.

Runtime configuration is centralized and validated before startup. `NODE_ENV` accepts `development`, `test`, or `production` and defaults to `production`; `PORT` must be an integer from 1 through 65535. Invalid required configuration must fail startup clearly.

The local frontend is available on port 8080 and calls the API on port 3000. Local authentication links and CORS use the frontend origin.

The production backend Compose stack contains:

* Caddy
* API
* Worker
* Redis

MongoDB Atlas is external to the production Compose stack.

## 20. Deployment

The final project should be deployed publicly.

The approved V1 production topology is:

* Serve the Vite frontend from Vercel at `https://pixsolve.org`.
* Expose the API at `https://api.pixsolve.org` through Caddy.
* Run Caddy, the API, the separate BullMQ worker, and Redis as separate Docker services on one Oracle Cloud Always Free VM.
* Use MongoDB Atlas Free for MongoDB.
* Continue using Cloudinary for image storage and Resend for authentication email.

Set `PUBLIC_APP_URL` and `ALLOWED_ORIGINS` to `https://pixsolve.org`. Set the Vercel build variable `VITE_API_BASE_URL` to `https://api.pixsolve.org/api/v1`. The API and worker share the currently required backend environment contract and JWT secret. Keep all secrets outside Git. Production email uses the verified `pixsolve.org` domain and `contact@pixsolve.org` sender.

This is a single-region, single-VM backend deployment. It does not introduce a serverless backend, Kubernetes, or microservices. File-retention and cleanup policy remains unresolved and must not be silently decided by deployment work.

The repository should contain:

```text
README.md

.env.example

API documentation

Setup instructions

Architecture overview
```

## 21. Frontend

PixSolve will include a frontend so the project can be demonstrated visually and used without relying only on Postman or Swagger.

The frontend is NOT the main engineering focus of this project.

It will be created primarily with AI-assisted development / vibe coding.

The frontend only needs to be clean, usable, and good enough to demonstrate the backend project.

The V1 frontend uses JavaScript, React, Vite, React Router, and authored CSS. It supports guest processing, signup, email verification, login, forgot/reset password, authenticated password update, authenticated processing, Processing History, job status, and result download.

`VITE_API_BASE_URL` configures the API base. The access token and expiry are stored in `localStorage` and synchronized across browser tabs. The active guest Job ID, credential, and access mode are stored in `sessionStorage`. Credentials must not appear in URLs or fetched job/history data.

For account jobs, send `Authorization: Bearer <token>`. For guest jobs, send only `X-Guest-Access-Token`, even if an account token also exists. Logout, expiry, password reset, and successful password update clear account authentication when applicable. Logout does not erase the active guest-job record.

Poll pending and processing jobs every two seconds. Stop on completion, failure, route exit, unmount, or access loss. Retry network failures after 5, 10, and then 20 seconds while showing a non-blocking reconnecting notice.

## 22. Explicitly Out of Scope

The following features MUST NOT be implemented before v1 is complete:

```text
Payments
Subscriptions
Pricing plans
Admin dashboard
Teams
Organizations
Roles and permissions system
Social login
Two-factor authentication
Refresh tokens
Video processing
PDF processing
GIF processing
Batch uploads
Multiple images per job
AI image processing
Image generation
OCR
Image editing UI
User-selectable resize fit modes or crop positions
Image history/versioning
Sharing files with other users
Public file links
Folders
Tags
Search
Advanced filtering
WebSockets
Real-time progress percentages
Microservices
Kafka
RabbitMQ
Kubernetes
Serverless architecture
Multiple databases
Multiple storage providers
Cloudinary authenticated delivery mode
Signed download URLs or an API download proxy
CDN architecture
Custom retry configuration UI
Priority queues
Scheduled jobs
Worker concurrency greater than 1
Automatic selection between lossless and lossy compression
Target output file-size compression
Analytics dashboard
Usage tracking
Billing limits
Infrastructure-level early rejection of oversized upload request bodies
Automatic original or processed file-retention cleanup
```

If an idea is in this list, it is ignored until v1 is finished and deployed.

## 23. Definition of Done

PixSolve v1 is considered finished when:

✓ Guest user can upload one valid image

✓ Guest user can create and complete a processing job

✓ User can sign up

✓ User can verify their email

✓ User can log in

✓ User can request a password-reset link and reset their password

✓ Logged-in user can update their password

✓ Logged-in user's jobs are saved to Processing History

✓ Logged-in user can view their Processing History

✓ User can upload one valid image

✓ User can request resize

✓ User can request compression

✓ User can request format conversion

✓ API creates a job

✓ Job runs asynchronously

✓ Worker processes the image

✓ User can check job status

✓ Completed job contains output image URL

✓ Failed job contains an appropriate error

✓ User cannot access another user's jobs

✓ Guest job access is protected

✓ Basic frontend exists for demonstrating the project

✓ Frontend supports upload, processing status, download, auth, and Processing History

✓ Basic tests pass

✓ Swagger documentation exists

✓ Docker setup works

✓ Application is deployed

✓ README explains the project

Once all items above are complete:

STOP.

Do not add more features before publishing the project.
