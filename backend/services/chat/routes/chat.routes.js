import express from 'express';
import {
  createConversation,
  getConversations,
  updateConversations,
  deleteConversation,
  saveMessage,
  getMessage,
} from '../controllers/chat.controller.js';

const router = express.Router();

router.post("/create-conversation", createConversation);
router.get("/get-conversations", getConversations);
router.put("/update-conversation", updateConversations);
router.delete("/delete-conversation/:id", deleteConversation);
router.delete("/delete-conversation", deleteConversation);
router.post("/save-message", saveMessage);
router.get("/get-messages", getMessage);
router.get("/get-messages/:conversationId", getMessage);

export default router;