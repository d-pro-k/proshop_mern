import asyncHandler from 'express-async-handler'
import ChatLog from '../models/chatLogModel.js'
import Product from '../models/productModel.js'
import Order from '../models/orderModel.js'
import { minimizeOrder, tokenizePII, deanonymize } from '../utils/assistantPrivacy.js'

// Where the proxy forwards chat turns. The n8n router owns PII detection, model
// routing, tool calls and chat-log writes. Configurable; never hard-code in clients.
const ASSISTANT_WEBHOOK_URL =
  process.env.ASSISTANT_WEBHOOK_URL ||
  'http://localhost:5678/webhook/assistant-chat'

// Presidio analyzer (PII span detection) for the cloud-context masking step.
const PRESIDIO_ANALYZER_URL =
  process.env.PRESIDIO_ANALYZER_URL || 'http://127.0.0.1:5002/analyze'

const MASK_ENTITIES = [
  'PERSON',
  'EMAIL_ADDRESS',
  'PHONE_NUMBER',
  'CREDIT_CARD',
  'LOCATION',
]

// Detect PII spans in free text via Presidio. Returns [] on any failure so the
// caller can fall back to its own safety net rather than crash a chat turn.
const analyzePII = async (text) => {
  try {
    const r = await fetch(PRESIDIO_ANALYZER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language: 'en', entities: MASK_ENTITIES }),
    })
    if (!r.ok) return []
    const data = await r.json()
    return Array.isArray(data) ? data : []
  } catch (err) {
    return []
  }
}

// @desc    Proxy a chat message to the n8n router
// @route   POST /api/assistant/chat
// @access  Private
const postAssistantChat = asyncHandler(async (req, res) => {
  const { message } = req.body

  if (!message || typeof message !== 'string') {
    res.status(400)
    throw new Error('Message is required')
  }

  // Identity is taken from the authenticated session, never from the client body.
  // The same bearer token is forwarded so the n8n agent's tool calls stay scoped
  // to this user (deterministic least privilege — no userId travels via the LLM).
  const authHeader = req.headers.authorization || ''

  let upstream
  try {
    upstream = await fetch(ASSISTANT_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({ userId: req.user._id.toString(), message }),
    })
  } catch (err) {
    res.status(502)
    throw new Error('Assistant router is unreachable')
  }

  if (!upstream.ok) {
    res.status(502)
    throw new Error(`Assistant router error (${upstream.status})`)
  }

  const data = await upstream.json().catch(() => ({}))
  res.json({ reply: data.reply ?? '' })
})

// @desc    Read AI router chat logs (admin dashboard)
// @route   GET /api/assistant/logs
// @access  Private/Admin
const getAssistantLogs = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500)
  const logs = await ChatLog.find({}).sort({ createdAt: -1 }).limit(limit)
  res.json(logs)
})

// @desc    Catalog for the assistant — trimmed + a ready-to-use link `url`
//          (so the agent links products without having to build URLs itself)
// @route   GET /api/assistant/tools/products
// @access  Private
const getAssistantProducts = asyncHandler(async (req, res) => {
  const keyword = req.query.keyword
    ? { name: { $regex: req.query.keyword, $options: 'i' } }
    : {}

  const products = await Product.find({ ...keyword })
    .select('name price brand category countInStock')
    .limit(20)

  res.json(
    products.map((p) => ({
      id: p._id,
      name: p.name,
      price: p.price,
      brand: p.brand,
      category: p.category,
      inStock: p.countInStock > 0,
      url: `/product/${p._id}`,
    }))
  )
})

// @desc    Build a privacy-hardened context for the cloud model from the user's
//          own data. Minimizes orders (drops shipping/payment/PII fields) and
//          masks any residual PII (e.g. the customer name kept for personalization)
//          to reversible tokens. The cloud only ever sees the masked context; the
//          token->value mapping stays on this perimeter for later restoration.
// @route   POST /api/assistant/privacy/prepare
// @access  Private
const prepareAssistantContext = asyncHandler(async (req, res) => {
  // Scoped to the authenticated session — identity never comes from the body.
  const orders = await Order.find({ user: req.user._id })
  const minimized = (orders || []).map(minimizeOrder)

  const customerName = req.user.name || ''
  const context =
    `Customer: ${customerName}\n` +
    `The customer's orders (minimized — shipping address, payment details and ` +
    `email have been removed and never leave the local perimeter):\n` +
    JSON.stringify(minimized, null, 2)

  // Presidio is the primary detector. Safety net: guarantee the known customer
  // name is masked even if Presidio misses it (e.g. non-Latin names), so a real
  // identity can never leak to the cloud through this context.
  const analyzerResults = await analyzePII(context)
  if (customerName) {
    const nameStart = context.indexOf(customerName)
    const covered =
      nameStart >= 0 &&
      analyzerResults.some(
        (r) => r.start <= nameStart && r.end >= nameStart + customerName.length
      )
    if (nameStart >= 0 && !covered) {
      analyzerResults.push({
        entity_type: 'PERSON',
        start: nameStart,
        end: nameStart + customerName.length,
        score: 1,
      })
    }
  }

  const { masked, mapping } = tokenizePII(context, analyzerResults)

  res.json({
    context: masked,
    mapping,
    minimized: true,
    masked: Object.keys(mapping).length > 0,
    entities: [...new Set(analyzerResults.map((r) => r.entity_type))],
    orderCount: minimized.length,
  })
})

// @desc    Restore real PII values in a cloud reply using a token->value mapping.
//          The inverse of /privacy/prepare's masking — the user sees real names
//          while the cloud only ever processed tokens.
// @route   POST /api/assistant/privacy/restore
// @access  Private
const restoreAssistantReply = asyncHandler(async (req, res) => {
  const { text, mapping } = req.body
  res.json({ reply: deanonymize(text || '', mapping || {}) })
})

export {
  postAssistantChat,
  getAssistantLogs,
  getAssistantProducts,
  prepareAssistantContext,
  restoreAssistantReply,
}
