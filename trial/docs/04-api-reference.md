# Demo Sync Server REST API Reference

The Demo Sync Server exposes a REST API that lets you manage sync jobs, read job history and configure webhook notifications. All endpoints are versioned under `/api/v2` and return JSON.

## Authentication

Every request must include an API token in the `Authorization` header as `Bearer <token>`. Tokens are created in the admin console and can be scoped to read-only or read-write access. Requests without a valid token are rejected with HTTP 401, and requests with a read-only token to a write endpoint are rejected with HTTP 403.

## Rate limits

Each token is limited to 600 requests per minute. When the limit is exceeded, the server returns 429 Too Many Requests together with a `Retry-After` header that contains the number of seconds the client should wait before it retries the request, and clients that ignore this header and keep retrying immediately may be blocked for up to 15 minutes.

## Endpoints

### List jobs

get `/api/v2/jobs`

Returns the jobs that are visible to the token, newest first.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `status` | string | No | Filter by status: `queued`, `running`, `done` or `failed`. |
| `limit` | integer | No | Max results per page, 1 to 200. Default 50. |
| `cursor` | string | No | Cursor from the previous page's `next_cursor`. |

### Create a job

POST `/api/v2/jobs`

Creates and queues a sync job. The request body must contain `source` and `target`. If `schedule` is omitted, the job runs once.

```json
{
  "source": "/data/reports",
  "target": "bucket://reports-archive",
  "schedule": "every 6h",
  "delete_extraneous": false
}
```

Note that `delete_extraneous` defaults to `false`. Setting it to `true` deletes files in the target that don't exist in the source, and this can't be undone.

The response is `201 Created` with the job object. If a job with the same source and target already exists, the server returns `409 Conflict` and the existing job's ID.

### Cancel a job

DELETE `/api/v2/jobs/{id}`

Cancels a queued or running job. Files that were already transferred are not rolled back. Remove a finished job with `?purge=true` to also delete its history; this is permanent.

## Webhooks

Webhook notification delivery retry backoff configuration is set per endpoint. The server sends a POST request with a JSON body for every job state change. Your endpoint should respond with a 2xx status within 10 seconds; otherwise, the delivery is considered failed and is retried up to 6 times with exponential backoff, starting at 30 seconds. After the 6th failed attempt the webhook is disabled and an email is sent to the admins.

Each delivery is signed with HMAC-SHA256 using the webhook secret. You should always verify the `X-DemoSync-Signature` header before you trust the payload.

## Errors

All errors use the same shape:

```json
{ "error": { "code": "job_not_found", "message": "No job with ID 4521 exists." } }
```

| HTTP status | Code | Meaning |
|---|---|---|
| 400 | `invalid_request` | The body is not valid JSON or a required field is missing. |
| 401 | `unauthorized` | The token is missing, expired or revoked. |
| 404 | `job_not_found` | The job doesn't exist or isn't visible to this token. |
| 409 | `job_exists` | A job with the same source and target exists. |
| 429 | `rate_limited` | Too many requests. See `Retry-After`. |

## Rotate a token

Rotate a token if it was shared by mistake.

1. A new token is created in the admin console.
2. Obtain the new token from the admin console.
3. Check if the new token works.
4. The old token must be revoked within 24 hours.

Tokens are long random strings. Each token belongs to one admin. A token can read or write. The scope is set when the token is created. The console shows the last use of each token. Unused tokens expire after 90 days. Expired tokens cannot be renewed.
