const express = require("express");
const router = express.Router();
const { getMessages, saveMessage } = require("../controllers/chatController");

router.get("/:senderId/:receiverId", getMessages);
router.post("/", saveMessage);

module.exports = router;
