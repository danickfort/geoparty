import datetime
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

if os.geteuid() != 0:
    raise SystemExit('Run this helper through sudo.')

config = Path('/volume1/nas-control/geoparty/compose.json')
source = Path('/volume1/docker/geoparty/geoparty/avatars')
destination = '/app/avatars'
if not source.is_dir() or not any(source.iterdir()):
    raise SystemExit('Existing host avatars were not found. No configuration changed.')
before = config.read_bytes()
data = json.loads(before)
volumes = data['services']['geoparty'].setdefault('volumes', [])
expected = str(source) + ':' + destination
existing = [v for v in volumes if (isinstance(v, str) and v.split(':')[1:2] == [destination]) or (isinstance(v, dict) and v.get('target') == destination)]
if existing == [expected]:
    print('The persistent avatar mount is already configured.')
    raise SystemExit(0)
if existing:
    raise SystemExit('A different avatar mount already exists. No configuration changed.')
volumes.append(expected)

docker = '/usr/local/bin/docker'
image = subprocess.check_output([docker, 'inspect', 'geoparty', '--format', '{{.Config.Image}}'], text=True).strip()
stat = config.stat()
fd, temporary = tempfile.mkstemp(prefix='.avatar-mount-', suffix='.json', dir=config.parent)
try:
    with os.fdopen(fd, 'w') as handle:
        json.dump(data, handle, indent=2)
        handle.write('\n')
    os.chmod(temporary, stat.st_mode & 0o777)
    os.chown(temporary, stat.st_uid, stat.st_gid)
    subprocess.run([docker, 'compose', '--project-name', 'geoparty', '--env-file', '/dev/null', '-f', temporary, 'config', '--quiet'], env={**os.environ, 'DEPLOY_IMAGE': image}, check=True)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup = Path('/volume1/nas-control/backups') / ('geoparty-avatar-mount-' + stamp)
    backup.mkdir(mode=0o700)
    shutil.copy2(config, backup / 'compose.json')
    os.chmod(backup / 'compose.json', 0o600)
    if config.read_bytes() != before:
        raise SystemExit('Configuration changed during validation. No configuration replaced.')
    os.replace(temporary, config)
    print('Persistent avatar mount added. Configuration backup: ' + str(backup))
    print('It will take effect on the next standard deployment. No restart was performed.')
finally:
    if os.path.exists(temporary):
        os.unlink(temporary)
