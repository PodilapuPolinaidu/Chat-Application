const db = require("../config/db");

const Message = {
  getMessagesBetweenUsers: async (senderId, receiverId) => {
    try {
      const [rows] = await db.query(
        `SELECT m.id, m.senderId, m.receiverId,
       m.content, m.timestamp, m.status,
       u1.name AS senderName
FROM messages m
JOIN users u1 ON m.senderId = u1.id
WHERE (m.senderId = ? AND m.receiverId = ?)
   OR (m.senderId = ? AND m.receiverId = ?)
ORDER BY m.timestamp ASC;`,
        [
          Number(senderId),
          Number(receiverId),
          Number(receiverId),
          Number(senderId),
        ]
      );
      return rows;
    } catch (error) {
      console.error("Error in getMessagesBetweenUsers:", error);
      throw error;
    }
  },

  saveMessage: async ({ senderId, receiverId, content, senderName }) => {
    try {
      const [result] = await db.query(
        "INSERT INTO messages (senderId, receiverId, content, status, senderName) VALUES (?, ?, ?, ?, ?)",
        [senderId, receiverId, content, "sent", senderName]
      );

      const [savedRows] = await db.query(
        `SELECT m.id, m.senderId, m.receiverId,
              m.content, m.timestamp, m.status,
              u1.name AS senderName
       FROM messages m
       JOIN users u1 ON m.senderId = u1.id
       WHERE m.id = ?`,
        [result.insertId]
      );

      return savedRows[0];
    } catch (error) {
      console.error("Error in saveMessage:", error);
      throw error;
    }
  },
};

module.exports = Message;
