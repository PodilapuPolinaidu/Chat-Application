const pool = require("../config/db");

// Controller for HTTP API (used in routes)
const chatController = {
  // ✅ Get all messages between two users
  async getMessages(req, res) {
    try {
      const { senderId, receiverId } = req.params;

      const result = await pool.query(
        `SELECT m.id, m.senderId, m.receiverId,
                m.content, m.timestamp, m.status,
                u1.name AS senderName
         FROM messages m
         JOIN users u1 ON m.senderId = u1.id
         WHERE (m.senderId = $1 AND m.receiverId = $2)
            OR (m.senderId = $3 AND m.receiverId = $4)
         ORDER BY m.timestamp ASC`,
        [senderId, receiverId, receiverId, senderId]
      );
      console.log(result);
      res.json(result.rows);
    } catch (error) {
      console.error("❌ Error fetching messages:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },

  // ✅ Save a new message via REST API
  async saveMessage(req, res) {
    try {
      const { senderId, receiverId, content, senderName, room } = req.body;

      if (!senderId || !receiverId || !content) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const insertQuery = `
        INSERT INTO messages (senderId, receiverId, content, status, senderName, room) 
        VALUES ($1, $2, $3, $4, $5, $6) 
        RETURNING *
      `;
      const values = [senderId, receiverId, content, "sent", senderName, room];

      const result = await pool.query(insertQuery, values);

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("❌ Error saving message:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },

  // ✅ This one is for socket (optional)
  async saveMessageForSocket(messageData) {
    try {
      const { senderId, receiverId, content, senderName, room } = messageData;

      const result = await pool.query(
        `INSERT INTO messages (senderId, receiverId, content, status, senderName, room) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *`,
        [senderId, receiverId, content, "sent", senderName, room]
      );

      return result.rows[0];
    } catch (error) {
      console.error("❌ Socket Save Error:", error);
      throw error;
    }
  },
};

module.exports = chatController;
