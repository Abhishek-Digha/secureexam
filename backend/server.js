const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');

const app = express();
const server = http.createServer(app);

// Enhanced CORS configuration with allowed origins
const corsOptions = {
    // origin: [
    //     'http://localhost:3000',
    //     'http://localhost:8080',
    //     'file://',
    //     'capacitor://localhost',
    //     'ionic://localhost',
    //     'http://localhost',
    //     'http://localhost:8100'
    // ],
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 200
};

// Initialize Socket.io with CORS config attached to the server instance
const io = socketIo(server, { cors: corsOptions });
app.set('io', io); // Make io accessible in routes if needed

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Handle preflight requests for CORS
app.options('*', cors(corsOptions));

// Connect to MongoDB
// mongoose.connect('mongodb://localhost:27017/examportal', {
//     useNewUrlParser: true,
//     useUnifiedTopology: true
// }).then(() => {
//     console.log('MongoDB Connected: localhost');
//     initializeDefaultData();
// }).catch((error) => {
//     console.error('MongoDB connection error:', error);
// });

const uri = 'mongodb+srv://ak47myself_digha_user:sSBmGgZ8MRpg2O6F@secexam.fzrz9uy.mongodb.net/examportal?retryWrites=true&w=majority&appName=secexam';

mongoose.connect(uri)
  .then(() => {
    console.log('MongoDB Connected: Atlas cluster');
    initializeDefaultData(); // if needed
  })
  .catch(error => {
    console.error('MongoDB connection error:', error);
  });
// Initialize default admin
async function initializeDefaultData() {
    try {
        const { Admin } = require('./models/User');
        const adminExists = await Admin.findOne({ username: 'secexamuserdev' });
        if (!adminExists) {
            const defaultAdmin = new Admin({
                username: 'secexamuserdev',
                password: 'sSBmGgZ8MRpg2O6F'
            });
            await defaultAdmin.save();
            console.log('Default admin user created: username=secexamuserdev, password=sSBmGgZ8MRpg2O6F');
        }
    } catch (error) {
        console.error('Error initializing default data:', error);
    }
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        const Question = require('./models/Question');
        const Session = require('./models/Session');
        const { User, Admin } = require('./models/User');

        const stats = {
            questions: await Question.countDocuments(),
            sessions: await Session.countDocuments(),
            users: await User.countDocuments(),
            admins: await Admin.countDocuments(),
            status: 'OK',
            timestamp: new Date().toISOString()
        };

        res.json(stats);
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            message: error.message
        });
    }
});

// ----------------- Socket.IO real-time handlers -----------------
const connectedUsers = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Admin joins admin room (call this from admin clients after connect)
    socket.on('adminJoin', () => {
        socket.join('admin-room');
        console.log(`Admin socket ${socket.id} joined admin-room`);
    });

     socket.on('userTypedLog', (data) => {
    // Broadcast typed logs to admin room
    io.to('admin-room').emit('user_typed_log', data);
    });

    socket.on('joinSession', (data) => {
        socket.join(data.sessionId);
        connectedUsers.set(socket.id, {
            sessionId: data.sessionId,
            user: data.user
        });

        // Notify others in session
        socket.to(data.sessionId).emit('userJoined', data.user);
        console.log('User joined session:', data.user.name);

        // Notify admin room about user join
        io.to('admin-room').emit('user_joined_session', {
            sessionId: data.sessionId,
            userId: data.user.id,
            userName: data.user.name,
            userEmail: data.user.email,
            joinedAt: new Date().toISOString()
        });
    });

    socket.on('videoFrame', (data) => {
        // Broadcast video frame to admin in the same session
        socket.to(data.sessionId).emit('videoFrame', data);
    });

    // Handle exam submission event to terminate the session for that user
    socket.on('submitExam', (sessionId) => {
        // Notify all in session that exam is terminated (user submitted)
        io.to(sessionId).emit('examTerminated');
        console.log(`Exam submitted and session terminated for session: ${sessionId}`);
    });

    // Handle exam time expired event to automatically terminate session
    socket.on('examTimeExpired', (sessionId) => {
        io.to(sessionId).emit('examTerminated');
        console.log(`Exam time expired, session terminated for session: ${sessionId}`);
    });

    // Handle admin manual session termination with broadcast of session_terminated event for user clients
    socket.on('terminateSession', (sessionId) => {
        // Emit examTerminated for any cleanup UI
        io.to(sessionId).emit('examTerminated');

        // Emit session_terminated event for forced client termination as per new feature
        io.to(sessionId).emit('session_terminated', { sessionId });

        console.log(`Session manually terminated: ${sessionId}`);
    });

    socket.on('disconnect', () => {
        const userData = connectedUsers.get(socket.id);
        if (userData) {
            socket.to(userData.sessionId).emit('userDisconnected', userData.user);
            connectedUsers.delete(socket.id);
        }
        console.log('User disconnected:', socket.id);
    });
});

// ----------------- Error handling middleware -----------------
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Server Error' });
});

// ----------------- Start Server -----------------
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`Create test session: http://localhost:${PORT}/api/auth/debug/create-test-session`);
});

// ----------------- Graceful shutdown -----------------
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
    });
});
