const express = require("express");
const http = require("http");
const cors = require("cors");
const socketIo = require("socket.io");
require("dotenv").config();
const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");
const chatController = require("./controllers/chatController");
const db = require("./config/db");
const path = require("path");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const passport = require("passport");
const app = express();
const { findUserById } = require("./models/userModel");
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});
app.use(cookieParser());
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  })
);

app.use(
  session({
    secret: "your_secret_key",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());

app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);
// app.use("/uploads", express.static(path.join(__dirname, "..", uploads)));
const MicrosoftStrategy = require("passport-microsoft").Strategy;

passport.use(
  new MicrosoftStrategy(
    {
      clientID: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      callbackURL: process.env.MICROSOFT_CALLBACK_URL,
      scope: ["user.read"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const name = profile.displayName;
        const profileImage = profile.photoURL;
        const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [
          email,
        ]);
        let user;

        if (rows.length > 0) {
          user = rows[0];
        } else {
          const [result] = await db.query(
            "INSERT INTO users (name, email,password, profile_image) VALUES (?, ?, ?, ?)",
            [name, email, "Signin with microsoft", profileImage]
          );
          user = { id: result.insertId, name, email };
        }

        done(null, user);
      } catch (error) {
        done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  const user = await findUserById(id);
  done(null, user);
});

const onlineUsers = new Map();
const userSocketMap = new Map();
const activeCalls = new Map();

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // Join room for private messaging
  socket.on("join_room", (room) => {
    console.log("joined room");
    socket.join(room);
  });

  // Leave room
  socket.on("leave_room", (room) => {
    socket.leave(room);
  });

  // User goes online
  socket.on("user_online", (userId) => {
    if (!userId) return;

    userSocketMap.set(socket.id, userId);
    const sockets = onlineUsers.get(userId) || new Set();
    sockets.add(socket.id);
    onlineUsers.set(userId, sockets);

    const onlineUserIds = Array.from(onlineUsers.keys());
    io.emit("online_users", onlineUserIds);
    socket.broadcast.emit("user_online", userId);
  });

  // Handle sending messages
  socket.on("send_message", async (data, callback) => {
    try {
      const savedMessage = await chatController.saveMessageForSocket(data);

      // Find receiver's sockets
      const receiverSockets = onlineUsers.get(Number(data.receiverId));
      if (receiverSockets && receiverSockets.size > 0) {
        await db.query(
          "UPDATE messages SET status = 'delivered' WHERE id = ?",
          [savedMessage.id]
        );
        savedMessage.status = "delivered";

        for (const rSockId of receiverSockets) {
          io.to(rSockId).emit("receive_message", savedMessage);
        }
      }

      callback(savedMessage);
    } catch (err) {
      console.error("Error in send_message:", err);
      callback({ error: "Failed to send message" });
    }
  });
  
  socket.on("message_delivered", async ({ messageId, room }) => {
    try {
      await db.query("UPDATE messages SET status = 'delivered' WHERE id = ?", [
        messageId,
      ]);
      io.to(room).emit("message_delivered", messageId);
    } catch (err) {
      console.error("Delivered update failed:", err);
    }
  });

  // Message read
  socket.on("message_read", async ({ messageId, room }) => {
    try {
      await db.query("UPDATE messages SET status = 'read' WHERE id = ?", [
        messageId,
      ]);
      io.to(room).emit("message_read", messageId);
    } catch (err) {
      console.error("Read update failed:", err);
    }
  });

  socket.on("callUser", ({ targetUserId, from, callerId, callType }) => {
    const receiverSockets = onlineUsers.get(targetUserId);

    if (receiverSockets && receiverSockets.size > 0) {
   
      const callId = `${callerId}_${targetUserId}_${Date.now()}`;
      activeCalls.set(callId, {
        callerId,
        targetUserId,
        callType,
        status: "ringing",
        startTime: Date.now(),
      });

      for (const rSockId of receiverSockets) {
        io.to(rSockId).emit("incomingCall", {
          from,
          callerId,
          callType,
          callId,
        });
      }

      socket.emit("callInitiated", { callId });

      console.log(
        `Incoming call sent to user ${targetUserId}, callId: ${callId}`
      );
    } else {
      socket.emit("callRejected", { reason: "User is offline" });
      console.log(`Call failed: User ${targetUserId} is offline`);
    }
  });

  // Handle call acceptance
  socket.on("acceptCall", ({ callId, callerId }) => {
    const userId = userSocketMap.get(socket.id);
    console.log(
      `Call accepted by ${userId} for caller ${callerId}, callId: ${callId}`
    );

    // Update call status
    const call = activeCalls.get(callId);
    if (call) {
      call.status = "active";
      call.answererId = userId;
      activeCalls.set(callId, call);
    }

    // Find caller's sockets
    const callerSockets = onlineUsers.get(callerId);
    if (callerSockets && callerSockets.size > 0) {
      for (const callerSocketId of callerSockets) {
        io.to(callerSocketId).emit("callAccepted", {
          answerFrom: userId,
          callId,
        });
      }
    }
  });

  // Handle call rejection
  socket.on("rejectCall", ({ callId, callerId }) => {
    const userId = userSocketMap.get(socket.id);
    console.log(`Call rejected by ${userId}, callId: ${callId}`);

    // Remove call from active calls
    activeCalls.delete(callId);

    // Notify caller
    const callerSockets = onlineUsers.get(callerId);
    if (callerSockets && callerSockets.size > 0) {
      for (const callerSocketId of callerSockets) {
        io.to(callerSocketId).emit("callRejected", {
          reason: "Call rejected",
          callId,
        });
      }
    }
  });

  // Handle call cancellation (caller cancels before answer)
  socket.on("cancelCall", ({ callId, targetUserId }) => {
    console.log(`Call canceled to ${targetUserId}, callId: ${callId}`);

    // Remove call from active calls
    activeCalls.delete(callId);

    // Notify target user
    const targetSockets = onlineUsers.get(targetUserId);
    if (targetSockets && targetSockets.size > 0) {
      for (const targetSocketId of targetSockets) {
        io.to(targetSocketId).emit("callCanceled", { callId });
      }
    }
  });

  // Handle call end
  socket.on("endCall", ({ callId, targetUserId }) => {
    console.log(`Call ended with ${targetUserId}, callId: ${callId}`);

    // Remove call from active calls
    const call = activeCalls.get(callId);
    if (call) {
      const duration = Date.now() - call.startTime;
      console.log(`Call duration: ${Math.round(duration / 1000)} seconds`);
      activeCalls.delete(callId);
    }

    // Notify target user
    const targetSockets = onlineUsers.get(targetUserId);
    if (targetSockets && targetSockets.size > 0) {
      for (const targetSocketId of targetSockets) {
        io.to(targetSocketId).emit("callEnded", { callId });
      }
    }
  });

  // WebRTC signaling events
  socket.on("webrtcOffer", ({ target, sdp, callId }) => {
    console.log("WebRTC offer received, forwarding to:", target);

    const targetSockets = onlineUsers.get(target);
    if (targetSockets && targetSockets.size > 0) {
      for (const targetSocketId of targetSockets) {
        io.to(targetSocketId).emit("webrtcOffer", {
          sdp,
          from: userSocketMap.get(socket.id),
          callId,
        });
      }
    }
  });

  socket.on("webrtcAnswer", ({ target, sdp, callId }) => {
    console.log("WebRTC answer received, forwarding to:", target);

    const targetSockets = onlineUsers.get(target);
    if (targetSockets && targetSockets.size > 0) {
      for (const targetSocketId of targetSockets) {
        io.to(targetSocketId).emit("webrtcAnswer", {
          sdp,
          from: userSocketMap.get(socket.id),
          callId,
        });
      }
    }
  });

  socket.on("iceCandidate", ({ target, candidate, callId }) => {
    const targetSockets = onlineUsers.get(target);
    if (targetSockets && targetSockets.size > 0) {
      for (const targetSocketId of targetSockets) {
        io.to(targetSocketId).emit("iceCandidate", {
          candidate,
          from: userSocketMap.get(socket.id),
          callId,
        });
      }
    }
  });
  socket.on("disconnect", () => {
    const userId = userSocketMap.get(socket.id);
    console.log("Socket disconnected:", socket.id, "User:", userId);
    if (userId) {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          socket.broadcast.emit("user_offline", userId);
          console.log("User went offline:", userId);
        } else {
          onlineUsers.set(userId, sockets);
        }
      }
      userSocketMap.delete(socket.id);
    }
    const onlineUserIds = Array.from(onlineUsers.keys());
    io.emit("online_users", onlineUserIds);

    console.log("Current online users:", onlineUserIds);
  });
});

app.use(express.static(path.join(__dirname, "../websocket/dist")));

app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "../websocket/dist", "index.html"));
});

app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 2000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { io, onlineUsers, userSocketMap };
