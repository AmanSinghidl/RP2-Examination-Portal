const express = require("express");
const path = require("path");
const router = express.Router();
const db = require("../db");
const { generateQuestionsForCourse } = require("../Generator");

/* ================= ADMIN LOGIN PAGE ================= */
router.get("/", (req, res) => {
    res.sendFile(
        path.join(__dirname, "../../Frontend/admin-login.html")
    );
});

/* ================= ADMIN DASHBOARD PAGE ================= */
router.get("/dashboard", (req, res) => {
    res.sendFile(
        path.join(__dirname, "../../Frontend/admin-dashboard.html")
    );
});

/* ================= ADMIN LOGIN API ================= */
router.post("/login", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.json({ success: false });
    }

    db.query(
        `
        SELECT a.admin_id, a.college_id, c.college_name
        FROM admins a
        JOIN college c ON a.college_id = c.college_id
        WHERE a.email_id = ? AND a.password = ?
        `,
        [email, password],
        (err, rows) => {
            if (err || !rows || rows.length === 0) {
                console.error("❌ Admin login error:", err);
                return res.json({ success: false });
            }

            res.json({
                success: true,
                adminId: rows[0].admin_id,
                collegeId: rows[0].college_id,
                collegeName: rows[0].college_name
            });
        }
    );
});

/* ================= CREATE EVENT ================= */
router.post("/event", (req, res) => {
    const {
        college_id,
        exam_name,
        exam_date,
        start_time,
        end_time,
        cutoff_percentage
    } = req.body;

    db.query(
        `
        INSERT INTO exam_event
        (college_id, exam_name, exam_date, start_time, end_time, cutoff_percentage, is_active, is_deleted)
        VALUES (?, ?, ?, ?, ?, ?, 'NO', 'NO')
        `,
        [college_id, exam_name, exam_date, start_time, end_time, cutoff_percentage],
        err => {
            if (err) {
                console.error("❌ Create event error:", err);
                return res.json({ success: false });
            }
            res.json({ success: true });
        }
    );
});

/* ================= UPDATE EVENT STATUS ================= */
router.put("/event/status/:eventId", (req, res) => {
    db.query(
        `UPDATE exam_event SET is_active = ? WHERE event_id = ?`,
        [req.body.status, req.params.eventId],
        err => {
            if (err) {
                console.error("❌ Event status update error:", err);
                return res.json({ success: false });
            }
            res.json({ success: true });
        }
    );
});

/* ================= DELETE EVENT ================= */
router.put("/event/delete/:eventId", (req, res) => {
    db.query(
        `UPDATE exam_event SET is_deleted = 'YES' WHERE event_id = ?`,
        [req.params.eventId],
        err => {
            if (err) {
                console.error("❌ Event delete error:", err);
                return res.json({ success: false });
            }
            res.json({ success: true });
        }
    );
});

/* ================= ADMIN EVENTS ================= */
router.get("/events/:collegeId", (req, res) => {
    db.query(
        `
        SELECT *
        FROM exam_event
        WHERE college_id = ?
          AND (is_deleted = 'NO' OR is_deleted IS NULL)
        ORDER BY exam_date
        `,
        [req.params.collegeId],
        (err, rows) => {
            if (err) {
                console.error("❌ Load events error:", err);
                return res.json([]);
            }
            res.json(rows || []);
        }
    );
});

/* ================= ADMIN EXAMS ================= */
router.get("/exams/:eventId", (req, res) => {
    db.query(
        `
        SELECT exam_id, course, exam_status
        FROM exams
        WHERE event_id = ?
        `,
        [req.params.eventId],
        (err, rows) => {
            if (err) {
                console.error("❌ Load exams error:", err);
                return res.json([]);
            }
            res.json(rows || []);
        }
    );
});

/* ================= CREATE EXAM ================= */
router.post("/exam", (req, res) => {
    const { event_id, course } = req.body;

    if (!event_id || !course) {
        return res.status(400).json({
            success: false,
            message: "Event and course are required"
        });
    }

    // Prevent duplicate (event_id + course)
    db.query(
        `SELECT 1 FROM exams WHERE event_id = ? AND course = ?`,
        [event_id, course],
        (err, rows) => {
            if (err) {
                console.error("❌ Exam check error:", err);
                return res.json({ success: false });
            }

            if (rows.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "Exam already exists for this course"
                });
            }

            db.query(
                `
                INSERT INTO exams (event_id, course, exam_status, is_deleted)
                VALUES (?, ?, 'DRAFT', 'NO')
                `,
                [event_id, course],
                err2 => {
                    if (err2) {
                        console.error("❌ Create exam error:", err2);
                        return res.json({ success: false });
                    }
                    res.json({ success: true });
                }
            );
        }
    );
});

/* ================= DELETE EXAM ================= */
router.delete("/exam/:examId", (req, res) => {
    const examId = req.params.examId;

    db.query(
        `DELETE FROM questions WHERE exam_id = ?`,
        [examId],
        err => {
            if (err) {
                console.error("❌ Delete questions error:", err);
                return res.json({ success: false });
            }

            db.query(
                `DELETE FROM exams WHERE exam_id = ?`,
                [examId],
                err2 => {
                    if (err2) {
                        console.error("❌ Delete exam error:", err2);
                        return res.json({ success: false });
                    }
                    res.json({ success: true });
                }
            );
        }
    );
});

/* ================= GENERATE QUESTIONS ================= */
router.post("/generate-questions/:examId", async (req, res) => {
    const examId = req.params.examId;
    const questionCount = Number(req.body.questionCount) || 10;

    if (questionCount < 5 || questionCount > 50) {
        return res.json({
            success: false,
            message: "Question count must be between 5 and 50"
        });
    }

    db.query(
        `SELECT course, exam_status FROM exams WHERE exam_id = ?`,
        [examId],
        async (err, rows) => {

            if (err || !rows || rows.length === 0) {
                return res.json({
                    success: false,
                    message: "Exam not found"
                });
            }

            if (rows[0].exam_status !== "DRAFT") {
                return res.json({
                    success: false,
                    message: "Questions already generated"
                });
            }

            try {
                const questions =
                    await generateQuestionsForCourse(rows[0].course, questionCount);

                const insertSql = `
                    INSERT INTO questions
                    (question_text, option_a, option_b, option_c, option_d, correct_answer, exam_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `;

                for (const q of questions) {
                    await new Promise((resolve, reject) => {
                        db.query(insertSql, [
                            q.question_text,
                            q.option_a,
                            q.option_b,
                            q.option_c,
                            q.option_d,
                            q.correct_answer,
                            examId
                        ], err => err ? reject(err) : resolve());
                    });
                }

                db.query(
                    `UPDATE exams SET exam_status = 'READY' WHERE exam_id = ?`,
                    [examId],
                    err2 => {
                        if (err2) {
                            console.error("❌ Exam status update error:", err2);
                            return res.json({ success: false });
                        }
                        res.json({ success: true });
                    }
                );

            } catch (error) {
                console.error("❌ Question generation error:", error);
                res.status(500).json({
                    success: false,
                    message: "Question generation failed"
                });
            }
        }
    );
});

module.exports = router;
