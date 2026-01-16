const express = require("express");
const router = express.Router();
const db = require("../db");

/* ================= CHECK ATTEMPT ================= */
router.get("/attempted/:studentId/:examId", (req, res) => {
    db.query(
        `SELECT result_id FROM results WHERE student_id = ? AND exam_id = ?`,
        [req.params.studentId, req.params.examId],
        (err, rows) => {
            if (err) return res.json({ attempted: false });
            res.json({ attempted: rows.length > 0 });
        }
    );
});

/* ================= FETCH QUESTIONS ================= */
router.get("/questions/:examId", (req, res) => {
    db.query(
        `SELECT question_id, question_text, option_a, option_b, option_c, option_d
         FROM questions WHERE exam_id = ?`,
        [req.params.examId],
        (err, rows) => {
            if (err) return res.json([]);
            res.json(rows);
        }
    );
});

/* ================= SUBMIT EXAM ================= */
router.post("/submit", (req, res) => {
    const { studentId, examId, answers } = req.body;

    if (!answers || answers.length === 0) {
        return res.json({ success: false });
    }

    db.query(
        `SELECT result_id FROM results WHERE student_id = ? AND exam_id = ?`,
        [studentId, examId],
        (err, rows) => {
            if (rows && rows.length > 0) {
                return res.json({ success: false });
            }

            const sql = `
                INSERT INTO student_answers
                (student_id, question_id, selected_option, exam_id)
                VALUES (?, ?, ?, ?)
            `;

            answers.forEach(a => {
                db.query(sql, [
                    studentId,
                    a.question_id,
                    a.selected_option,
                    examId
                ]);
            });

            db.query(
                `INSERT INTO results (student_id, exam_id, attempt_status)
                 VALUES (?, ?, 'SUBMITTED')`,
                [studentId, examId],
                () => res.json({
                    success: true,
                    message: "Exam submitted successfully"
                })
            );
        }
    );
});

module.exports = router;
