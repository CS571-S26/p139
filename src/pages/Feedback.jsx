import { useState, useEffect, useRef } from 'react'
import { Form, Button } from 'react-bootstrap'
import { useSocket } from '../contexts/SocketContext'

export default function Feedback() {
  const { sendFeedback } = useSocket()
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState(null) // { kind: 'ok' | 'err', text: string } | null
  const resetTimerRef = useRef(null)

  useEffect(() => () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = message.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    setStatus(null)
    const result = await sendFeedback({ name: name.trim(), message: trimmed })
    setSubmitting(false)
    if (result?.ok) {
      setStatus({ kind: 'ok', text: 'Thanks, we got it!' })
      setName('')
      setMessage('')
      resetTimerRef.current = setTimeout(() => setStatus(null), 5000)
    } else {
      setStatus({ kind: 'err', text: result?.error || 'Could not send. Try again.' })
    }
  }

  const remaining = 1000 - message.length
  const canSubmit = !submitting && message.trim().length > 0

  return (
    <div className="home">
      <div className="home-card home-card-wide">
        <div className="icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </div>
        <h1 className="h1">Send feedback</h1>
        <p className="sub">Found a bug? Want a feature? Tell us.</p>
        <Form className="form" onSubmit={handleSubmit}>
          <Form.Group className="field" controlId="fb-name">
            <Form.Label className="lbl">Name <span className="lbl-meta">(optional)</span></Form.Label>
            <Form.Control
              className="inp"
              placeholder="e.g. Alex"
              maxLength={30}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Form.Group>
          <Form.Group className="field" controlId="fb-msg">
            <Form.Label className="lbl">Message</Form.Label>
            <Form.Control
              as="textarea"
              className="inp"
              placeholder="Tell us what's on your mind…"
              maxLength={1000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
            <div className="feedback-counter">{message.length} / 1000</div>
          </Form.Group>
          <Button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            {submitting ? 'Sending…' : 'Send feedback'}
          </Button>
          <p className={'feedback-status' + (status ? ' ' + status.kind : '')}>
            {status?.text || ''}
          </p>
        </Form>
      </div>
    </div>
  )
}
