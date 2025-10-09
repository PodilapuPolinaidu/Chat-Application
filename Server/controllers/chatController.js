const pool = require("../config/db");

// Controller for HTTP API (used in routes)
const chatController = {
  // ✅ Get all messages between two users
  async getMessages(req, res) {
    try {
      const { senderid, receiverid } = req.params;

      const result = await pool.query(
        `SELECT m.id, m.senderid, m.receiverid,
                m.content, m.timestamp, m.status,
                u1.name AS sendername
         FROM messages m
         JOIN users u1 ON m.senderid = u1.id
         WHERE (m.senderid = $1 AND m.receiverid = $2)
            OR (m.senderid = $3 AND m.receiverid = $4)
         ORDER BY m.timestamp ASC`,
        [senderid, receiverid, receiverid, senderid]
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
      const { senderid, receiverid, content, sendername, room } = req.body;

      if (!senderid || !receiverid || !content) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const insertQuery = `
        INSERT INTO messages (senderid, receiverid, content, status, sendername, room) 
        VALUES ($1, $2, $3, $4, $5, $6) 
        RETURNING *
      `;
      const values = [senderid, receiverid, content, "sent", sendername, room];

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
      const { senderid, receiverid, content, sendername, room } = messageData;

      const result = await pool.query(
        `INSERT INTO messages (senderid, receiverid, content, status, sendername, room) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *`,
        [senderid, receiverid, content, "sent", sendername, room]
      );

      return result.rows[0];
    } catch (error) {
      console.error("❌ Socket Save Error:", error);
      throw error;
    }
  },
};

module.exports = chatController;
