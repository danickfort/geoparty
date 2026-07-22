# NAS self-hosted runner

Runs the `deploy` job of `.github/workflows/docker-publish.yml` on the NAS. It
connects **outbound** to GitHub (no inbound ports, no SSH), and deploys by
pulling `danickfort/geoparty:latest` from Docker Hub and recreating the
`geoparty` container.

## Setup

```sh
# on the NAS, e.g. /volume1/docker/github-runner
cp .env.example .env
# edit .env: paste a GitHub PAT into RUNNER_ACCESS_TOKEN
/usr/local/bin/docker-compose up -d
```

The runner then appears under **GitHub → repo → Settings → Actions → Runners**
with the label `nas`.

## Required GitHub repository secrets

Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `DOCKERHUB_USERNAME` | `danickfort` |
| `DOCKERHUB_TOKEN` | Docker Hub access token (read/write) |
| `ADMIN_PASSWORD` | `dev` |
| `SLACK_WEBHOOK_URL` | the Slack Workflow Builder webhook URL |

## Security

- Keep the repository **private**. Self-hosted runners on public repos let fork
  PRs run code on your NAS.
- The `deploy` job is push-only and does not check out code — untrusted PR code
  never runs on the runner.
- The runner has access to the host Docker socket (root-equivalent). Only use it
  for this trusted repo.
