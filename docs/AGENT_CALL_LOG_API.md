# Agent Call Log API Documentation

## Overview
The Agent Call Log API provides endpoints for tracking and retrieving call history between agents and farmers. This system automatically logs all calls when farmers are routed to their assigned agents, enabling agents to review their call history, follow up with farmers, and track engagement.

## Base URL
```
https://your-domain.com/agent
```

---

## Endpoints

### Get Agent Call Logs
Retrieve paginated call logs for a specific agent with optional filtering.

**Endpoint:** `GET /agent/call-logs`

**Authentication:** None (add authentication in production)

---

## Request Parameters

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `phone` | string | Agent's phone number (with or without country code) |

### Optional Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number for pagination |
| `limit` | number | 50 | Number of records per page (max: 100) |
| `startDate` | string | - | Filter calls from this date (ISO 8601 format) |
| `endDate` | string | - | Filter calls until this date (ISO 8601 format) |
| `status` | string | - | Filter by call status: `answered`, `missed`, `completed`, `failed` |

---

## Response Schema

### Success Response (200 OK)

```json
{
  "logs": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "agentPhone": "+2348103393894",
      "agentName": "Dr. Adebayo Ogunleye",
      "farmerPhone": "+2348012345678",
      "farmerName": "Chukwudi Okafor",
      "callDate": "2026-02-15T14:30:00.000Z",
      "callSessionId": "ATVoice_abc123xyz789",
      "callDuration": 180,
      "callStatus": "completed",
      "createdAt": "2026-02-15T14:30:00.000Z",
      "updatedAt": "2026-02-15T14:33:00.000Z"
    }
  ],
  "total": 45,
  "page": 1,
  "totalPages": 3
}
```

### Error Response (400 Bad Request)

```json
{
  "error": "Agent phone number is required"
}
```

### Error Response (500 Internal Server Error)

```json
{
  "error": "Failed to fetch call logs",
  "details": "Error message details"
}
```

---

## Response Fields

### Log Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `_id` | string | Unique MongoDB document ID |
| `agentPhone` | string | Agent's phone number |
| `agentName` | string | Agent's full name |
| `farmerPhone` | string | Farmer's phone number |
| `farmerName` | string | Farmer's full name |
| `callDate` | string | ISO 8601 timestamp when call was initiated |
| `callSessionId` | string | Africa's Talking session ID for the call |
| `callDuration` | number | Call duration in seconds (null if call not completed) |
| `callStatus` | string | Current status: `answered`, `missed`, `completed`, `failed` |
| `createdAt` | string | ISO 8601 timestamp when log was created |
| `updatedAt` | string | ISO 8601 timestamp when log was last updated |

### Pagination Fields

| Field | Type | Description |
|-------|------|-------------|
| `logs` | array | Array of call log objects |
| `total` | number | Total number of logs matching the query |
| `page` | number | Current page number |
| `totalPages` | number | Total number of pages available |

---

## Call Status Values

| Status | Description |
|--------|-------------|
| `answered` | Agent answered the call (initial state) |
| `missed` | Agent did not answer the call |
| `completed` | Call completed successfully |
| `failed` | Call failed due to technical issues |

---

## Example Requests

### Basic Request
Get first page of all call logs for an agent:
```bash
curl "https://your-domain.com/agent/call-logs?phone=+2348103393894"
```

### Paginated Request
Get second page with 20 records per page:
```bash
curl "https://your-domain.com/agent/call-logs?phone=+2348103393894&page=2&limit=20"
```

### Date Range Filter
Get calls from February 2026:
```bash
curl "https://your-domain.com/agent/call-logs?phone=+2348103393894&startDate=2026-02-01T00:00:00Z&endDate=2026-02-28T23:59:59Z"
```

### Status Filter
Get only completed calls:
```bash
curl "https://your-domain.com/agent/call-logs?phone=+2348103393894&status=completed"
```

### Combined Filters
Get completed calls from last week, page 1, 10 per page:
```bash
curl "https://your-domain.com/agent/call-logs?phone=+2348103393894&status=completed&startDate=2026-02-08T00:00:00Z&endDate=2026-02-15T23:59:59Z&page=1&limit=10"
```

---

## Example Responses

