#!/usr/bin/env python3
"""Test data for the Maestro flows, made with temporary accounts and removed afterwards.

  python3 e2e/fixture.py up      three accounts; three real uploads; one event
  python3 e2e/fixture.py user    one account with nothing in it (for sign-in.yaml, upload.yaml)
  python3 e2e/fixture.py env     prints EMAIL=... PASSWORD=... of the account to sign in with
  python3 e2e/fixture.py down    deletes every temporary account and what it owns

Needs the AWS CLI signed in with the `cvp-dev` profile. Never touches a real account: every
address it creates starts with `e2e-` and ends with `@example.com`, and `down` removes only
those. HTTPS calls go through curl (this Python has no certificate bundle).
"""
import json, os, secrets, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(HERE, '.state.json')
CLIP = os.path.join(HERE, 'clip.mp4')
REGION, PROFILE, TABLE = 'us-east-1', 'cvp-dev', 'cvp-dev-data'


def aws(*args, parse=True):
    out = subprocess.run(['aws', '--profile', PROFILE, '--region', REGION, *args, '--output', 'json'],
                         capture_output=True, text=True)
    if out.returncode:
        raise RuntimeError(out.stderr.strip())
    return json.loads(out.stdout) if parse and out.stdout.strip() else None


def app_settings():
    """The same public ids the app uses, from apps/mobile/.env."""
    values = {}
    for line in open(os.path.join(HERE, '..', '.env')):
        if '=' in line:
            key, _, value = line.strip().partition('=')
            values[key] = value
    return values['EXPO_PUBLIC_API_URL'].rstrip('/'), values['EXPO_PUBLIC_USER_POOL_ID'], values['EXPO_PUBLIC_USER_POOL_CLIENT_ID']


API, POOL, CLIENT = app_settings()
users = {}


def token_of(email, password):
    answer = aws('cognito-idp', 'admin-initiate-auth', '--user-pool-id', POOL, '--client-id', CLIENT,
                 '--auth-flow', 'ADMIN_USER_PASSWORD_AUTH', '--auth-parameters', f'USERNAME={email},PASSWORD={password}')
    return answer['AuthenticationResult']['AccessToken']


def make_user(name, run, group=None):
    email = f'e2e-{run}-{name}@example.com'
    password = 'Ww2!' + secrets.token_urlsafe(14)
    aws('cognito-idp', 'admin-create-user', '--user-pool-id', POOL, '--username', email, '--message-action', 'SUPPRESS',
        '--user-attributes', f'Name=email,Value={email}', 'Name=email_verified,Value=true')
    aws('cognito-idp', 'admin-set-user-password', '--user-pool-id', POOL, '--username', email,
        '--password', password, '--permanent', parse=False)
    if group:
        aws('cognito-idp', 'admin-add-user-to-group', '--user-pool-id', POOL, '--username', email, '--group-name', group, parse=False)
    users[name] = {'email': email, 'password': password, 'token': token_of(email, password)}


def api(who, method, path, body=None):
    cmd = ['curl', '-sS', '-X', method, '-w', '\n%{http_code}', API + path, '-H', 'authorization: Bearer ' + users[who]['token']]
    if body is not None:
        cmd += ['-H', 'content-type: application/json', '-d', json.dumps(body)]
    raw, _, code = subprocess.run(cmd, capture_output=True, text=True).stdout.rpartition('\n')
    try:
        parsed = json.loads(raw) if raw.strip() else None
    except ValueError:
        parsed = None
    return int(code), (parsed if int(code) < 300 else None)


def upload(who, title):
    """A real upload through the API, so the real pipeline makes the playable file and poster."""
    status, started = api(who, 'POST', '/uploads', {'fileName': 'clip.mp4', 'sizeBytes': os.path.getsize(CLIP), 'title': title})
    assert status in (200, 201), status
    video_id = started['videoId']
    for part in api(who, 'GET', f'/uploads/{video_id}/parts')[1]['urls']:
        sent = subprocess.run(['curl', '-sS', '-o', '/dev/null', '-w', '%{http_code}', '-X', 'PUT', '--data-binary', '@' + CLIP, part['url']],
                              capture_output=True, text=True).stdout
        assert sent == '200', sent
    assert api(who, 'POST', f'/uploads/{video_id}/complete')[0] in (200, 202, 204)
    return video_id


