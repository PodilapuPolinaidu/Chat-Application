const pool = require("../config/db"); // Import PostgreSQL pool

const Message = {
  getMessagesBetweenUsers: async (senderid, receiverid) => {
    try {
      const result = await pool.query(
        `SELECT m.id, m.senderid, m.receiverid,
         m.content, m.timestamp, m.status,
         u1.name AS sendername
         FROM messages m
         JOIN users u1 ON m.senderid = u1.id
         WHERE (m.senderid = $1 AND m.receiverid = $2)
         OR (m.senderid = $3 AND m.receiverid = $4)
         ORDER BY m.timestamp ASC`,
        [
          Number(senderid),
          Number(receiverid),
          Number(receiverid),
          Number(senderid),
        ]
      );
      return result.rows;
    } catch (error) {
      console.error("Error in getMessagesBetweenUsers:", error);
      throw error;
    }
  },

  saveMessage: async ({ senderid, receiverid, content, sendername }) => {
    try {
      const result = await pool.query(
        "INSERT INTO messages (senderid, receiverid, content, status, sendername) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [senderid, receiverid, content, "sent", sendername]
      );

      const messageResult = await pool.query(
        `SELECT m.id, m.senderid, m.receiverid,
                m.content, m.timestamp, m.status,
                u1.name AS sendername
         FROM messages m
         JOIN users u1 ON m.senderid = u1.id
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
