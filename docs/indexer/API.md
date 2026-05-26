# Indexer API Contract

## Search Endpoint

### POST /api/search/posts

Search posts by keyword content.

#### Request

```json
{
  "query": "string",
  "limit": 20,
  "offset": 0
}
```

**Parameters:**
- `query` (required): Search keywords to match against post content
- `limit` (optional): Maximum number of results to return (default: 20, max: 100)
- `offset` (optional): Number of results to skip for pagination (default: 0)

#### Response

```json
{
  "posts": [
    {
      "id": "u64",
      "author": "string",
      "content": "string",
      "tip_total": "string",
      "timestamp": "u64"
    }
  ],
  "total": "number",
  "has_more": "boolean"
}
```

**Response Fields:**
- `posts`: Array of matching posts
- `total`: Total number of matching posts
- `has_more`: Whether there are more results available

#### Error Response

```json
{
  "error": "string",
  "code": "string"
}
```

**Error Codes:**
- `INVALID_QUERY`: Query parameter is missing or invalid
- `LIMIT_EXCEEDED`: Limit parameter exceeds maximum allowed value
- `INTERNAL_ERROR`: Server error occurred during search

---

## Rate Limiting

All `/api` endpoints are subject to IP-based rate limiting.

### Default Limits

| Parameter | Default | Environment variable |
|-----------|---------|----------------------|
| Window | 60 seconds | `RATE_LIMIT_WINDOW_MS` |
| Max requests per window | 100 | `RATE_LIMIT_MAX` |

### Rate Limit Response

When the limit is exceeded the server returns **HTTP 429 Too Many Requests** with a `Retry-After` header indicating how many seconds to wait before retrying.

```
HTTP/1.1 429 Too Many Requests
Retry-After: 60
Content-Type: application/json
```

```json
{
  "error": "Too many requests. Please retry after the indicated delay.",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfterSeconds": 60
}
```

### Standard Rate-Limit Headers

Responses also include `RateLimit-*` headers (RFC 9110 draft-7) on every request:

| Header | Description |
|--------|-------------|
| `RateLimit-Limit` | Maximum requests allowed per window |
| `RateLimit-Remaining` | Requests remaining in the current window |
| `RateLimit-Reset` | Unix timestamp when the current window resets |

### Configuration

Override defaults via environment variables before starting the indexer service:

```bash
# Allow 200 requests per 2-minute window
RATE_LIMIT_MAX=200 RATE_LIMIT_WINDOW_MS=120000 node dist/index.js
```

Rate limiting is applied per originating IP address. When the service runs behind a reverse proxy, set `trust proxy` in the Express configuration and ensure only your load-balancer can set the `X-Forwarded-For` header.
