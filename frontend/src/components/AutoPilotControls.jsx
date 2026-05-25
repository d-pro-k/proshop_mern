import React, { useState } from 'react'
import s from './AutoPilotControls.module.css'

const N8N_URL = process.env.REACT_APP_N8N_WEBHOOK_URL
const N8N_API_KEY = process.env.REACT_APP_N8N_API_KEY

export default function AutoPilotControls({ feature, onUpdate }) {
  const [loading, setLoading] = useState(null)
  const [feedback, setFeedback] = useState(null)

  async function callAutoPilot(action, extras = {}) {
    setLoading(action)
    setFeedback(null)

    try {
      const response = await fetch(`${N8N_URL}/feature-control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': N8N_API_KEY,
        },
        body: JSON.stringify({
          feature_id: feature.id,
          action,
          ...extras,
        }),
      })

      const result = await response.json()

      if (!response.ok || result.success === false) {
        setFeedback({
          type: 'error',
          message: result.message || `HTTP ${response.status}`,
        })
        return
      }

      setFeedback({ type: 'success', message: result.message })

      if (typeof onUpdate === 'function') {
        onUpdate(result.current_state)
      }
    } catch (e) {
      setFeedback({ type: 'error', message: `Сеть: ${e.message}` })
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className={s.card} aria-label='Auto-Pilot Controls'>
      <h3 className={s.title}>Auto-Pilot для {feature.name}</h3>
      <p className={s.subtitle}>
        Webhook → n8n AI Agent → MCP M3. Действие занимает ~2–5 сек.
      </p>

      <div className={s.buttonRow}>
        <button
          type='button'
          className={s.button}
          onClick={() => callAutoPilot('check')}
          disabled={loading !== null}
        >
          {loading === 'check' ? 'Проверяем…' : 'Запустить проверку'}
        </button>

        <button
          type='button'
          className={`${s.button} ${s.buttonPrimary}`}
          onClick={() => callAutoPilot('test', { target_state: 'Testing' })}
          disabled={loading !== null}
        >
          {loading === 'test' ? 'Включаем…' : 'Тестовый режим'}
        </button>

        <button
          type='button'
          className={`${s.button} ${s.buttonDanger}`}
          onClick={() => callAutoPilot('rollback', { target_state: 'Disabled' })}
          disabled={loading !== null}
        >
          {loading === 'rollback' ? 'Откатываем…' : 'Откатить фичу'}
        </button>
      </div>

      <div className={s.state}>
        <span className={s.stateLabel}>Текущее состояние:</span>{' '}
        {feature.status} · traffic {feature.traffic}%
      </div>

      {feedback && (
        <div
          className={`${s.alert} ${
            feedback.type === 'success' ? s.alertSuccess : s.alertError
          }`}
          role='alert'
        >
          {feedback.type === 'success' ? '✅' : '⚠️'} {feedback.message}
        </div>
      )}
    </div>
  )
}
