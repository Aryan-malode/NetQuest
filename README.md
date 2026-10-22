# NetQuest — Teacher-Led Classroom Quiz

NetQuest is a small Computer Networks mini-project for a two-person student team to build, present, and explain. A teacher creates one classroom, students join with a room code, and the teacher controls when questions appear and when answers are revealed.

## What the app does

1. The teacher opens NetQuest and creates the room.
2. Students open the same website and join with the code `NETQUEST`.
3. The teacher starts the quiz. The first question appears on all student screens.
4. Each student submits one answer.
5. The teacher reveals the answer and explanation, then moves to the next question.
6. Scores and the final leaderboard update as the quiz goes on.
7. The teacher can reset the room and run another round without making students rejoin.

The project includes eight editable Computer Networks questions and supports up to eight student clients in the demo room.

## Requirements

- Python 3.10 or newer
- Chrome, Edge, Firefox, or another modern browser
- For a two-device demo, connect both devices to the same Wi-Fi/LAN

**No `pip install` is needed.** The server uses Python's built-in HTTP server and other standard-library modules.

## Run on Windows

1. Extract the ZIP to a normal folder, such as `Desktop\NetQuest`.
2. Open the extracted folder.
3. Click the address bar in File Explorer, type `cmd`, and press Enter.
4. Run:

   ```bat
   py server.py
   ```

5. Keep the Command Prompt window open. On the teacher's computer, visit `http://127.0.0.1:5000`.

You may also double-click `run_server.bat`. If Windows blocks the `.bat` file, the manual `py server.py` command above is the simplest option. In PowerShell, `python server.py` may be used if `py` is not available.

## Demo on two or more devices

1. Start the server on the computer acting as the host.
2. On that computer, open `http://127.0.0.1:5000` and select **I'm the teacher**.
3. Create the room using a teacher name. Keep the server terminal running.
4. Find the host computer's IPv4 address with `ipconfig` on Windows.
5. On each student device connected to the same Wi-Fi, visit `http://HOST-IP:5000` using the real IPv4 address in place of `HOST-IP`.
6. Students select **I'm a student**, enter their name, and use room code `NETQUEST`.
7. The teacher starts the quiz and controls the questions.

If another device cannot open the page, allow Python through Windows Firewall on a **Private network** and confirm both devices use the same local network. Some campus or guest Wi-Fi networks isolate devices from one another; in that case, demonstrate both clients on the host computer using separate browser windows.

## Project structure

```text
NetQuest/
├── server.py                 # HTTP server and the API routes
├── game.py                   # Quiz rules, answers, scores and room state
├── questions.py              # Edit the question bank here
├── client/
│   ├── index.html             # Browser page
│   └── assets/
│       ├── styles.css         # Layout and visual design
│       └── app.js             # Teacher/student screens and server requests
├── tests/
│   └── test_game.py           # Tests for the main quiz rules
├── run_server.py              # Optional alternate launcher
├── run_server.bat              # Windows launcher
├── run_server.sh               # Linux/macOS launcher
└── requirements.txt            # Notes that no pip packages are needed
```

## The code in plain English

### `server.py`

This is the front desk. It receives HTTP requests from the browser, checks which action was requested, calls the matching function in `game.py`, and sends the result back as JSON. It also serves the HTML, CSS, and JavaScript files. `ThreadingHTTPServer` lets the server handle requests from different browsers in separate threads.

### `game.py`

This is the quiz logic. It remembers the teacher, students, current question, answers, and scores. It checks rules such as “a student can answer only once” and “the teacher must reveal an answer before moving to the next question.”

### `questions.py`

This is just a list of questions, four options, the correct option's index, and a short explanation. To edit the quiz, change this file instead of changing the server code. Option index `0` means A, `1` means B, `2` means C, and `3` means D.

### `client/assets/app.js`

This controls what appears on screen. It sends requests when the teacher clicks a button or a student submits an answer. It also checks the server about once per second so all browser screens stay up to date.

### `client/assets/styles.css` and `client/index.html`

These handle the page structure and styling. The quiz rules do not live in the CSS or HTML.

## Computer Networks concepts to explain in the viva

- **Client-server model:** the Python program is the server. The teacher's browser and each student's browser are clients.
- **TCP:** browsers communicate with the server using HTTP, which runs over TCP. TCP is suitable because a submitted answer should be delivered reliably.
- **IP address and port:** devices use the host computer's IP address and port `5000` to reach the server.
- **Concurrent clients:** `ThreadingHTTPServer` handles browser requests in separate threads so one client request does not block all other clients.
- **Request-response:** the browser sends a request such as “submit this answer”; the server checks it and returns a JSON response.
- **Shared server state:** the server keeps one copy of the current question and scores, so clients see the same game state.
- **Polling:** every browser requests updated state roughly once per second. This is simple to explain and adequate for a small class demo.

### Why not UDP?

UDP is useful when speed matters more than guaranteed delivery, such as some voice/video or game-state updates. NetQuest needs submitted answers to arrive reliably. Using UDP would mean adding acknowledgements, timeouts, and retransmission logic. TCP already provides reliable, ordered delivery, so it is the simpler choice for this project. The app does not need to use both protocols just to claim that it uses networking.

## API actions (optional for your report)

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/teacher/join` | Create the teacher session |
| `POST` | `/api/student/join` | Join with a name and room code |
| `GET` | `/api/state` | Fetch the current quiz state |
| `POST` | `/api/teacher/start` | Start the quiz |
| `POST` | `/api/student/answer` | Submit a selected option |
| `POST` | `/api/teacher/reveal` | Reveal the correct answer |
| `POST` | `/api/teacher/next` | Move to the next question or finish |
| `POST` | `/api/teacher/reset` | Reset scores for a new round |

## Run the tests

Open Command Prompt in the NetQuest folder and run:

```bat
py -m unittest discover -s tests -v
```

Or use `python -m unittest discover -s tests -v` where `python` is your Python command.

## Limitations worth mentioning honestly

- This is a classroom demo, not a public production service. It has one in-memory room and no account/password system.
- The room and scores are cleared when the server process stops.
- The room code is meant for a trusted classroom demo; it is not a security feature.
- The browser polls the server periodically instead of using WebSockets. That keeps the implementation smaller and easier to explain.
