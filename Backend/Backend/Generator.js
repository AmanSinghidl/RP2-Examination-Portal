require("dotenv").config();
const express = require("express");
const path = require("path");
const db = require("./db"); 


const router = express.Router();

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

    const startDate = exam_start_date || req.body.exam_date;
    const endDate = exam_end_date || req.body.exam_date;
    const eventType = (event_type || "REGULAR").toUpperCase();

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
        exam_start_date,
        exam_end_date,
        start_time,
        end_time,
        cutoff_percentage,
        event_type
    } = req.body;

    db.query(
        `
        INSERT INTO exam_event
        (college_id, exam_name, exam_start_date, exam_end_date, start_time, end_time, cutoff_percentage, event_type, who_updated, updated_date, is_active, is_deleted)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ADMIN', CURRENT_DATE(), 'NO', 'NO')
        `,
        [
            college_id,
            exam_name,
            startDate,
            endDate,
            start_time,
            end_time,
            cutoff_percentage,
            eventType
        ],
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
            if (err) return res.json({ success: false });
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
            if (err) return res.json({ success: false });
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
        ORDER BY exam_start_date
        `,
        [req.params.collegeId],
        (err, rows) => {
            if (err) return res.json([]);
            res.json(rows);
        }
    );
});

/* ================= ADMIN EXAMS ================= */
router.get("/exams/:eventId", (req, res) => {
    db.query(
        `
        SELECT exam_id, class, exam_status
        FROM exams
        WHERE event_id = ?
        `,
        [req.params.eventId],
        (err, rows) => {
            if (err) return res.json([]);
            res.json(rows);
        }
    );
});

/* ================= CREATE EXAM ================= */
router.post("/exam", (req, res) => {
    const { event_id, class_name } = req.body;

    db.query(
        `
        INSERT INTO exams (event_id, class, exam_status)
        VALUES (?, ?, 'DRAFT')
        `,
        [event_id, class_name],
        err => {
            if (err) return res.json({ success: false });
            res.json({ success: true });
        }
    );
});

/* ================= DELETE EXAM ================= */
router.delete("/exam/:examId", (req, res) => {
    db.query(
        `DELETE FROM questions WHERE exam_id = ?`,
        [req.params.examId],
        () => {
            db.query(
                `DELETE FROM exams WHERE exam_id = ?`,
                [req.params.examId],
                err => {
                    if (err) return res.json({ success: false });
                    res.json({ success: true });
                }
            );
        }
    );
});

/* ================= GENERATE QUESTIONS (FINAL FIX) ================= */
router.post("/generate-questions/:examId", async (req, res) => {
    const examId = req.params.examId;
    const { questionCount } = req.body;   // ✅ RECEIVED FROM UI

    db.query(
        `SELECT class, exam_status FROM exams WHERE exam_id = ?`,
        [examId],
        async (err, rows) => {

            if (!rows || rows.length === 0) {
                return res.json({ success: false, message: "Exam not found" });
            }

            if (rows[0].exam_status !== "DRAFT") {
                return res.json({
                    success: false,
                    message: "Questions already generated"
                });
            }

            try {
                const questions = await generateQuestionsForClass(
                    rows[0].class,
                    Number(questionCount) || 10   // ✅ VARIABLE COUNT
                );

                const sql = `
                    INSERT INTO questions
                    (question_text, option_a, option_b, option_c, option_d, correct_answer, exam_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `;

                for (const q of questions) {
                    await new Promise((resolve, reject) => {
                        db.query(sql, [
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
                    () => res.json({ success: true })
                );

            } catch (e) {
                console.error("❌ Question generation error:", e);
                res.status(500).json({ success: false });
            }
        }
    );
});

module.exports = router;
