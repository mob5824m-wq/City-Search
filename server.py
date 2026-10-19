#!/usr/bin/env python3
"""Tiny static server for Ledger KW.

No dependencies. Binds 0.0.0.0 so the dev preview proxy can reach it.

    python3 server.py            # http://localhost:8000
    PORT=3000 python3 server.py
"""

from __future__ import annotations

import os
import posixpath
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", "8000"))


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript; charset=utf-8",
        ".mjs": "text/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".svg": "image/svg+xml",
        ".woff2": "font/woff2",
        ".css": "text/css; charset=utf-8",
        ".webmanifest": "application/manifest+json",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-cache, must-revalidate")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        super().end_headers()

    def do_GET(self) -> None:  # noqa: N802
        if urlparse(self.path).path == "/health":
            body = b"ok\n"
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def translate_path(self, path: str) -> str:
        # Keep every request inside ROOT, even with encoded traversal tricks.
        path = urlparse(path).path
        path = posixpath.normpath(unquote(path))
        parts = [p for p in path.split("/") if p and p not in (".", "..")]
        return os.path.join(ROOT, *parts)

    def log_message(self, fmt: str, *args) -> None:
        print(f"[ledger] {self.address_string()} {fmt % args}")


def main() -> None:
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Ledger KW → http://localhost:{PORT}")
    print(f"Serving {ROOT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
