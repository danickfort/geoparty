/**
 * A round image URL that Slack itself can fetch (to unfurl a preview): only
 * absolute http(s) URLs qualify — uploaded images are relative `/uploads/...`
 * paths served by this (usually non-public) server.
 */
export function publicImageUrl(url: string | null | undefined): string | undefined {
  return url && /^https?:\/\//i.test(url) ? url : undefined
}

/**
 * Post a message to a Slack Workflow Builder incoming webhook. The URL comes
 * from SLACK_WEBHOOK_URL (read at call time so config can change without a
 * rebuild) and the message is sent as the workflow's `text` variable, with the
 * round photo as `image_url` (always present — a workflow that declares the
 * variable fails on a missing key — but empty when there's no public image).
 * No token or channel is needed — the workflow decides which channel to post
 * to. A successful POST returns HTTP 2xx (the body may be empty or plain "ok").
 */
export async function postToSlack(
  text: string,
  imageUrl?: string,
): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.SLACK_WEBHOOK_URL
  if (!url) return { ok: false, error: 'slack_not_configured' }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, image_url: imageUrl ?? '' }),
    })
    if (!res.ok) return { ok: false, error: `http_${res.status}` }
    return { ok: true }
  } catch (err) {
    console.error('slack: post failed', err)
    return { ok: false, error: 'network_error' }
  }
}
