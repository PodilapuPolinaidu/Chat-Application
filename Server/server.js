const express = require("express");
const http = require("http");
const cors = require("cors");
const socketIo = require("socket.io");
require("dotenv").config();
const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");
const chatController = require("./controllers/chatController");
const db = require("./config/db");
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

const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);
  socket.on("join_room", (room) => {
    socket.join(room);
  });

  socket.on("user_online", (userId) => {
    if (!userId) return;
    const sockets = onlineUsers.get(userId) || new Set();
    sockets.add(socket.id);
    onlineUsers.set(userId, sockets);

    const onlineUserIds = Array.from(onlineUsers.keys());
    io.emit("online_users", onlineUserIds);
    socket.broadcast.emit("user_online", userId);

    console.log("User came online:", userId, "current online:", onlineUserIds);
  });

  socket.on("send_message", async (data, callback) => {
    try {
      const savedMessage = await chatController.saveMessageForSocket(data);
      const receiverSockets =
        onlineUsers.get(String(data.receiverId)) ||
        onlineUsers.get(Number(data.receiverId));
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
      callback({ error: "Failed to send" });
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

  socket.on("call_user", ({ from, to, offer }) => {
    const receiverSockets = onlineUsers.get(to);
    if (receiverSockets) {
      for (const rSockId of receiverSockets) {
        io.to(rSockId).emit("incoming_call", { from, offer });
      }
    }
  });

  // When receiver answers
  socket.on("answer_call", ({ from, to, answer }) => {
    const callerSockets = onlineUsers.get(to);
    if (callerSockets) {
      for (const cSockId of callerSockets) {
        io.to(cSockId).emit("call_answered", { from, answer });
      }
    }
  });

  socket.on("ice_candidate", ({ to, candidate }) => {
    const targetSockets = onlineUsers.get(to);
    if (targetSockets) {
      for (const tSockId of targetSockets) {
        io.to(tSockId).emit("ice_candidate", candidate);
      }
    }
  });

  socket.on("disconnect", () => {
    for (const [userId, sockets] of onlineUsers.entries()) {
      if (sockets.has(socket.id)) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          socket.broadcast.emit("user_offline", userId);
        } else {
          onlineUsers.set(userId, sockets);
        }
        break;
      }
    }
    const onlineUserIds = Array.from(onlineUsers.keys());
    io.emit("online_users", onlineUserIds);

    console.log(
      "Socket disconnected:",
      socket.id,
      "current online:",
      onlineUserIds
    );
  });
});

server.listen(process.env.PORT, () => {
  console.log("Server running on port 2000");
});
