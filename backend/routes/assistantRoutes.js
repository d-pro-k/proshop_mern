import express from 'express'
const router = express.Router()
import { protect, admin } from '../middleware/authMiddleware.js'
import { getMyOrders } from '../controllers/orderController.js'
import { getUserProfile } from '../controllers/userController.js'
import {
  postAssistantChat,
  getAssistantLogs,
  getAssistantProducts,
  prepareAssistantContext,
  restoreAssistantReply,
} from '../controllers/assistantController.js'

// Chat proxy — forwards to the n8n router with a trusted userId from the session.
router.post('/chat', protect, postAssistantChat)

// Admin dashboard — read the AI router chat logs.
router.get('/logs', protect, admin, getAssistantLogs)

// Privacy boundary for the cloud path. /prepare minimizes + masks the user's own
// data into a cloud-safe context; /restore reverses the masking on the reply. Both
// are scoped to the session (req.user); the cloud never sees raw PII.
router.post('/privacy/prepare', protect, prepareAssistantContext)
router.post('/privacy/restore', protect, restoreAssistantReply)

// Scoped agent tools. Identity always derives from the JWT (req.user), never from
// LLM-supplied arguments — the n8n agent calls these with the forwarded bearer
// token, so even a jailbroken agent cannot widen the scope (no such handle exists).
router.get('/tools/products', protect, getAssistantProducts)
router.get('/tools/my-orders', protect, getMyOrders)
router.get('/tools/my-profile', protect, getUserProfile)

export default router
