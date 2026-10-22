"""The small set of rules that runs a NetQuest classroom quiz."""

from copy import deepcopy
import secrets
from threading import Lock

from questions import QUESTIONS

ROOM_CODE = "NETQUEST"
MAX_STUDENTS = 8


class GameError(Exception):
    """An expected error that can be shown to the user."""

    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


class QuizGame:
    """Stores one teacher-led quiz in memory."""

    def __init__(self):
        self.lock = Lock()
        self.questions = deepcopy(QUESTIONS)
        self.teacher_id = None
        self.teacher_name = ""
        self.students = {}       # student_id -> student details
        self.status = "waiting"  # waiting, active, finished
        self.question_index = -1
        self.revealed = False
        self.answers = {}        # question_index -> {student_id -> answer details}

    def _clean_name(self, name):
        if not isinstance(name, str) or not name.strip():
            raise GameError("Please enter your name.")
        name = " ".join(name.split())
        if len(name) > 24:
            raise GameError("Please use 24 characters or fewer for your name.")
        return name

    def teacher_join(self, name):
        with self.lock:
            if self.teacher_id is not None:
                raise GameError("A teacher has already created this room. Restart the server for a fresh room.", 409)
            name = self._clean_name(name)
            self.teacher_id = secrets.token_urlsafe(12)
            self.teacher_name = name
            return {"teacher_id": self.teacher_id, "name": name, "room_code": ROOM_CODE}

    def student_join(self, name, room_code):
        with self.lock:
            if self.teacher_id is None:
                raise GameError("Ask the teacher to create the room first.", 409)
            if not isinstance(room_code, str) or room_code.strip().upper() != ROOM_CODE:
                raise GameError("That room code is not correct.")
            if self.status != "waiting":
                raise GameError("The quiz has already started. Ask the teacher to reset the room before joining.", 409)
            if len(self.students) >= MAX_STUDENTS:
                raise GameError(f"This demo room is full ({MAX_STUDENTS} students maximum).", 409)

            name = self._clean_name(name)
            names = [student["name"].casefold() for student in self.students.values()]
            if name.casefold() in names or name.casefold() == self.teacher_name.casefold():
                raise GameError("That name is already being used in this room. Try another one.", 409)

            student_id = secrets.token_urlsafe(12)
            self.students[student_id] = {"name": name, "score": 0, "correct": 0}
            return {"player_id": student_id, "name": name, "room_code": ROOM_CODE}

    def _check_teacher(self, teacher_id):
        if not self.teacher_id or teacher_id != self.teacher_id:
            raise GameError("Teacher session not found. Please create the room again.", 401)

    def _check_student(self, player_id):
        if not isinstance(player_id, str) or player_id not in self.students:
            raise GameError("Student session not found. Please join the room again.", 401)
        return self.students[player_id]

    def start_quiz(self, teacher_id):
        with self.lock:
            self._check_teacher(teacher_id)
            if self.status != "waiting":
                raise GameError("The quiz is already running.", 409)
            if not self.students:
                raise GameError("At least one student must join before you start.", 409)
            self.status = "active"
            self.question_index = 0
            self.revealed = False
            return {"ok": True}

    def submit_answer(self, player_id, question_index, choice_index):
        with self.lock:
            student = self._check_student(player_id)
            if self.status != "active":
                raise GameError("The teacher has not started the quiz or has finished it.", 409)
            if self.revealed:
                raise GameError("The answer has been revealed. Wait for the next question.", 409)
            if question_index != self.question_index:
                raise GameError("This question has changed. Please answer the question on your screen.", 409)

            question = self.questions[self.question_index]
            if not isinstance(choice_index, int) or isinstance(choice_index, bool):
                raise GameError("Please select one of the answer options.")
            if not 0 <= choice_index < len(question["options"]):
                raise GameError("That answer option does not exist.")

            current_answers = self.answers.setdefault(self.question_index, {})
            if player_id in current_answers:
                raise GameError("Your answer is already submitted.", 409)

            is_correct = choice_index == question["answer"]
            points = 100 if is_correct else 0
            current_answers[player_id] = {
                "choice_index": choice_index,
                "choice_text": question["options"][choice_index],
                "correct": is_correct,
                "points": points,
            }
            student["score"] += points
            if is_correct:
                student["correct"] += 1
            return {"ok": True, "message": "Answer submitted."}

    def reveal_answer(self, teacher_id):
        with self.lock:
            self._check_teacher(teacher_id)
            if self.status != "active":
                raise GameError("There is no active question to reveal.", 409)
            self.revealed = True
            return {"ok": True}

    def next_question(self, teacher_id):
        with self.lock:
            self._check_teacher(teacher_id)
            if self.status != "active" or not self.revealed:
                raise GameError("Reveal the current answer before moving on.", 409)
            if self.question_index == len(self.questions) - 1:
                self.status = "finished"
            else:
                self.question_index += 1
                self.revealed = False
            return {"ok": True}

    def reset_round(self, teacher_id):
        with self.lock:
            self._check_teacher(teacher_id)
            self.status = "waiting"
            self.question_index = -1
            self.revealed = False
            self.answers = {}
            for student in self.students.values():
                student["score"] = 0
                student["correct"] = 0
            return {"ok": True}

    def get_state(self, role, session_id):
        with self.lock:
            is_teacher = role == "teacher"
            if is_teacher:
                self._check_teacher(session_id)
            elif role == "student":
                self._check_student(session_id)
            else:
                raise GameError("Choose teacher or student mode.")

            student_names = {student_id: student["name"] for student_id, student in self.students.items()}
            board = [
                {"name": student["name"], "score": student["score"], "correct": student["correct"]}
                for student in self.students.values()
            ]
            board.sort(key=lambda player: (-player["score"], -player["correct"], player["name"].casefold()))

            current_answers = self.answers.get(self.question_index, {})
            response_list = []
            for student_id, answer in current_answers.items():
                response_list.append({
                    "name": student_names[student_id],
                    "choice_text": answer["choice_text"],
                    "correct": answer["correct"] if (is_teacher or self.revealed) else None,
                    "points": answer["points"] if (is_teacher or self.revealed) else None,
                })
            response_list.sort(key=lambda response: response["name"].casefold())

            question_view = None
            if self.status == "active" and self.question_index >= 0:
                question = self.questions[self.question_index]
                question_view = {
                    "index": self.question_index,
                    "number": self.question_index + 1,
                    "total": len(self.questions),
                    "text": question["text"],
                    "options": list(question["options"]),
                }
                if is_teacher or self.revealed:
                    question_view["correct_index"] = question["answer"]
                    question_view["explanation"] = question["explanation"]

            my_answer = current_answers.get(session_id) if role == "student" else None
            return {
                "role": role,
                "status": self.status,
                "room_code": ROOM_CODE,
                "teacher_name": self.teacher_name,
                "student_count": len(self.students),
                "students": [{"name": s["name"], "score": s["score"], "correct": s["correct"]} for s in self.students.values()],
                "leaderboard": board,
                "question": question_view,
                "revealed": self.revealed,
                "answered_count": len(current_answers),
                "responses": response_list if (is_teacher or self.revealed) else [],
                "your_answer": my_answer["choice_index"] if my_answer else None,
                "you": ({"name": self.teacher_name} if is_teacher else {
                    "name": self.students[session_id]["name"],
                    "score": self.students[session_id]["score"],
                    "correct": self.students[session_id]["correct"],
                }),
                "total_questions": len(self.questions),
            }
