"""HTTP behavior and complete generated-site link checks, without external requests."""
import importlib.util
import threading
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('preview', ROOT / 'scripts/preview-site.py')
preview = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preview)

class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.links = []
    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in ('href', 'src') and value: self.links.append(value)

class SiteHTTP(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        preview.Preview.log_message = lambda *_: None
        cls.server = preview.ThreadingHTTPServer(('127.0.0.1', 0), preview.Preview)
        cls.base = f'http://127.0.0.1:{cls.server.server_port}'
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True); cls.thread.start()
    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown(); cls.server.server_close(); cls.thread.join()
    def test_html_and_markdown(self):
        with urlopen(self.base + '/ar/guide/') as response:
            self.assertIn('text/html', response.headers['Content-Type'])
            self.assertIn(b'data-ga4=""', response.read())
        with urlopen(Request(self.base + '/guide/', headers={'Accept': 'text/markdown'})) as response:
            self.assertIn('text/markdown', response.headers['Content-Type'])
            self.assertIn(b'Claude', response.read())
    def test_repository_files_inaccessible(self):
        for path in ['/.git/config', '/package.json', '/%2e%2e/package.json', '/feedback/worker/.dev.vars.staging']:
            with self.assertRaises(HTTPError) as failure: urlopen(self.base + path)
            self.assertEqual(failure.exception.code, 404)
    def test_all_generated_links(self):
        pages = list((ROOT / 'site-dist').rglob('index.html'))
        self.assertEqual(len(pages), 335)
        missing = set()
        for page in pages:
            parser = Links(); parser.feed(page.read_text(encoding='utf-8'))
            for link in parser.links:
                url = urlsplit(link)
                if url.scheme and url.netloc != 'claude-audio-controls.infoxica.com': continue
                if link.startswith('#') or url.scheme in ('data', 'mailto'): continue
                path = unquote(url.path)
                if path == '/feedback': continue  # Served by the Worker.
                target = (ROOT / 'site-dist' / path.lstrip('/')) if path.startswith('/') else page.parent / path
                if target.is_dir(): target /= 'index.html'
                if not target.is_file(): missing.add(path)
        self.assertEqual(missing, set())

if __name__ == '__main__': unittest.main()
