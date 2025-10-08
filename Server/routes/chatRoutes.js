const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");

// Get messages between two users
router.get("/messages", async (req, res) => {
  try {
    const { senderId, receiverId } = req.query;

    if (!senderId || !receiverId) {
      return res
        .status(400)
        .json({ error: "senderId and receiverId are required" });
    }

    const messages = await chatController.getMessagesBetweenUsers(
      parseInt(senderId),
      parseInt(receiverId)
    );
    res.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Get messages by room
router.get("/:senderId/:receiverId", async (req, res) => {
  try {
    const { senderId, receiverId } = req.params;

    const messages = await chatController.getMessagesBetweenUsers(
      parseInt(senderId),
      parseInt(receiverId)
    );
    res.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Save message
router.post("/message", async (req, res) => {
  try {
    const { senderId, receiverId, content, senderName, room } = req.body;

    if (!senderId || !receiverId || !content || !senderName) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const messageData = {
      senderId: parseInt(senderId),
      receiverId: parseInt(receiverId),
      content,
      senderName,
      room: room || `${senderId}_${receiverId}`,
    };

    const savedMessage = await chatController.saveMessageForSocket(messageData);
    res.json(savedMessage);
  } catch (error) {
    console.error("Error saving message:", error);
    res.status(500).json({ error: "Failed to save message" });
  }
});

module.exports = router;
