# NAS deployment

GitHub builds and tests changes, then publishes an image on `main`. The NAS runner sends only its digest and commit to a fixed SSH command. It has no Docker socket, host checkout, or application secrets. Each project has a separate key; SSH denies shells, arbitrary commands, forwarding, and PTYs.

Install `/volume1/nas-control/deploy.py`, the root-owned project configuration, and the restricted keys using `nas/install-deployment-controls.py` from the NAS hardening workspace before merging this workflow. The control files must remain outside all agent and runner write mounts. `deployments.jsonl` under `/volume1/nas-control/state` records attempts and results.

Copy the runner Compose file to its existing NAS runner directory. Register once with a short-lived `RUNNER_REGISTRATION_TOKEN`, then recreate with that variable unset. Registration persists in `runner-config`; do not set `ACCESS_TOKEN` or `EPHEMERAL`. Keep the work and registration volumes. The runner mounts only its own `/volume1/nas-control/runner-keys/geoparty` directory, read-only, plus those volumes.

Install and test the constrained SSH key before removing the old runner. An SSH command such as `id` and a deployment request containing an extra field must both fail. Run a real deployment after switching labels and merging the workflow.

The NAS command owns the application image repository, mounts, ports, environment and health checks. It uses the job's temporary read-only GitHub token to verify the commit belongs to `main`, then pulls by digest and verifies the image revision label. The token passes through stdin and is not retained. On failure it restores the previous image; application data changes are not automatically rolled back. An agent with repository write access can still change application code and workflows. This boundary limits deployments to the app's fixed container permissions; it does not provide human approval or protect the app's own data from malicious application code.
