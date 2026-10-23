# NAS deployment

The [GitHub workflow](../.github/workflows/docker-publish.yml) builds and tests the
[Docker image](../Dockerfile), publishes it to `danickfort/geoparty` on `main`, and
requests deployment by digest through the NAS runner. The workflow requires the
`DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` repository secrets.

The [runner Compose file](github-runner/docker-compose.yml) supplies the
`geoparty-deploy` runner label and mounts the restricted SSH key and known hosts
from `/volume1/nas-control/runner-keys/geoparty`. Register once with a short-lived
`RUNNER_REGISTRATION_TOKEN`, then recreate the runner with that variable unset.
Keep its registration and work volumes.

The fixed deployment command and application configuration live outside this
checkout under `/volume1/nas-control`. The NAS configuration must allow
`danickfort/geoparty`. It owns the application environment, ports, and these
persistent bind mounts:

```text
/volume1/docker/geoparty/geoparty/avatars -> /app/avatars
/volume1/docker/geoparty/geoparty/data    -> /app/data
/volume1/docker/geoparty/geoparty/uploads -> /app/uploads
```

Back up these directories before changing mounts. An empty avatar mount seeds
the example animals instead of restoring existing players. Preserve avatar
filenames because saved scores use them as player identities.

For an existing NAS instance missing the avatar mount, review and run
[`configure-nas-avatar-mount.py`](configure-nas-avatar-mount.py)
on the NAS with `sudo python3`. It validates and backs up the fixed Compose
configuration before adding the mount for the next deployment. After deploying,
verify that saved players are selectable and their avatar images load.
