/**
 * Post a message to a Slack Workflow Builder incoming webhook. The URL comes
 * from SLACK_WEBHOOK_URL (read at call time so config can change without a
 * rebuild) and the message is sent as the workflow's `text` variable. No token
 * or channel is needed — the workflow decides which channel to post to. A
 * successful POST returns HTTP 2xx (the body may be empty or plain "ok").
 */
export async function postToSlack(text: string): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.SLACK_WEBHOOK_URL
  if (!url) return { ok: false, error: 'slack_not_configured' }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) return { ok: false, error: `http_${res.status}` }
    return { ok: true }
  } catch (err) {
    console.error('slack: post failed', err)
    return { ok: false, error: 'network_error' }
  }
}
