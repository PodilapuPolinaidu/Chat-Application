const express = require("express");
const router = express.Router();
const { getMessages, saveMessage } = require("../controllers/chatController");
const chatController = require("../controllers/chatController");
router.get("/:senderId/:receiverId", getMessages);
router.post("/", saveMessage);
router.get("/messages", async (req, res) => {
  try {
    const { senderId, receiverId } = req.query;

    if (!senderId || !receiverId) {
      return res
        .status(400)
        .json({ error: "senderId and receiverId are required" });
    }

    const messages = await chatController.getMessagesBetweenUsers(
      senderId,
      receiverId
    );
    res.json(messages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});
module.exports = router;
