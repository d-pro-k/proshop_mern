#!/usr/bin/env node
// Vision diff: current screenshot vs reference, using Claude Sonnet 4.6.
// Requires ANTHROPIC_API_KEY in env.

import Anthropic from '@anthropic-ai/sdk'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const REFERENCE = path.join(__dirname, 'reference/dashboard-reference.png')
const CURRENT = path.join(__dirname, 'current-dashboard.png')
const REPORT = path.join(__dirname, 'verify-report.md')

const PROMPT = `
You are auditing two screenshots of the same UI for visual regressions.

- Image 1: reference (the source of truth — how the UI SHOULD look)
- Image 2: current (the latest render)

Compare them and output a structured report:

## Match score
- 0–100, where 100 = identical, 0 = nothing matches.

## Differences
For each visual difference, output:
- **Element / area:** (e.g., "status badges", "sidebar bg")
- **What changed:** (e.g., "color shifted from #22c55e to #16a34a")
- **Severity:** critical (palette/layout broken) | major (spacing/typography drift) | minor (sub-pixel)

If there are no visible differences, write "None." under this section.

## Summary
- Total diffs: N (C critical / M major / K minor)
- Verdict: PASS (score ≥ 95) | WARN (90–95) | FAIL (< 90)
- Top recommendation: what to fix first (or "no action" if PASS)

Be precise. Don't invent differences. If images look identical, score 100 and say so.
`

async function imageToBase64(filepath) {
  const buf = await readFile(filepath)
  return buf.toString('base64')
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY not set.')
    process.exit(1)
  }

  const client = new Anthropic()
  const [referenceB64, currentB64] = await Promise.all([
    imageToBase64(REFERENCE),
    imageToBase64(CURRENT),
  ])

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Reference image (source of truth):' },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: referenceB64 } },
        { type: 'text', text: 'Current image (latest render):' },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: currentB64 } },
        { type: 'text', text: PROMPT },
      ],
    }],
  })

  const report = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n\n')

  // Baseline semantics — explicit in every report so a cold reader knows
  // what "reference" means here.
  const header = `# Pixel-Perfect Verify Report — ${new Date().toISOString()}\n\n` +
    `> **Baseline:** reference = current Dashboard rendering captured at the end of\n` +
    `> the ui-reviewer enforce passes. This pipeline catches future drift from that\n` +
    `> baseline, not drift from any external (e.g. Stripe Dashboard) reference.\n\n` +
    `> **Model:** \`${response.model}\` · **Input tokens:** ${response.usage.input_tokens} · ` +
    `**Output tokens:** ${response.usage.output_tokens}\n\n` +
    `---\n\n`

  await writeFile(REPORT, `${header}${report}\n`, 'utf-8')
  console.log(`Report saved: ${REPORT}`)
  console.log('---')
  console.log(report)
}

main().catch((e) => { console.error(e); process.exit(1) })