### Successful Response with Data
```json
{
  "logs": [
    {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
      "agentPhone": "+2348103393894",
      "agentName": "Dr. Adebayo Ogunleye",
      "farmerPhone": "+2348012345678",
      "farmerName": "Chukwudi Okafor",
      "callDate": "2026-02-15T14:30:00.000Z",
      "callSessionId": "ATVoice_abc123xyz789",
      "callDuration": 180,
      "callStatus": "completed",
      "createdAt": "2026-02-15T14:30:00.000Z",
      "updatedAt": "2026-02-15T14:33:00.000Z"
    },
    {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k2",
      "agentPhone": "+2348103393894",
      "agentName": "Dr. Adebayo Ogunleye",
      "farmerPhone": "+2348098765432",
      "farmerName": "Amina Bello",
      "callDate": "2026-02-15T10:15:00.000Z",
      "callSessionId": "ATVoice_def456uvw012",
      "callDuration": 240,
      "callStatus": "completed",
      "createdAt": "2026-02-15T10:15:00.000Z",
      "updatedAt": "2026-02-15T10:19:00.000Z"
    }
  ],
  "total": 45,
  "page": 1,
  "totalPages": 3
}
```

### Empty Response (No Logs Found)
```json
{
  "logs": [],
  "total": 0,
  "page": 1,
  "totalPages": 0
}
```

---

## Use Cases

### 1. Agent Dashboard
Display recent calls for an agent:
```javascript
fetch('/agent/call-logs?phone=+2348103393894&limit=10')
  .then(res => res.json())
  .then(data => {
    console.log(`Showing ${data.logs.length} of ${data.total} calls`);
    data.logs.forEach(log => {
      console.log(`${log.farmerName}: ${log.callStatus} - ${log.callDuration}s`);
    });
  });
```

### 2. Daily Report
Get all completed calls for today:
```javascript
const today = new Date().toISOString().split('T')[0];
fetch(`/agent/call-logs?phone=+2348103393894&status=completed&startDate=${today}T00:00:00Z&endDate=${today}T23:59:59Z`)
  .then(res => res.json())
  .then(data => {
    console.log(`Completed ${data.total} calls today`);
  });
```

### 3. Follow-up List
Get missed calls that need follow-up:
```javascript
fetch('/agent/call-logs?phone=+2348103393894&status=missed')
  .then(res => res.json())
  .then(data => {
    console.log(`${data.total} missed calls to follow up`);
    data.logs.forEach(log => {
      console.log(`Call back: ${log.farmerName} (${log.farmerPhone})`);
    });
  });
```

---

## Implementation Notes

### Automatic Logging
Call logs are automatically created when:
1. A farmer calls the IVR system
2. System detects an agent-farmer mapping
3. Call is routed to the assigned agent
4. Log entry is created with status `answered`

### Status Updates
Call status is updated automatically:
- `answered` → `completed`: When call ends successfully
- `answered` → `missed`: When agent doesn't pick up
- `answered` → `failed`: When technical error occurs

### Performance
- Logs are indexed by `agentPhone` and `callDate` for fast queries
- Default limit of 50 records prevents large response payloads
- Maximum limit of 100 records per request

### Data Retention
- Call logs are stored indefinitely by default
- Implement data retention policy as needed
- Consider archiving old logs after 12 months

---

## Security Recommendations

### Production Deployment
1. **Add Authentication**: Require API key or JWT token
2. **Rate Limiting**: Prevent abuse with rate limits
3. **Phone Validation**: Verify agent phone ownership
4. **HTTPS Only**: Enforce secure connections
5. **Input Sanitization**: Validate all query parameters

### Example with Authentication
```javascript
fetch('/agent/call-logs?phone=+2348103393894', {
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json'
  }
})
```

---

## Error Handling

### Common Errors

| Status Code | Error | Solution |
|-------------|-------|----------|
| 400 | Missing phone parameter | Include `phone` in query string |
| 400 | Invalid date format | Use ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ) |
| 400 | Invalid status value | Use: answered, missed, completed, or failed |
| 500 | Database connection error | Check MongoDB connection |
| 500 | Query execution error | Check server logs for details |

---

## Testing

### Test with cURL
```bash
# Test basic request
curl -X GET "http://localhost:3000/agent/call-logs?phone=+2348103393894"

# Test with all parameters
curl -X GET "http://localhost:3000/agent/call-logs?phone=+2348103393894&page=1&limit=20&startDate=2026-02-01T00:00:00Z&endDate=2026-02-28T23:59:59Z&status=completed"

# Test error handling (missing phone)
curl -X GET "http://localhost:3000/agent/call-logs"
```

### Test with Postman
1. Create GET request to `/agent/call-logs`
2. Add query parameters in Params tab
3. Send request and verify response schema
4. Test pagination by changing `page` parameter
5. Test filters with different date ranges and statuses

---

## Related Documentation
- [Agent-Farmer Mapping System](./AGENT_FARMER_MAPPING.md)
- [IVR Call Flow](./CALL_FLOW.md)
- [Africa's Talking Voice API](https://developers.africastalking.com/docs/voice/overview)

---

## Support
For technical issues or questions:
- Create GitHub issue
- Contact development team
- Check server logs: `logs/combined.log`

---

**Version:** 1.0.0  
**Last Updated:** February 2026  
**Maintained by:** Agrocist Development Team
