import mongoose from 'mongoose'

// Tracking collection for the AI assistant router. One document per chat turn.
// Written by the n8n router workflow; read by the admin AI Router Dashboard.
const chatLogSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    message: { type: String, required: true },
    // PII entity types found in the user message, e.g. ['EMAIL_ADDRESS', 'PERSON']
    piiEntities: [{ type: String }],
    // which detector produced piiEntities: 'presidio' | 'llm' | 'regex'
    piiDetector: { type: String },
    // routing decision and why
    route: { type: String, enum: ['local', 'cloud'], required: true },
    routeReason: { type: String },
    // model that produced the reply (e.g. 'qwen3:8b-q8_0' or 'gpt-4o-mini')
    model: { type: String },
    reply: { type: String },
    latencyMs: { type: Number, default: 0 },
    // 0.00 for local (private) turns; real cost for cloud turns
    costUsd: { type: Number, default: 0 },
    // privacy-hardening flags (set when the turn went through minimization/masking)
    minimized: { type: Boolean, default: false },
    masked: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
)

const ChatLog = mongoose.model('ChatLog', chatLogSchema)

export default ChatLog
