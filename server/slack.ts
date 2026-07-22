/**
 * Post a message to Slack via chat.postMessage. Credentials come from the
 * SLACK_BOT_TOKEN / SLACK_CHANNEL env vars (read at call time so config can
 * change without a rebuild). The API returns HTTP 200 even on logical failure,
 * so the JSON `ok` flag is what actually matters.
 */
export async function postToSlack(text: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.SLACK_BOT_TOKEN
  const channel = process.env.SLACK_CHANNEL
  if (!token || !channel) return { ok: false, error: 'slack_not_configured' }

  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({ channel, text }),
    })
    const body = (await res.json()) as { ok: boolean; error?: string }
    return body.ok ? { ok: true } : { ok: false, error: body.error ?? 'slack_error' }
  } catch (err) {
    console.error('slack: post failed', err)
    return { ok: false, error: 'network_error' }
  }
}
