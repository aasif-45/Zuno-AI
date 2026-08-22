import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";

export const createConversation = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    console.log("Headers:", req.headers);
    console.log("userId:", req.headers["x-user-id"]);
    const conversation = await Conversation.create({ userId: userId });
    return res.status(200).json(conversation);
  } catch (error) {
    return res
      .status(500)
      .json({ message: `create conversation error ${error.message || error}` });
  }
};

export const getConversations = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    console.log("userId", userId);
    const conversations = await Conversation.find({ userId: userId }).sort({
      updatedAt: -1,
    });
    return res.status(200).json(conversations);
  } catch (error) {
    return res
      .status(500)
      .json({ message: `get conversation error ${error.message || error}` });
  }
};

export const updateConversations = async (req, res) => {
  try {
    const { id, title } = req.body;
    const conversation = await Conversation.findByIdAndUpdate(
      id,
      { title },
      { new: true },
    );
    return res.status(200).json(conversation);
  } catch (error) {
    return res
      .status(500)
      .json({ message: `update conversation error ${error.message || error}` });
  }
};

export const saveMessage = async (req, res) => {
  try {
    const { conversationId, role, content, images, artifacts, fileName, fileType, fileUrl } = req.body;
    const message = await Message.create({
      conversationId,
      content,
      role,
      images: Array.isArray(images) ? images : [],
      artifacts: Array.isArray(artifacts) ? artifacts : [],
      ...(fileName ? { fileName } : {}),
      ...(fileType ? { fileType } : {}),
      ...(fileUrl ? { fileUrl } : {}),
    });
    return res.status(200).json(message);
  } catch (error) {
    return res
      .status(500)
      .json({ message: `save message error ${error.message || error}` });
  }
};

export const getMessage = async (req, res) => {
  try {
    const conversationId =
      req.params.conversationId ||
      req.body?.conversationId ||
      req.query?.conversationId;

    if (!conversationId) {
      return res.status(200).json([]);
    }

    const messages = await Message.find({ conversationId }).sort({
      createdAt: 1,
    });

    console.log(`[getMessage] Fetched ${messages.length} messages for conversationId: ${conversationId}`);
    return res.status(200).json(messages);
  } catch (error) {
    console.error("Get messages error:", error);
    return res
      .status(500)
      .json({ message: `get messages error ${error.message || error}` });
  }
};export const deleteConversation = async (req, res) => {
  try {
    const conversationId = req.params.id || req.body.id || req.query.id;
    if (!conversationId) {
      return res.status(400).json({ message: "Conversation ID is required" });
    }
    await Conversation.findByIdAndDelete(conversationId);
    await Message.deleteMany({ conversationId });
    return res.status(200).json({ message: "Conversation deleted successfully", id: conversationId });
  } catch (error) {
    return res
      .status(500)
      .json({ message: `delete conversation error ${error.message || error}` });
  }
};