def wait_ready(who, video_ids, seconds=240):
    states = {}
    for _ in range(seconds // 5):
        states = {video['id']: video['uploadStatus'] for video in api(who, 'GET', '/videos')[1]['videos']}
        if all(states.get(video_id) in ('ready', 'failed') for video_id in video_ids):
            break
        time.sleep(5)
    assert all(states.get(video_id) == 'ready' for video_id in video_ids), states


def save():
    json.dump({'users': {name: {'email': u['email'], 'password': u['password']} for name, u in users.items()}}, open(STATE, 'w'))


def up():
    run = secrets.token_hex(3)
    try:
        for name, group in [('ana', None), ('ben', None), ('adm', 'admin')]:
            make_user(name, run, group)
        save()
        concert, _waiting, guest = upload('ana', 'Concert clip'), upload('ana', 'Waiting clip'), upload('ben', 'Ben angle')
        wait_ready('ana', [concert, _waiting])
        wait_ready('ben', [guest])
        for video_id in (concert, guest):
            assert api('adm', 'POST', f'/admin/videos/{video_id}/review', {'decision': 'approve'})[0] == 200
        event = api('ana', 'POST', '/events', {'name': 'Test concert'})[1]
        api('ana', 'PUT', f"/videos/{concert}/event", {'eventId': event['id']})
        invite = api('ana', 'PUT', f"/events/{event['id']}/invite")[1]
        api('ben', 'POST', f"/events/{event['id']}/join", {'token': invite['token']})
        api('ben', 'PUT', f"/videos/{guest}/event", {'eventId': event['id']})
        api('ana', 'PUT', f"/events/{event['id']}/order", {'videoIds': [concert, guest]})
    finally:
        save()
    print('ready: sign in as the account printed by `fixture.py env`')


def single_user():
    make_user('ana', secrets.token_hex(3))
    save()
    print('ready: one empty account')


def temporary_usernames():
    listed = aws('cognito-idp', 'list-users', '--user-pool-id', POOL, '--filter', 'email ^= "e2e-"')['Users']
    found = []
    for user in listed:
        email = next(a['Value'] for a in user['Attributes'] if a['Name'] == 'email')
        if email.startswith('e2e-') and email.endswith('@example.com'):
            found.append((user['Username'], email))
    return found


def down():
    """Removes every temporary account with its videos, files, events and rows."""
    known = json.load(open(STATE))['users'] if os.path.exists(STATE) else {}
    passwords = {u['email']: u['password'] for u in known.values()}
    accounts = temporary_usernames()
    signed_in = []
    for index, (username, email) in enumerate(accounts):
        password = passwords.get(email)
        if password is None:
            # Left behind by an interrupted run: give it a password we know, to clean up as it.
            password = 'Ww2!' + secrets.token_urlsafe(14)
            aws('cognito-idp', 'admin-set-user-password', '--user-pool-id', POOL, '--username', username,
                '--password', password, '--permanent', parse=False)
        name = f'user{index}'
        users[name] = {'email': email, 'password': password, 'token': token_of(email, password)}
        signed_in.append((name, username))
    # Through the API, so files are deleted and storage is given back; videos before events,
    # because only an empty event can be deleted.
    for name, _ in signed_in:
        for video in (api(name, 'GET', '/videos')[1] or {'videos': []})['videos']:
            if video['uploadStatus'] == 'uploading':
                api(name, 'DELETE', f"/uploads/{video['id']}")
            else:
                api(name, 'DELETE', f"/videos/{video['id']}")
    for name, _ in signed_in:
        for event in (api(name, 'GET', '/events')[1] or {'mine': []})['mine']:
            api(name, 'DELETE', f"/events/{event['id']}")
    for name, username in signed_in:
        rows = aws('dynamodb', 'query', '--table-name', TABLE, '--key-condition-expression', 'PK = :p',
                   '--expression-attribute-values', json.dumps({':p': {'S': f'USER#{username}'}}), '--projection-expression', 'PK,SK')
        for row in rows['Items']:
            aws('dynamodb', 'delete-item', '--table-name', TABLE, '--key', json.dumps(row), parse=False)
        left = aws('dynamodb', 'query', '--table-name', TABLE, '--index-name', 'GSI1', '--key-condition-expression', 'GSI1PK = :p',
                   '--expression-attribute-values', json.dumps({':p': {'S': f'OWNER#{username}'}}), '--select', 'COUNT')['Count']
        if left:
            print(f'  warning: {left} video rows of a temporary account are still there')
        aws('cognito-idp', 'admin-delete-user', '--user-pool-id', POOL, '--username', username, parse=False)
    if os.path.exists(STATE):
        os.remove(STATE)
    print('temporary accounts left:', len(temporary_usernames()))


def env():
    account = json.load(open(STATE))['users']['ana']
    print(f"EMAIL={account['email']}\nPASSWORD='{account['password']}'")


if __name__ == '__main__':
    {'up': up, 'user': single_user, 'down': down, 'env': env}[sys.argv[1]]()
