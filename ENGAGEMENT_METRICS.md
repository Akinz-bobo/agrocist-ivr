# 📊 Engagement Metrics System

The Agrocist IVR now includes a comprehensive engagement metrics system that tracks user interactions, call patterns, and system performance to help you understand user behavior and optimize the IVR experience.

## 🎯 What Gets Tracked

### Call Session Information
- **Session ID**: Unique identifier for each call
- **Phone Number**: Caller's phone number
- **Call Duration**: Total time spent on the call
- **Start/End Times**: When the call began and ended
- **Language Selection**: Which language the user chose (EN, YO, HA, IG)

### User Journey Tracking
- **State Transitions**: Movement through IVR states:
  - `call-initiated` → `welcome` → `language-selection` → `recording-prompt` → `recording-in-progress` → `ai-processing` → `ai-response` → `post-ai-menu` → etc.
- **Duration in Each State**: How long users spend in each part of the IVR
- **User Inputs**: DTMF choices and voice recordings
- **Exit Points**: Where users hang up or end calls

### AI Interaction Metrics
- **Recording Duration**: Length of user voice recordings
- **Transcription Quality**: User queries transcribed from audio
- **AI Processing Time**: How long AI takes to generate responses
- **TTS Generation Time**: Time to create audio responses
- **AI Confidence Scores**: How confident the AI is in its responses
- **Number of Interactions**: Total AI conversations per call

### Termination Analysis
- **Termination Reasons**:
  - `user-hangup`: User ended call normally
  - `timeout`: Call ended due to inactivity
  - `system-error`: Technical issues caused termination
  - `completed-successfully`: User completed their journey
  - `transferred-to-agent`: Escalated to human support
  - `network-issue`: Connection problems
- **Completion Success**: Whether users achieved their goals

### Engagement Scoring (0-100)
Automatically calculated based on:
- **Language Selection** (10 points): Did user choose a language?
- **Call Completion** (20 points): Did user progress past welcome?
- **AI Interactions** (30 points): Number of meaningful conversations
- **Recording Engagement** (20 points): Time spent providing voice input
- **Successful Completion** (20 points): Achieved their goal
- **Error Deductions** (-2 points per error): Technical issues encountered

## 🚀 Getting Started

### 1. Environment Setup
Add these variables to your `.env` file:

```bash
# MongoDB Connection (required for metrics)
MONGODB_URI=mongodb://localhost:27017/agrocist-ivr

# Optional: Enable detailed tracking
LOG_LEVEL=info
```

### 2. Start MongoDB
Ensure MongoDB is running locally:
```bash
# Using Homebrew on Mac
brew services start mongodb-community

# Or using Docker
docker run --name mongodb -p 27017:27017 -d mongo:latest
```

### 3. View Analytics Dashboard
Once your server is running, visit:
```
http://localhost:3000/dashboard/dashboard.html
```

## 📈 Analytics Endpoints

### Dashboard Overview
```http
GET /analytics/dashboard
```
Returns comprehensive dashboard data including today's metrics, active sessions, and engagement patterns.

### Engagement Analytics
```http
GET /analytics/overview?startDate=2024-01-01&endDate=2024-01-31
```
Get detailed analytics for a specific date range.

### Recent Sessions
```http
GET /analytics/sessions?page=1&limit=50&phoneNumber=+234XXXXXXXXX
```
Retrieve recent call sessions with pagination and optional phone number filter.

### Engagement Patterns
```http
GET /analytics/patterns
```
Analyze user behavior patterns including:
- Most common exit points
- Language preferences
- Termination reasons
- State distribution

### Active Sessions
```http
GET /analytics/active
```
See currently active calls and their states.

### Session Details
```http
GET /analytics/sessions/{sessionId}
```
Get detailed information about a specific call session.

### Export Data
```http
GET /analytics/export?format=csv&startDate=2024-01-01
```
Export analytics data as JSON or CSV format.

## 🔍 Understanding the Data

### Engagement Score Interpretation
- **80-100**: Highly engaged users who completed their journey
- **60-79**: Good engagement, some interaction with AI
- **40-59**: Moderate engagement, may have faced issues
- **20-39**: Low engagement, likely encountered problems
- **0-19**: Very poor experience, immediate dropoff

### Common Usage Patterns
1. **Language Selection Dropoff**: Users hang up during language selection
2. **Recording Hesitation**: Long pauses before speaking
3. **AI Response Satisfaction**: Whether users ask follow-up questions
4. **Agent Transfer Requests**: When users prefer human help

### Key Performance Indicators (KPIs)
- **Call Completion Rate**: % of calls that reach AI interaction
- **Average Engagement Score**: Overall user satisfaction
- **AI Interaction Rate**: % of users who speak with AI
- **Language Distribution**: Popular language choices
- **Peak Usage Times**: When your IVR is most active

## 🛠️ Advanced Usage

### Custom Analytics Queries
The system stores data in MongoDB, so you can create custom queries:

```javascript
// Find users who had multiple AI interactions
db.engagement_metrics.find({
  totalAIInteractions: { $gte: 2 },
  engagementScore: { $gte: 70 }
});

// Analyze dropoff patterns
db.engagement_metrics.aggregate([
  { $group: { 
    _id: "$finalState", 
    count: { $sum: 1 },
    avgDuration: { $avg: "$totalDuration" }
  }}
]);
```

### Integration with External Systems
You can push this data to analytics platforms:

```javascript
// Example: Send daily reports to Slack/email
const dailyMetrics = await fetch('/analytics/overview');
// Process and send to your preferred platform
```

### Data Retention and Cleanup
The system includes automatic cleanup:

```http
DELETE /analytics/cleanup
Content-Type: application/json

{
  "olderThanDays": 90
}
```

## 🔧 Troubleshooting

### Common Issues

**"Failed to connect to MongoDB"**
- Ensure MongoDB is running
- Check `MONGODB_URI` in your `.env` file
- Verify network connectivity

**"No data showing in dashboard"**
- Make sure you've had some test calls
- Check browser console for JavaScript errors
- Verify analytics endpoints are responding

**"Engagement tracking not working"**
- Check server logs for engagement service errors
- Ensure database connection is healthy
- Verify the engagement service is properly initialized

### Debug Commands
```bash
# Check database connection
curl http://localhost:3000/analytics/health

# View recent sessions
curl http://localhost:3000/analytics/sessions

# Check active tracking
curl http://localhost:3000/analytics/active
```

## 🚧 Automatic Pattern Detection

The system automatically identifies:

- **High-dropoff states**: Where users commonly hang up
- **Successful user journeys**: Paths that lead to completion
- **Language preferences**: Most popular language choices
- **Peak usage patterns**: Busy times and days
- **Error hotspots**: Common technical issues

This data helps you optimize:
- Voice prompts and clarity
- AI response quality
- System performance
- User experience flow

## 📊 Dashboard Features

The included web dashboard provides:

- **Real-time active session monitoring**
- **Daily/weekly/monthly engagement trends**
- **Language usage distribution**
- **Call completion funnels**
- **Error rate tracking**
- **Engagement score histograms**
- **Export capabilities for further analysis**

Access it at: `http://localhost:3000/dashboard/dashboard.html`

---

This engagement metrics system provides deep insights into how users interact with your livestock farming IVR, helping you continuously improve the experience and better serve your agricultural community! 🌾📞