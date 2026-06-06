// Minimal, dependency-free Markdown -> safe HTML for assistant replies.
//
// SECURITY: the input (model output, which may include untrusted tool data such
// as product reviews) is HTML-escaped FIRST. Only our own transforms then emit a
// fixed, safe subset of tags. So raw HTML / <script> in the reply cannot execute
// (relevant to the indirect-injection scenario). Links are restricted to
// http(s)/relative/mailto; anything else (javascript:, data:) is neutralised.

const escapeHtml = (s) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const safeUrl = (url) => {
  const u = (url || '').trim()
  // Normalize in-app product/order links to a relative SPA path, even if the
  // model wrapped them in a (hallucinated) absolute domain like proshop.com.
  const internal = u.match(/\/(product|order)\/[A-Za-z0-9]+/)
  if (internal) return internal[0]
  if (/^(https?:\/\/|\/|\.\/|#|mailto:)/i.test(u)) return u
  return '#'
}

// Inline-level formatting applied to already-escaped text.
const inline = (text) => {
  let t = text
  // images ![alt](url) -> just the alt text (avoid broken/untrusted images)
  t = t.replace(/!\[([^\]]*)\]\([^)]+\)/g, (_, alt) => alt)
  // links [text](url)
  t = t.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, txt, url) =>
      `<a href="${escapeHtml(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${txt}</a>`
  )
  // inline code `code`
  t = t.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
  // bold **x** / __x__
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  t = t.replace(/__([^_]+)__/g, '<strong>$1</strong>')
  // italic *x* / _x_
  t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  t = t.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>')
  return t
}

export const mdToHtml = (raw) => {
  if (!raw) return ''
  const lines = escapeHtml(String(raw)).split(/\r?\n/)
  const out = []
  let listType = null // 'ul' | 'ol'
  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`)
      listType = null
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '') {
      closeList()
      continue
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      closeList()
      const lvl = heading[1].length
      out.push(`<h${lvl}>${inline(heading[2])}</h${lvl}>`)
      continue
    }

    const ordered = trimmed.match(/^\d+\.\s+(.*)$/)
    if (ordered) {
      if (listType !== 'ol') {
        closeList()
        out.push('<ol>')
        listType = 'ol'
      }
      out.push(`<li>${inline(ordered[1])}</li>`)
      continue
    }

    const bullet = trimmed.match(/^[-*]\s+(.*)$/)
    if (bullet) {
      if (listType !== 'ul') {
        closeList()
        out.push('<ul>')
        listType = 'ul'
      }
      out.push(`<li>${inline(bullet[1])}</li>`)
      continue
    }

    closeList()
    out.push(`<p>${inline(trimmed)}</p>`)
  }
  closeList()
  return out.join('')
}
