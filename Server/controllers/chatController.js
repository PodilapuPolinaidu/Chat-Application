const pool = require("../config/db"); // Import PostgreSQL pool

const chatController = {
  async getMessages(req, res) {
    try {
      const { senderId, receiverId } = req.params;
      // CHANGE TO PostgreSQL syntax:
      const result = await pool.query(
        `SELECT m.id, m.senderId, m.receiverId,
         m.content, m.timestamp, m.status,
         u1.name AS senderName
         FROM messages m
         JOIN users u1 ON m.senderId = u1.id
         WHERE (m.senderId = $1 AND m.receiverId = $2)
         OR (m.senderId = $3 AND m.receiverId = $4)
         ORDER BY m.timestamp ASC`,
        [
          Number(senderId),
          Number(receiverId),
          Number(receiverId),
          Number(senderId),
        ]
      );
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  async saveMessage(req, res) {
    try {
      const { senderId, receiverId, content } = req.body;
      // CHANGE TO PostgreSQL syntax:
      const result = await pool.query(
        "INSERT INTO messages (senderId, receiverId, content, status, senderName) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [senderId, receiverId, content, "sent", req.body.senderName]
      );
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error saving message:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },

  async saveMessageForSocket(messageData) {
    try {
      const { senderId, receiverId, content, senderName } = messageData;
      console.log(senderName);
      // CHANGE TO PostgreSQL syntax:
      const result = await pool.query(
        "INSERT INTO messages (senderId, receiverId, content, status, senderName) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [senderId, receiverId, content, "sent", senderName]
      );

      // Get the complete message with sender name
      const messageResult = await pool.query(
        `SELECT m.id, m.senderId, m.receiverId,
                m.content, m.timestamp, m.status,
                u1.name AS senderName
         FROM messages m
         JOIN users u1 ON m.senderId = u1.id
         WHERE m.id = $1`,
        [result.rows[0].id]
      );

      return messageResult.rows[0];
    } catch (error) {
      console.error("Error saving message:", error);
      throw error;
    }
  },
};

module.exports = chatController;
