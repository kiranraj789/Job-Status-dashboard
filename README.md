# Enterprise Batch Job Monitoring & Dependency Dashboard

A full-stack MERN application for visualizing scheduled batch jobs, monitoring execution status, identifying dependency failures, and providing predictive alerts for critical workflows.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    React Frontend (Client)                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │Dashboard │ │ Jobs List│ │Dependency│ │  Alert Center    │  │
│  │  Page    │ │  Page    │ │  Graph   │ │     Page         │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘  │
│                    Socket.IO Client                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Node.js/Express Backend (Server)              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │   API    │ │Scheduler │ │Predictive│ │   WebSocket      │  │
│  │  Routes  │ │  Engine  │ │  Engine  │ │   Server         │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        MongoDB Database                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                       │
│  │BatchJobs │ │Executions│ │  Alerts  │                       │
│  └──────────┘ └──────────┘ └──────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

## ✨ Features

### Dashboard
- **Real-time Stats**: Total jobs, active/failed counts, success rate, critical alerts
- **Execution Trends**: 24-hour area chart showing success/failure rates
- **Distribution Chart**: Pie chart of execution statuses
- **Predictive Analysis**: Risk scores with confidence levels
- **Active Alerts Panel**: Live alert feed with severity indicators

### Batch Jobs Management
- **Job Grid**: Visual cards with status, priority, category, and stats
- **Advanced Filters**: Filter by status, priority, category
- **Search**: Full-text search across job names
- **Manual Execution**: Trigger jobs on-demand
- **Detailed View**: Execution history, timeline, and performance charts

### Dependency Graph
- **Interactive Canvas**: Visual representation of job dependencies
- **Failure Cascading**: Identify blocked jobs from upstream failures
- **Layered Layout**: BFS-based node positioning
- **Real-time Status**: Color-coded nodes showing current state
- **Click to Inspect**: Select nodes to view details

### Alert Center
- **Multi-type Alerts**: Failure, predictive, dependency, performance
- **Severity Levels**: Critical, error, warning, info
- **Acknowledgment**: Mark alerts as reviewed
- **Filtering**: Filter by severity, type, and active status

### Predictive Analytics
- **Risk Scoring**: Multi-factor risk assessment (0-100)
- **Pattern Detection**: Identify failure trends and anomalies
- **Confidence Levels**: Statistical confidence in predictions
- **Impact Assessment**: Priority-based impact scoring

### Real-time Monitoring
- **WebSocket Updates**: Live execution progress
- **Toast Notifications**: Browser notifications for alerts
- **Auto-refresh**: 30-second dashboard refresh cycle

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- MongoDB 6+ (local or Atlas)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd batch-monitor

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### Configuration

Create `server/.env`:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/batchmonitor
CLIENT_URL=http://localhost:3000
```

### Database Setup

**Option A - In-memory MongoDB (zero setup, recommended for demos):**

The default `npm run dev` script starts an embedded in-memory MongoDB — no local MongoDB install required. If the database is empty, the server automatically seeds it with 15 demo jobs, 300 executions, and 5 alerts, so the dashboard is populated on first launch.

**Option B - Local/Atlas MongoDB:**

```bash
# Start MongoDB (if running locally)
mongod

# Point the server at your database and disable auto-seed
cd server
MONGO_URI=mongodb://localhost:27017/batchmonitor AUTO_SEED=false npm run dev:mongo

# Seed the database with demo data (only needed the first time)
npm run seed
```

### Running the Application

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd client
npm start
```

Open http://localhost:3000 in your browser.

### Tests

The backend ships with a headless integration test that starts the server on an in-memory database, seeds representative data, and exercises every API endpoint:

```bash
cd server
npm test
```

## 📊 API Endpoints

### Dashboard
- `GET /api/dashboard/stats` - Aggregate statistics

### Jobs
- `GET /api/jobs` - List all jobs (query: status, priority, category, search)
- `GET /api/jobs/:id` - Get job details with executions
- `POST /api/jobs` - Create new job
- `PUT /api/jobs/:id` - Update job
- `DELETE /api/jobs/:id` - Delete job

### Executions
- `GET /api/jobs/:id/executions` - Get execution history
- `POST /api/jobs/:id/execute` - Trigger manual execution

### Dependencies
- `GET /api/dependencies/graph` - Get dependency graph data

