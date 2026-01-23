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

/* ================= EXAM RESULT ================= */
router.post("/result", (req, res) => {
    const { studentId, examId } = req.body;

    if (!studentId || !examId) {
        return res.json({ success: false, message: "Missing student or exam" });
    }

    db.query(
        `SELECT COUNT(*) AS total FROM questions WHERE exam_id = ?`,
        [examId],
        (err, totalRows) => {
            if (err) {
                console.error("Result total error:", err);
                return res.json({ success: false, message: "Server error" });
            }

            const total = totalRows?.[0]?.total || 0;
            if (total === 0) {
                return res.json({ success: false, message: "No questions found" });
            }

            db.query(
                `
                SELECT COUNT(*) AS correct
                FROM student_answers sa
                JOIN questions q ON sa.question_id = q.question_id
                WHERE sa.student_id = ? AND sa.exam_id = ? AND sa.selected_option = q.correct_answer
                `,
                [studentId, examId],
                (err2, correctRows) => {
                    if (err2) {
                        console.error("Result correct error:", err2);
                        return res.json({ success: false, message: "Server error" });
                    }

                    const correct = correctRows?.[0]?.correct || 0;

                    db.query(
                        `
                        SELECT ev.cutoff_percentage
                        FROM exams e
                        JOIN exam_event ev ON ev.event_id = e.event_id
                        WHERE e.exam_id = ?
                        `,
                        [examId],
                        (err3, cutoffRows) => {
                            if (err3) {
                                console.error("Result cutoff error:", err3);
                                return res.json({ success: false, message: "Server error" });
                            }

                            const cutoff = Number(cutoffRows?.[0]?.cutoff_percentage || 0);
                            const scorePercent = total > 0 ? (correct / total) * 100 : 0;
                            const resultStatus = scorePercent >= cutoff ? "PASS" : "FAIL";

                            res.json({
                                success: true,
                                totalMarks: `${correct}/${total}`,
                                resultStatus
                            });
                        }
                    );
                }
            );
        }
    );
});

module.exports = router;
