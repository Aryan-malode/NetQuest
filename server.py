"""NetQuest web server. Uses Python's built-in HTTP server (no packages to install)."""

import json
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

from game import GameError, QuizGame

BASE_DIR = Path(__file__).resolve().parent
CLIENT_DIR = BASE_DIR / "client"
game = QuizGame()


class NetQuestHandler(BaseHTTPRequestHandler):
    """Receives browser requests and passes quiz actions to QuizGame."""

    def send_data(self, status, data, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def send_json(self, status, data):
        body = json.dumps(data).encode("utf-8")
        self.send_data(status, body, "application/json; charset=utf-8")

    def read_json(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 <= length <= 100_000:
                raise ValueError
            data = json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(data, dict):
                raise ValueError
            return data
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError):
            raise GameError("Please send a valid JSON object.")

    def serve_file(self, path):
        # Keep file access inside the client folder.
        try:
            path = path.resolve()
            path.relative_to(CLIENT_DIR.resolve())
        except ValueError:
            self.send_data(404, b"Not found", "text/plain; charset=utf-8")
            return
        if not path.is_file():
            self.send_data(404, b"Not found", "text/plain; charset=utf-8")
            return
        content_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        if content_type.startswith("text/") or content_type in ("application/javascript", "application/json"):
            content_type += "; charset=utf-8"
        self.send_data(200, path.read_bytes(), content_type)

    def do_GET(self):  # noqa: N802 - required name for HTTP handler
        url = urlsplit(self.path)
        if url.path == "/":
            self.serve_file(CLIENT_DIR / "index.html")
            return
        if url.path.startswith("/assets/"):
            name = unquote(url.path[len("/assets/"):])
            self.serve_file(CLIENT_DIR / "assets" / name)
            return
        if url.path == "/api/state":
            query = parse_qs(url.query)
            role = query.get("role", [""])[0]
            session_id = query.get("id", [""])[0]
            try:
                self.send_json(200, game.get_state(role, session_id))
            except GameError as error:
                self.send_json(error.status, {"error": error.message})
            return
        self.send_data(404, b"Not found", "text/plain; charset=utf-8")

    def do_POST(self):  # noqa: N802 - required name for HTTP handler
        try:
            data = self.read_json()
            path = urlsplit(self.path).path

            if path == "/api/teacher/join":
                result = game.teacher_join(data.get("name"))
            elif path == "/api/student/join":
                result = game.student_join(data.get("name"), data.get("room_code"))
            elif path == "/api/teacher/start":
                result = game.start_quiz(data.get("teacher_id"))
            elif path == "/api/teacher/reveal":
                result = game.reveal_answer(data.get("teacher_id"))
            elif path == "/api/teacher/next":
                result = game.next_question(data.get("teacher_id"))
            elif path == "/api/teacher/reset":
                result = game.reset_round(data.get("teacher_id"))
            elif path == "/api/student/answer":
                result = game.submit_answer(
                    data.get("player_id"), data.get("question_index"), data.get("choice_index")
                )
            else:
                self.send_json(404, {"error": "That action does not exist."})
                return

            self.send_json(200, result)
        except GameError as error:
            self.send_json(error.status, {"error": error.message})

    def log_message(self, format_string, *args):
        # Keep the terminal readable during a classroom demo.
        print("[HTTP] " + format_string % args)


def main():
    host = "0.0.0.0"
    port = 5000
    server = ThreadingHTTPServer((host, port), NetQuestHandler)
    print("\nNetQuest is running.")
    print("On this computer: http://127.0.0.1:5000")
    print("For another device, use this computer's IPv4 address and port 5000.")
    print("Press Ctrl+C to stop the server.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping NetQuest...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
