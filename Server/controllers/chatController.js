const pool = require("../config/db");

const chatController = {
  async saveMessageForSocket(messageData) {
    try {
      console.log("💾 [SAVE MESSAGE] Starting to save message:", messageData);

      const { senderId, receiverId, content, senderName, room, tempId } =
        messageData;

      // Validate required fields
      if (!senderId || !receiverId || !content || !senderName || !room) {
        console.error(
          "❌ [SAVE MESSAGE] Missing required fields:",
          messageData
        );
        throw new Error("Missing required fields");
      }

      console.log("🔍 [SAVE MESSAGE] Attempting database insert...");

      // Insert message
      const insertQuery = `
        INSERT INTO messages (senderId, receiverId, content, senderName, room, tempId) 
        VALUES ($1, $2, $3, $4, $5, $6) 
        RETURNING id, senderId, receiverId, content, timestamp, status, senderName
      `;

      const insertValues = [
        Number(senderId),
        Number(receiverId),
        content,
        senderName,
        room,
        tempId || null,
      ];

      console.log("📝 [SAVE MESSAGE] Executing query...");
      const result = await pool.query(insertQuery, insertValues);

      if (!result.rows[0]) {
        throw new Error("No data returned after insert");
      }

      console.log(
        "✅ [SAVE MESSAGE] Message saved successfully:",
        result.rows[0]
      );
      return result.rows[0];
    } catch (error) {
      console.error("❌ [SAVE MESSAGE] ERROR:", error);
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        receivedData: messageData,
      });
      throw error;
    }
  },

  // Add method to get messages
  async getMessagesBetweenUsers(senderId, receiverId) {
    try {
      const query = `
        SELECT m.*, u.name as senderName 
        FROM messages m 
        JOIN users u ON m.senderId = u.id 
        WHERE (m.senderId = $1 AND m.receiverId = $2) 
           OR (m.senderId = $3 AND m.receiverId = $4) 
        ORDER BY m.timestamp ASC
      `;

      const result = await pool.query(query, [
        Number(senderId),
        Number(receiverId),
        Number(receiverId),
        Number(senderId),
      ]);

      return result.rows;
    } catch (error) {
      console.error("Error fetching messages:", error);
      throw error;
    }
  },
};

module.exports = chatController;
