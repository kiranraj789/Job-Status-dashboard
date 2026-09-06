const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const { connectDB, disconnectDB } = require('./config/db');
const BatchJob = require('./models/BatchJob');
const { seedDatabase } = require('./seed/seedDatabase');
const apiRoutes = require('./routes/api');
const { EVENTS, ROOM_ALL, jobRoom } = require('./socketEvents');
const { initScheduler } = require('./utils/scheduler');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:3000', methods: ['GET', 'POST'] }
});

// Middleware
app.use(cors());
app.use(express.json());

// Make io accessible to routes
app.set('io', io);

// API Routes
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.IO for real-time updates
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on(EVENTS.SUBSCRIBE_JOB, (jobId) => {
    socket.join(jobRoom(jobId));
  });

  socket.on(EVENTS.SUBSCRIBE_ALL, () => {
    socket.join(ROOM_ALL);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to database first
    await connectDB();

    // Seed demo data automatically when the database is empty so the
    // app is usable out-of-the-box (disable with AUTO_SEED=false)
    if (process.env.AUTO_SEED !== 'false') {
      const jobCount = await BatchJob.countDocuments();
      if (jobCount === 0) {
        console.log('Empty database detected — seeding demo data...');
        await seedDatabase();
      }
    }

    // Initialize scheduler for simulated execution
    initScheduler(io);
    
    // Start server. PORT=0 asks the OS for a free ephemeral port, so log the
    // port actually bound (test harness parses this line to reach the server).
    server.listen(PORT, () => {
      const boundPort = server.address() && server.address().port;
      console.log(`Server running on port ${boundPort || PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  server.close(async () => {
    await disconnectDB();
    process.exit(0);
  });
});

startServer();

module.exports = { app, server, io };
