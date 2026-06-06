import React, { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import { useSelector } from 'react-redux'
import { MessageSquareIcon, SendIcon, XIcon } from './icons'
import { mdToHtml } from './markdown'
import s from './ChatWidget.module.css'

// Floating AI assistant chat. Rendered only for logged-in users. Posts to the
// Express proxy (/api/assistant/chat) with the user's bearer token; the proxy
// forwards to the n8n router. Chat history is ephemeral (local component state).
const ChatWidget = () => {
  const userLogin = useSelector((state) => state.userLogin)
  const userInfo = userLogin && userLogin.userInfo

  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, open, sending])

  if (!userInfo) return null

  const send = async (e) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return

    setMessages((prev) => [...prev, { role: 'user', text }])
    setInput('')
    setSending(true)
    try {
      const { data } = await axios.post(
        '/api/assistant/chat',
        { message: text },
        { headers: { Authorization: `Bearer ${userInfo.token}` } }
      )
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: (data && data.reply) || '…' },
      ])
    } catch (error) {
      const msg =
        error.response && error.response.data && error.response.data.message
          ? error.response.data.message
          : 'The assistant is unavailable right now. Please try again.'
      setMessages((prev) => [...prev, { role: 'error', text: msg }])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={s.root}>
      {open && (
        <section className={s.panel} aria-label='AI assistant chat'>
          <header className={s.header}>
            <span className={s.headerTitle}>
              <span className={s.statusDot} aria-hidden='true' /> Shop assistant
            </span>
            <button
              className={s.headerClose}
              onClick={() => setOpen(false)}
              aria-label='Close chat'
            >
              <XIcon size={16} />
            </button>
          </header>

          <div className={s.messages} ref={scrollRef}>
            {messages.length === 0 && (
              <div className={s.intro}>
                Hi {userInfo.name.split(' ')[0]} — ask me about products or your
                orders, e.g. &ldquo;where is my order?&rdquo;
              </div>
            )}
            {messages.map((m, i) =>
              m.role === 'assistant' ? (
                // Reply is Markdown from the model; render a safe HTML subset
                // (escaped first — see components/markdown.js).
                <div
                  key={i}
                  className={s.msgAssistant}
                  dangerouslySetInnerHTML={{ __html: mdToHtml(m.text) }}
                />
              ) : (
                <div
                  key={i}
                  className={m.role === 'error' ? s.msgError : s.msgUser}
                >
                  {m.text}
                </div>
              )
            )}
            {sending && (
              <div className={s.typing} aria-live='polite' aria-label='Assistant is typing'>
                <span className={s.typingDot} />
                <span className={s.typingDot} />
                <span className={s.typingDot} />
              </div>
            )}
          </div>

          <form className={s.inputBar} onSubmit={send}>
            <input
              className={s.input}
              type='text'
              placeholder='Type a message…'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label='Message'
            />
            <button
              className={s.sendBtn}
              type='submit'
              disabled={!input.trim() || sending}
              aria-label='Send message'
            >
              <SendIcon size={16} />
            </button>
          </form>
        </section>
      )}

      <button
        className={s.bubble}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
        aria-expanded={open}
      >
        {open ? <XIcon size={22} /> : <MessageSquareIcon size={22} />}
      </button>
    </div>
  )
}

export default ChatWidget
