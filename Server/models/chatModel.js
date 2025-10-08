const pool = require("../config/db"); // Import PostgreSQL pool

const Message = {
  getMessagesBetweenUsers: async (senderId, receiverId) => {
    try {
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
      return result.rows;
    } catch (error) {
      console.error("Error in getMessagesBetweenUsers:", error);
      throw error;
    }
  },

  saveMessage: async ({ senderId, receiverId, content, senderName }) => {
    try {
      const result = await pool.query(
        "INSERT INTO messages (senderId, receiverId, content, status, senderName) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [senderId, receiverId, content, "sent", senderName]
      );

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
      console.error("Error in saveMessage:", error);
      throw error;
    }
  },
};

module.exports = Message;
