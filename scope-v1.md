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
* Log in.
* Perform all normal image processing operations.
* View their previous processing jobs through Processing History.
* View a specific job from their history.
* Download the processed result again while the file is still available.

A registered user cannot access another user's processing history or jobs.

The only account-specific feature in v1 is: Processing History

## 5. Authentication

Authentication is optional for using PixSolve.

Its purpose in v1 is only to enable: Processing History

Authentication uses:

* Email
* Password
* JWT access token
* Refresh tokens
* Forgot password
* Reset password
* Email verification

Required endpoints:

```text
POST /api/auth/signup
POST /api/auth/login
```

Not included:

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
5 MB
```

The API must reject:

* Files larger than 5 MB
* Unsupported file types
* Missing files

No batch uploads.

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
POST /api/jobs
```

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
GET /api/jobs
```

Requires authentication.

Returns only jobs belonging to the authenticated user.

This endpoint is the user's Processing History.

Simple pagination is allowed.

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
GET /api/jobs/:id
```

A registered user can retrieve jobs belonging to their own account.

Guest jobs must use the job access mechanism implemented by PixSolve so that knowing another job ID alone is not enough to access a private result.

Do not build a full guest account or session system for this.

## 10. Image Processing

Image processing will use:

```text
Sharp
```

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

The exact storage provider can be chosen during implementation.

For v1, use one provider only.

Examples:

```text
Cloudinary
```

or:

```text
AWS S3
```

Do not implement multiple storage providers.

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

## 16. Database
Use one database only.

Recommended:

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
Login succeeds
Invalid login fails
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

## 19. Docker

The finished project should be runnable using Docker.

Expected services:

```text
API
Worker
Redis
```

MongoDB may either be:

```text
Docker container
```

or:

```text
MongoDB Atlas
```

## 20. Deployment

The final project should be deployed publicly.

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
Video processing
PDF processing
GIF processing
Batch uploads
Multiple images per job
AI image processing
Image generation
OCR
Image editing UI
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
CDN architecture
Custom retry configuration UI
Priority queues
Scheduled jobs
Analytics dashboard
Usage tracking
Billing limits
```

If an idea is in this list, it is ignored until v1 is finished and deployed.

## 23. Definition of Done

PixSolve v1 is considered finished when:

✓ Guest user can upload one valid image

✓ Guest user can create and complete a processing job

✓ User can sign up

✓ User can log in

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