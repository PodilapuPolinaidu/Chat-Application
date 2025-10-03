const chatModel = require("../models/chatModel");

const chatController = {
  async getMessages(req, res) {
    try {
      const { senderId, receiverId } = req.params;
      const messages = await chatModel.getMessagesBetweenUsers(
        senderId,
        receiverId
      );
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  async saveMessage(req, res) {
    try {
      const { senderId, receiverId, content } = req.body;
      const savedMessage = await chatModel.saveMessage({
        senderId: senderId,
        receiverId: receiverId,
        content: content,
      });
      res.json(savedMessage);
    } catch (error) {
      console.error("Error saving message:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  async saveMessageForSocket(messageData) {
    try {
      const { senderId, receiverId, content } = messageData;
      const savedMessage = await chatModel.saveMessage({
        senderId: senderId,
        receiverId: receiverId,
        content: content,
      });
      return savedMessage;
    } catch (error) {
      console.error("Error saving message:", error);
      throw error;
    }
  },
};

module.exports = chatController;
