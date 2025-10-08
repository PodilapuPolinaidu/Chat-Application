const pool = require("../config/db");

const chatController = {
  async saveMessageForSocket(messageData) {
    try {
      console.log("💾 [SAVE MESSAGE] Starting to save message:", messageData);

      const { senderId, receiverId, content, senderName, room } = messageData;

      // Validate required fields
      if (!senderId || !receiverId || !content) {
        console.error("❌ [SAVE MESSAGE] Missing required fields:", {
          senderId,
          receiverId,
          content,
        });
        throw new Error("Missing required fields");
      }

      console.log("🔍 [SAVE MESSAGE] Attempting database insert...");

      // ✅ PostgreSQL syntax with RETURNING
      const insertQuery = `
        INSERT INTO messages (senderId, receiverId, content, status, senderName, room) 
        VALUES ($1, $2, $3, $4, $5, $6) 
        RETURNING *
      `;
      const insertValues = [
        senderId,
        receiverId,
        content,
        "sent",
        senderName,
        room,
      ];

      console.log("📝 [SAVE MESSAGE] Executing query:", insertQuery);
      console.log("📝 [SAVE MESSAGE] With values:", insertValues);

      const result = await pool.query(insertQuery, insertValues);
      console.log(
        "✅ [SAVE MESSAGE] Insert successful, result:",
        result.rows[0]
      );

      // Get the complete message with sender name
      const selectQuery = `
        SELECT m.id, m.senderId, m.receiverId,
               m.content, m.timestamp, m.status,
               u1.name AS senderName
        FROM messages m
        JOIN users u1 ON m.senderId = u1.id
        WHERE m.id = $1
      `;

      console.log("🔍 [SAVE MESSAGE] Fetching complete message...");
      const messageResult = await pool.query(selectQuery, [result.rows[0].id]);

      if (messageResult.rows.length === 0) {
        console.error("❌ [SAVE MESSAGE] Message not found after insert!");
        throw new Error("Message not found after insert");
      }

      console.log(
        "✅ [SAVE MESSAGE] Complete message fetched:",
        messageResult.rows[0]
      );
      return messageResult.rows[0];
    } catch (error) {
      console.error("[SAVE MESSAGE] ERROR DETAILS:");
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      console.error("Error code:", error.code);
      console.error("Received data:", messageData);

      // Check for specific PostgreSQL errors
      if (error.code === "23503") {
        // Foreign key violation
        console.error(
          "FOREIGN KEY VIOLATION: User ID doesn't exist in users table"
        );
      } else if (error.code === "23502") {
        // Not null violation
        console.error("NOT NULL VIOLATION: Missing required field");
      } else if (error.code === "42P01") {
        // Table doesn't exist
        console.error("TABLE DOESN'T EXIST: messages table missing");
      }

      throw error;
    }
  },
};

module.exports = chatController;
