import express from 'express';
import { agentController } from '../controllers.js/agent.controller.js';
import multer from '../config/multer.js';

const router = express.Router();

router.post('/prompt', multer.single("file"), agentController);
router.post('/', agentController);

export default router;
