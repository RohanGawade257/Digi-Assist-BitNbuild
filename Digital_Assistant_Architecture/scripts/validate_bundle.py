"""Static blueprint checks only; this does not test the future application."""
from pathlib import Path
import re
import json
import hashlib
from zipfile import ZipFile

root = Path(__file__).resolve().parents[1]
env_text = (root / '.env.example').read_text(encoding='utf-8')
keys = re.findall(r'^([A-Z][A-Z0-9_]*)=', env_text, re.M)
assert len(keys) == len(set(keys)), 'Duplicate environment variable'
for provider, count in [('GEMINI', 4), ('SARVAM', 3)]:
    actual = {k for k in keys if re.fullmatch(provider + r'_API_KEY_\d+', k)}
    expected = {f'{provider}_API_KEY_{i}' for i in range(1, count + 1)}
    assert actual == expected, f'Wrong slots for {provider}'
    for key in actual:
        assert re.search(r'^' + key + r'=$', env_text, re.M), 'Example key must be blank'

for document in root.rglob('*.md'):
    text = document.read_text(encoding='utf-8')
    assert text.count('```') % 2 == 0, f'Unbalanced fences: {document}'
    for target in re.findall(r'\]\(([^)]+)\)', text):
        if target.startswith(('https://', 'http://', '#')):
            continue
        assert (document.parent / target.split('#')[0]).exists(), f'Broken local link: {target}'

try:
    import yaml
except ImportError:
    print('YAML parser not installed; YAML parse check skipped. Run Docker Compose validation separately.')
else:
    for path in [root / 'compose.yaml', root / 'docker/compose.app.template.yaml']:
        obj = yaml.safe_load(path.read_text())
        assert isinstance(obj.get('services'), dict)
    base = yaml.safe_load((root / 'compose.yaml').read_text())
    assert set(base['services']) == {'mongo'}, 'Base must be infrastructure-only'
    assert base['services']['mongo']['ports'] == ['127.0.0.1:27017:27017']
    overlay = yaml.safe_load((root / 'docker/compose.app.template.yaml').read_text())
    web, api = overlay['services']['web'], overlay['services']['api']
    assert 'env_file' not in web and 'env_file' not in api
    assert all(k.startswith('NEXT_PUBLIC_') for k in web['environment'])
    assert not any(k.startswith('NEXT_PUBLIC_') for k in api['environment'])
    assert '/api/v1/ready' in ' '.join(api['healthcheck']['test'])
    assert '/api/v1/ready' in (root / 'docs/API_Contracts.md').read_text()
    assert api['depends_on']['mongo']['condition'] == 'service_healthy'
    assert web['depends_on']['api']['condition'] == 'service_healthy'
    mount = next(v for v in api['volumes'] if v['target'] == '/app/config/quota-policy.json')
    assert mount['read_only'] is True and mount['bind']['create_host_path'] is False
    assert api['environment']['QUOTA_POLICY_PATH'] == mount['target']
    assert 'TURN_DEADLINE_MS' not in api['environment']
    assert 'TURN_EXECUTION_DEADLINE_MS' in api['environment']
    assert 'TURN_MAX_EXTRA_RETRIES' in api['environment']
    for k in api['environment']:
        assert k in keys, f'Undocumented API environment key: {k}'
    print('PASS: public/secret environment separation, readiness agreement and quota mount.')
    print('YAML parses; base contains only localhost-bound MongoDB.')

assert (root / 'REVISION').read_text().strip() == '3'
policy = json.loads((root / 'config/quota-policy.example.json').read_text())
assert policy['verified'] is False, 'Unverified quota example must fail closed'
assert {g['id'] for g in policy['groups']} == {'gemini-project-main', 'sarvam-account-main'}
assert 'TURN_DEADLINE_MS' not in keys
for fname in ['Project_Overview.md', 'Digital_Assistant_Architecture.docx',
              'docs/System_Diagrams.md', 'docs/Accessibility_and_Privacy.md', 'CHANGELOG.md']:
    assert (root / fname).is_file(), f'Missing deliverable: {fname}'
with ZipFile(root / 'Digital_Assistant_Architecture.docx') as doc:
    assert doc.testzip() is None
    assert 'word/document.xml' in doc.namelist()
manifest = root / 'MANIFEST.sha256'
if manifest.exists():
    for line in manifest.read_text().splitlines():
        digest, name = line.split('  ', 1)
        assert hashlib.sha256((root / name).read_bytes()).hexdigest() == digest, f'Changed file: {name}'
    print('PASS: SHA-256 manifest matches package files.')
print('PASS: credential slot counts, blank keys, unique env names, Markdown links and fences.')
