// Privacy hardening for the AI assistant's cloud path.
//
// Two layers, applied server-side at the tool/data boundary (never trusting the
// LLM): (1) MINIMIZATION reduces a raw order to the few fields a cloud model
// legitimately needs, dropping every PII-bearing field; (2) reversible
// TOKENIZATION masks any PII that is deliberately kept (e.g. the customer's name
// for personalization) before it leaves the perimeter, and restores it in the
// reply. Detection of PII spans is delegated to Presidio (see the controller);
// this module holds the deterministic, side-effect-free transforms so they can be
// unit-tested in isolation.

// Order fields that must NEVER reach the cloud. Minimization uses an allow-list
// (below), so these are dropped by omission; the list is kept for documentation
// and for assertions in tests.
const PII_ORDER_FIELDS = ['shippingAddress', 'paymentResult', 'paymentMethod', 'user']

// Reduce a raw order document to a minimized, PII-free projection. Line items are
// retained (product names/prices are not PII and are needed for recommendations).
const minimizeOrder = (order) => {
  const o =
    order && typeof order.toObject === 'function' ? order.toObject() : order || {}

  const status = o.isDelivered
    ? 'delivered'
    : o.isPaid
    ? 'paid, awaiting delivery'
    : 'not paid'

  return {
    orderId: String(o._id ?? ''),
    status,
    isPaid: !!o.isPaid,
    isDelivered: !!o.isDelivered,
    // delivery date doubles as the ETA proxy for already-shipped orders
    eta: o.deliveredAt ?? null,
    totalPrice: o.totalPrice ?? 0,
    items: Array.isArray(o.orderItems)
      ? o.orderItems.map((i) => ({ name: i.name, qty: i.qty, price: i.price }))
      : [],
  }
}

// Reversible PII tokenization driven by Presidio analyzer spans. Each distinct
// entity value gets a stable instance token (<PERSON_1>, <EMAIL_ADDRESS_1>, ...),
// numbered by first appearance. Returns the masked text plus the token->value
// mapping needed to restore real values later. Identical values collapse to one
// token so the cloud model still sees them as the same entity.
const tokenizePII = (text, analyzerResults = []) => {
  const str = String(text ?? '')

  const spans = (Array.isArray(analyzerResults) ? analyzerResults : []).filter(
    (r) =>
      r &&
      Number.isInteger(r.start) &&
      Number.isInteger(r.end) &&
      r.end > r.start &&
      r.end <= str.length
  )

  const mapping = {} // token -> real value
  const valueToToken = {} // real value -> token (dedupe identical values)
  const counters = {} // entity_type -> running counter

  // First pass (left-to-right): assign tokens by first appearance.
  for (const span of [...spans].sort((a, b) => a.start - b.start)) {
    const value = str.slice(span.start, span.end)
    if (!(value in valueToToken)) {
      const type = span.entity_type || 'PII'
      counters[type] = (counters[type] || 0) + 1
      const token = `<${type}_${counters[type]}>`
      valueToToken[value] = token
      mapping[token] = value
    }
  }

  // Second pass (right-to-left): splice tokens in so earlier offsets stay valid.
  let masked = str
  for (const span of [...spans].sort((a, b) => b.start - a.start)) {
    const value = str.slice(span.start, span.end)
    masked = masked.slice(0, span.start) + valueToToken[value] + masked.slice(span.end)
  }

  return { masked, mapping }
}

// Restore real values in a model reply using a token->value mapping. Inverse of
// tokenizePII: the user sees real names while the cloud only ever saw tokens.
const deanonymize = (text, mapping = {}) => {
  let out = String(text ?? '')
  for (const [token, value] of Object.entries(mapping || {})) {
    out = out.split(token).join(value)
  }
  return out
}

export { minimizeOrder, tokenizePII, deanonymize, PII_ORDER_FIELDS }
