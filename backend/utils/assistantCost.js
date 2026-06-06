// Cost estimation for assistant turns. Local (private) turns are always $0;
// cloud turns are priced from token usage against a per-model rate table.
// Rates are USD per 1,000,000 tokens (input / output). Update as pricing changes.
const PRICING = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 },
}

// computeCostUsd({ route, model, promptTokens, completionTokens }) -> number
// - route 'local'        -> 0 (data never left the perimeter, no API spend)
// - unknown/absent model -> 0 (cannot price; surfaced as $0.00 rather than guessing)
const computeCostUsd = ({
  route,
  model,
  promptTokens = 0,
  completionTokens = 0,
} = {}) => {
  if (route === 'local') return 0

  const price = PRICING[model]
  if (!price) return 0

  const cost =
    (promptTokens * price.input + completionTokens * price.output) / 1_000_000
  return Number(cost.toFixed(6))
}

export { computeCostUsd, PRICING }
