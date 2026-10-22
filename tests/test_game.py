import unittest

from game import GameError, QuizGame


class NetQuestTests(unittest.TestCase):
    def setUp(self):
        self.game = QuizGame()
        self.teacher = self.game.teacher_join("Teacher")['teacher_id']
        self.student1 = self.game.student_join("Alex", "NETQUEST")['player_id']
        self.student2 = self.game.student_join("Sam", "NETQUEST")['player_id']

    def test_teacher_controls_when_quiz_starts(self):
        self.assertEqual(self.game.get_state("student", self.student1)['status'], "waiting")
        self.game.start_quiz(self.teacher)
        self.assertEqual(self.game.get_state("student", self.student1)['status'], "active")

    def test_student_cannot_answer_before_quiz_starts(self):
        with self.assertRaises(GameError):
            self.game.submit_answer(self.student1, 0, 1)

    def test_correct_answer_scores_100_and_second_answer_is_rejected(self):
        self.game.start_quiz(self.teacher)
        self.game.submit_answer(self.student1, 0, 1)  # TCP is the correct answer to question 1.
        with self.assertRaises(GameError):
            self.game.submit_answer(self.student1, 0, 0)
        state = self.game.get_state("student", self.student1)
        self.assertEqual(state['you']['score'], 100)

    def test_teacher_must_reveal_before_next_question(self):
        self.game.start_quiz(self.teacher)
        with self.assertRaises(GameError):
            self.game.next_question(self.teacher)
        self.game.reveal_answer(self.teacher)
        self.game.next_question(self.teacher)
        self.assertEqual(self.game.get_state("student", self.student1)['question']['number'], 2)

    def test_student_cannot_see_correct_answer_before_reveal(self):
        self.game.start_quiz(self.teacher)
        state = self.game.get_state("student", self.student1)
        self.assertNotIn("correct_index", state['question'])
        self.game.reveal_answer(self.teacher)
        state = self.game.get_state("student", self.student1)
        self.assertEqual(state['question']['correct_index'], 1)

    def test_room_code_and_duplicate_names_are_checked(self):
        with self.assertRaises(GameError):
            self.game.student_join("Taylor", "WRONG")
        with self.assertRaises(GameError):
            self.game.student_join("alex", "NETQUEST")

    def test_reset_keeps_people_in_room_but_clears_scores(self):
        self.game.start_quiz(self.teacher)
        self.game.submit_answer(self.student1, 0, 1)
        self.game.reveal_answer(self.teacher)
        self.game.next_question(self.teacher)
        self.game.reveal_answer(self.teacher)
        self.game.next_question(self.teacher)
        self.game.reset_round(self.teacher)
        state = self.game.get_state("student", self.student1)
        self.assertEqual(state['status'], "waiting")
        self.assertEqual(state['you']['score'], 0)
        self.assertEqual(state['student_count'], 2)


if __name__ == "__main__":
    unittest.main()