### Alerts & Predictions
- `GET /api/predictions` - Get predictive analysis
- `GET /api/alerts` - Get alerts (query: active, severity)
- `PUT /api/alerts/:id/acknowledge` - Acknowledge alert

## 🗄️ Data Models

### BatchJob
```javascript
{
  name: String,
  description: String,
  cronExpression: String,
  category: 'ETL' | 'Reporting' | 'Analytics' | 'DataSync' | 'Cleanup' | 'Compliance',
  priority: 'critical' | 'high' | 'medium' | 'low',
  status: 'active' | 'paused' | 'failed' | 'completed',
  dependencies: [{ job: ObjectId, status: 'pending' | 'satisfied' | 'failed' }],
  estimatedDuration: Number,
  consecutiveFailures: Number,
  // ... timestamps
}
```

### Execution
```javascript
{
  job: ObjectId,
  executionId: String,
  status: 'queued' | 'running' | 'success' | 'failed' | 'timeout' | 'cancelled',
  startedAt: Date,
  completedAt: Date,
  duration: Number,
  recordsProcessed: Number,
  progress: Number,
  error: { message, code, stack },
  // ... timestamps
}
```

### Alert
```javascript
{
  type: 'failure' | 'warning' | 'predictive' | 'dependency' | 'performance' | 'critical',
  severity: 'info' | 'warning' | 'error' | 'critical',
  title: String,
  message: String,
  job: ObjectId,
  acknowledged: Boolean,
  metadata: { predictedAt, confidence, impactScore, affectedDownstream },
  // ... timestamps
}
```

## 🔧 Technology Stack

| Layer       | Technology                    |
|-------------|-------------------------------|
| Frontend    | React 18, React Router 6      |
| Charts      | Recharts                      |
| Icons       | Lucide React                  |
| Styling     | CSS (Custom Dark Theme)       |
| Backend     | Node.js, Express              |
| Database    | MongoDB, Mongoose             |
| Real-time   | Socket.IO                     |
| Scheduling  | node-cron                     |

## 📁 Project Structure

```
batch-monitor/
├── server/
│   ├── config/
│   │   └── db.js                 # MongoDB connection
│   ├── controllers/
│   │   └── batchController.js    # API handlers
│   ├── models/
│   │   ├── BatchJob.js           # Job schema
│   │   ├── Execution.js          # Execution schema
│   │   └── Alert.js              # Alert schema
│   ├── routes/
│   │   └── api.js                # API routes
│   ├── seed/
│   │   └── seedData.js           # Demo data seeder
│   ├── utils/
│   │   └── scheduler.js          # Cron scheduler
│   ├── server.js                 # Entry point
│   └── package.json
├── client/
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── context/
│       │   ├── SocketContext.js   # WebSocket provider
│       │   └── JobContext.js      # API context
│       ├── pages/
│       │   ├── Dashboard.js       # Main dashboard
│       │   ├── JobsList.js        # Jobs management
│       │   ├── JobDetail.js       # Job details
│       │   ├── DependencyGraph.js # Visual graph
│       │   └── Alerts.js          # Alert center
│       ├── styles/
│       │   └── App.css           # All styles
│       ├── App.js                 # Root component
│       └── index.js               # Entry point
└── README.md
```

## 🎨 UI Features

- **Dark Theme**: Professional monitoring dashboard aesthetic
- **Responsive Design**: Works on desktop and tablet
- **Real-time Updates**: Live data via WebSocket
- **Interactive Graphs**: Clickable dependency nodes
- **Smooth Animations**: CSS transitions and keyframe animations
- **Toast Notifications**: Non-intrusive alert popups

## 📈 Predictive Analytics Algorithm

The system calculates risk scores based on:

1. **Failure Rate** (0-40 points)
   - >30%: High risk
   - >15%: Medium risk

2. **Duration Anomalies** (0-25 points)
   - Detects execution times >2x average

3. **Consecutive Failures** (15 points each)
   - Tracks repeated failures

4. **Dependency Failures** (20 points each)
   - Upstream failures impacting downstream

Total score determines risk level:
- **High**: 70-100 (Immediate attention)
- **Medium**: 40-69 (Monitor closely)
- **Low**: 1-39 (Routine monitoring)

## 🧪 Demo Data

The seeder creates:
- 15 diverse batch jobs across all categories
- 300 execution records with realistic patterns
- 5 active alerts (failure, dependency, predictive)
- Job dependency chains with cascade failures

## 📜 License

MIT
