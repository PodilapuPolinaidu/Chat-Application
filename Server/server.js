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

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  })
);

app.use(express.json());

app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Store online users and their socket connections
const onlineUsers = new Map(); // userId -> Set of socketIds
const userSocketMap = new Map(); // socketId -> userId

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // Join room for private messaging
  socket.on("join_room", (room) => {
    socket.join(room);
    console.log(`User ${socket.id} joined room: ${room}`);
  });

  // Leave room
  socket.on("leave_room", (room) => {
    socket.leave(room);
    console.log(`User ${socket.id} left room: ${room}`);
  });

  // User goes online
  socket.on("user_online", (userId) => {
    if (!userId) return;

    // Store user-socket mapping
    userSocketMap.set(socket.id, userId);

    // Add socket to user's socket set
    const sockets = onlineUsers.get(userId) || new Set();
    sockets.add(socket.id);
    onlineUsers.set(userId, sockets);

    // Broadcast online users list
    const onlineUserIds = Array.from(onlineUsers.keys());
    io.emit("online_users", onlineUserIds);
    socket.broadcast.emit("user_online", userId);

    console.log("User came online:", userId, "current online:", onlineUserIds);
  });

  // Handle sending messages
  socket.on("send_message", async (data, callback) => {
    try {
      const savedMessage = await chatController.saveMessageForSocket(data);

      // Find receiver's sockets
      const receiverSockets =
        onlineUsers.get(String(data.receiverId)) ||
        onlineUsers.get(Number(data.receiverId));

      if (receiverSockets && receiverSockets.size > 0) {
        // Update message status to delivered
        await db.query(
          "UPDATE messages SET status = 'delivered' WHERE id = ?",
          [savedMessage.id]
        );
        savedMessage.status = "delivered";

        // Send to all receiver's sockets
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

  // Message delivered
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

  // CALL FUNCTIONALITY

  // Initiate call to user
  socket.on("callUser", ({ targetUserId, from, callerId, callType }) => {
    console.log(
      `Call initiated from ${from} (${callerId}) to ${targetUserId}, type: ${callType}`
    );

    const receiverSockets = onlineUsers.get(targetUserId);

    if (receiverSockets && receiverSockets.size > 0) {
      // Send incoming call notification to all receiver's sockets
      for (const rSockId of receiverSockets) {
        io.to(rSockId).emit("incomingCall", {
          from,
          callerId: callerId, // Use the actual caller user ID, not socket ID
          callType,
        });
      }
      console.log(`Incoming call sent to user ${targetUserId}`);
    } else {
      // Notify caller that target is offline
      socket.emit("callRejected");
      console.log(`Call failed: User ${targetUserId} is offline`);
    }
  });

  // Accept incoming call
  socket.on("acceptCall", ({ callerId }) => {
    const userId = userSocketMap.get(socket.id);
    console.log(`Call accepted by ${userId} for caller ${callerId}`);

    // Find caller's sockets
    const callerSockets = onlineUsers.get(callerId);
    if (callerSockets && callerSockets.size > 0) {
      for (const callerSocketId of callerSockets) {
        io.to(callerSocketId).emit("callAccepted", {
          answerFrom: userId, // Send the user ID who accepted
        });
      }
    }
  });

  // Reject incoming call
  socket.on("rejectCall", ({ callerId }) => {
    const userId = userSocketMap.get(socket.id);
    console.log(`Call rejected by ${userId}`);

    // Notify caller
    const callerSockets = onlineUsers.get(callerId);
    if (callerSockets && callerSockets.size > 0) {
      for (const callerSocketId of callerSockets) {
        io.to(callerSocketId).emit("callRejected");
      }
    }
  });

  // Cancel outgoing call
  socket.on("cancelCall", ({ targetUserId }) => {
    console.log(`Call canceled to ${targetUserId}`);

    // Notify target user
    const targetSockets = onlineUsers.get(targetUserId);
    if (targetSockets && targetSockets.size > 0) {
      for (const targetSocketId of targetSockets) {
        io.to(targetSocketId).emit("callCanceled");
      }
    }
  });

  // End active call
  socket.on("endCall", ({ targetUserId }) => {
    console.log(`Call ended with ${targetUserId}`);

    // Notify target user
    const targetSockets = onlineUsers.get(targetUserId);
    if (targetSockets && targetSockets.size > 0) {
      for (const targetSocketId of targetSockets) {
        io.to(targetSocketId).emit("callEnded");
      }
    }
  });

  // WebRTC Signaling

  // Handle WebRTC offer
  socket.on("webrtcOffer", ({ target, sdp }) => {
    console.log("WebRTC offer received, forwarding to:", target);

    const targetSockets = onlineUsers.get(target);
    if (targetSockets && targetSockets.size > 0) {
      for (const targetSocketId of targetSockets) {
        io.to(targetSocketId).emit("webrtcOffer", {
          sdp,
          from: userSocketMap.get(socket.id), // Send user ID instead of socket ID
        });
      }
    }
  });

  // Handle WebRTC answer
  socket.on("webrtcAnswer", ({ target, sdp }) => {
    console.log("WebRTC answer received, forwarding to:", target);

    const targetSockets = onlineUsers.get(target);
    if (targetSockets && targetSockets.size > 0) {
      for (const targetSocketId of targetSockets) {
        io.to(targetSocketId).emit("webrtcAnswer", {
          sdp,
          from: userSocketMap.get(socket.id),
        });
      }
    }
  });

  // Handle ICE candidates
  socket.on("iceCandidate", ({ target, candidate }) => {
    console.log("ICE candidate received, forwarding to:", target);

    const targetSockets = onlineUsers.get(target);
    if (targetSockets && targetSockets.size > 0) {
      for (const targetSocketId of targetSockets) {
        io.to(targetSocketId).emit("iceCandidate", {
          candidate,
          from: userSocketMap.get(socket.id),
        });
      }
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    const userId = userSocketMap.get(socket.id);
    console.log("Socket disconnected:", socket.id, "User:", userId);

    // Clean up user tracking
    if (userId) {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          // Broadcast that user went offline
          socket.broadcast.emit("user_offline", userId);
          console.log("User went offline:", userId);
        } else {
          onlineUsers.set(userId, sockets);
        }
      }
      userSocketMap.delete(socket.id);
    }

    // Update online users list for all clients
    const onlineUserIds = Array.from(onlineUsers.keys());
    io.emit("online_users", onlineUserIds);

    console.log("Current online users:", onlineUserIds);
  });
});

// Serve static files for production
app.use(express.static(path.join(__dirname, "../websocket/dist")));

// Catch all handler for SPA
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "../websocket/dist", "index.html"));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 2000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { io, onlineUsers, userSocketMap };
