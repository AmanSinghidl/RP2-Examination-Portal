const express = require("express");
const router = express.Router();
const db = require("../db");
const {
    generateQuestionsForCourse,
    generateQuestionsForStream
} = require("../Generator");

const WALKIN_STREAMS = ["Data Science", "Data Analytics", "MERN"];
const WALKIN_STREAMS_SQL = WALKIN_STREAMS.map((stream) => `'${stream}'`).join(", ");

function ensureStudentTypeColumn() {
    const query = `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE table_schema = DATABASE()
          AND table_name = 'students'
          AND column_name = 'student_type'
    `;

    db.query(query, (err, rows) => {
        if (err) {
            console.error("Student type column check failed:", err);
            return;
        }

        if (rows?.length > 0) {
            return;
        }

        db.query(
            `ALTER TABLE students ADD COLUMN student_type ENUM('REGULAR','WALKIN') NOT NULL DEFAULT 'REGULAR'`,
            err2 => {
                if (err2) {
                    console.error("Could not add student_type column:", err2);
                } else {
                    console.log("Added student_type column to students table");
                }
            }
        );
    });
}

ensureStudentTypeColumn();

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

            req.session.admin = {
                adminId: rows[0].admin_id,
                collegeId: rows[0].college_id,
                collegeName: rows[0].college_name
            };

            res.json({
                success: true,
                adminId: rows[0].admin_id,
                collegeId: rows[0].college_id,
                collegeName: rows[0].college_name
            });
        }
    );
});

router.post("/logout", (req, res) => {
    if (!req.session) {
        return res.json({ success: true });
    }
    req.session.destroy(() => res.json({ success: true }));
});

/* ================= AUTH ================= */
const ADMIN_AUTH_WHITELIST = ["/login"];

router.use((req, res, next) => {
    if (req.method === "OPTIONS" || ADMIN_AUTH_WHITELIST.includes(req.path)) {
        return next();
    }
    if (!req.session?.admin) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    next();
});

router.param("collegeId", (req, res, next, collegeId) => {
    if (!req.session?.admin) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (String(collegeId) !== String(req.session.admin.collegeId)) {
        return res.status(403).json({ success: false, message: "Forbidden" });
    }
    next();
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

    const startDate = exam_start_date || req.body.exam_date;
    const endDate = exam_end_date || req.body.exam_date;
    const eventType = String(event_type || "REGULAR").trim().toUpperCase();
    if (!["REGULAR", "WALKIN"].includes(eventType)) {
        return res.status(400).json({
            success: false,
            message: "Invalid event type"
        });
    }

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
            if (err) {
                console.error("❌ Event status update error:", err);
                return res.json({ success: false });
            }
            res.json({ success: true });
        }
    );
});

/* ================= EVENT OVERRIDES ================= */
router.post("/event/override", (req, res) => {
    const { student_id, event_id, is_allowed } = req.body;
    if (!student_id || !event_id) {
        return res.status(400).json({
            success: false,
            message: "Missing student or event"
        });
    }

    const allowed = is_allowed !== false;
    db.query(
        `
        INSERT INTO student_event_overrides (student_id, event_id, is_allowed)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE is_allowed = ?, created_at = CURRENT_TIMESTAMP
        `,
        [student_id, event_id, allowed ? 1 : 0, allowed ? 1 : 0],
        err => {
            if (err) {
                console.error("❌ Override update error:", err);
                return res.json({ success: false });
            }
            res.json({ success: true });
        }
    );
});

router.delete("/event/override", (req, res) => {
    const { student_id, event_id } = req.body;
    if (!student_id || !event_id) {
        return res.status(400).json({
            success: false,
            message: "Missing student or event"
        });
    }

    db.query(
        `DELETE FROM student_event_overrides WHERE student_id = ? AND event_id = ?`,
        [student_id, event_id],
        err => {
            if (err) {
                console.error("❌ Override delete error:", err);
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
        ORDER BY exam_start_date
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

/* ================= STUDENT COUNT ================= */
router.get("/students/count/:collegeId", (req, res) => {
    db.query(
        `SELECT COUNT(*) AS total FROM students WHERE college_id = ?`,
        [req.params.collegeId],
        (err, rows) => {
            if (err) {
                console.error("Student count error:", err);
                return res.json({ total: 0 });
            }
            res.json({ total: rows?.[0]?.total || 0 });
        }
    );
});

/* ================= EXAM COUNT ================= */
router.get("/exams/count/:collegeId", (req, res) => {
    db.query(
        `
        SELECT COUNT(*) AS total
        FROM exams e
        JOIN exam_event ev ON ev.event_id = e.event_id
        WHERE ev.college_id = ?
          AND (ev.is_deleted = 'NO' OR ev.is_deleted IS NULL)
        `,
        [req.params.collegeId],
        (err, rows) => {
            if (err) {
                console.error("Exam count error:", err);
                return res.json({ total: 0 });
            }
            res.json({ total: rows?.[0]?.total || 0 });
        }
    );
});

/* ================= ACTIVE EXAM COUNT ================= */
router.get("/exams/active-count/:collegeId", (req, res) => {
    db.query(
        `
        SELECT COUNT(*) AS total
        FROM exams e
        JOIN exam_event ev ON ev.event_id = e.event_id
        WHERE ev.college_id = ?
          AND (ev.is_deleted = 'NO' OR ev.is_deleted IS NULL)
          AND e.exam_status = 'READY'
        `,
        [req.params.collegeId],
        (err, rows) => {
            if (err) {
                console.error("Active exam count error:", err);
                return res.json({ total: 0 });
            }
            res.json({ total: rows?.[0]?.total || 0 });
        }
    );
});

/* ================= RECENT RESULTS ================= */
router.get("/results/:collegeId", (req, res) => {
    db.query(
        `
        SELECT r.result_id,
               r.student_id,
               r.exam_id,
               r.attempt_status,
               r.total_marks,
               r.result_status,
               ev.exam_name,
               ev.exam_start_date,
               ev.exam_end_date,
               e.course,
               COALESCE(q.total_questions, 0) AS total_questions,
               sa_stats.correct_answers AS correct_answers,
               CASE
                   WHEN r.result_status IS NOT NULL THEN r.result_status
                   WHEN q.total_questions > 0 AND sa_stats.correct_answers IS NOT NULL
                       AND sa_stats.correct_answers * 100 >= q.total_questions * COALESCE(ev.cutoff_percentage, 0)
                       THEN 'PASS'
                   WHEN q.total_questions > 0 AND sa_stats.correct_answers IS NOT NULL THEN 'FAIL'
                   ELSE 'PENDING'
               END AS pass_fail
        FROM results r
        JOIN exams e ON e.exam_id = r.exam_id
        JOIN exam_event ev ON ev.event_id = e.event_id
        LEFT JOIN (
            SELECT sa.student_id,
                   sa.exam_id,
                   COUNT(*) AS answered_count,
                   SUM(sa.selected_option = q.correct_answer) AS correct_answers
            FROM student_answers sa
            JOIN questions q ON sa.question_id = q.question_id
            GROUP BY sa.student_id, sa.exam_id
        ) sa_stats ON sa_stats.student_id = r.student_id AND sa_stats.exam_id = r.exam_id
        LEFT JOIN (
            SELECT exam_id, COUNT(*) AS total_questions
            FROM questions
            GROUP BY exam_id
        ) q ON q.exam_id = e.exam_id
        WHERE ev.college_id = ?
          AND (ev.is_deleted = 'NO' OR ev.is_deleted IS NULL)
        ORDER BY r.result_id DESC
        LIMIT 10
        `,
        [req.params.collegeId],
        (err, rows) => {
            if (err) {
                console.error("Results load error:", err);
                return res.json([]);
            }
            res.json(rows || []);
        }
    );
});

router.get("/result-answers/:resultId", (req, res) => {
    const { resultId } = req.params;
    if (!resultId) {
        return res.status(400).json({ success: false });
    }

    const query = `
        SELECT 
            q.question_id,
            q.question_text,
            q.option_a,
            q.option_b,
            q.option_c,
            q.option_d,
            q.correct_answer,
            sa.selected_option
        FROM results r
        JOIN exams e ON e.exam_id = r.exam_id
        JOIN exam_event ev ON ev.event_id = e.event_id
        JOIN student_answers sa 
            ON sa.exam_id = e.exam_id 
            AND sa.student_id = r.student_id
        JOIN questions q ON q.question_id = sa.question_id
        WHERE r.result_id = ?
          AND ev.college_id = ?
        ORDER BY q.question_id
    `;

    db.query(query, [resultId, req.session.admin.collegeId], (err, rows) => {
        if (err) {
            console.error("Result questions error:", err);
            return res.status(500).json({ success: false });
        }
        res.json({ success: true, questions: rows || [] });
    });
});

/* ================= STUDENT PROFILES ================= */
router.get("/students/:collegeId", (req, res) => {
    db.query(
        `
        SELECT s.student_id,
               s.name,
               s.email_id,
               s.contact_number,
               s.course,
               s.dob,
               sc.password,
               CASE
                   WHEN s.student_type = 'WALK_IN' THEN 'WALKIN'
                   WHEN s.student_type = 'REGULAR' THEN 'REGULAR'
                   WHEN s.course IN (${WALKIN_STREAMS_SQL}) THEN 'WALKIN'
                   ELSE 'REGULAR'
               END AS student_type
        FROM students s
        LEFT JOIN student_credentials sc ON sc.student_id = s.student_id
        WHERE s.college_id = ?
        ORDER BY s.name
        `,
        [req.params.collegeId],
        (err, rows) => {
            if (err) {
                console.error("Student list error:", err);
                return res.json([]);
            }
            res.json(rows || []);
        }
    );
});

/* ================= WALK-IN STUDENT CREATION ================= */
router.post("/students/walkin", (req, res) => {
    const { name, email, phone, dob, course } = req.body;

    if (!name || !email || !phone || !dob || !course) {
        return res.status(400).json({ success: false, message: "Missing required walk-in details" });
    }

    db.query(
        `SELECT student_id FROM students WHERE email_id = ?`,
        [email],
        (err, rows) => {
            if (err) {
                console.error("Walk-in lookup error:", err);
                return res.status(500).json({ success: false, message: "Server error" });
            }

            if (rows.length > 0) {
                return res.status(400).json({ success: false, message: "Email already registered" });
            }

            db.query(
                `
                INSERT INTO students
                (name, email_id, contact_number, dob, course, college_id, student_type)
                VALUES (?, ?, ?, ?, ?, ?, 'WALK_IN')
                `,
                [name, email, phone, dob, course.trim(), 1],
                (err2) => {
                    if (err2) {
                        console.error("Walk-in insert error:", err2);
                        return res.status(500).json({ success: false, message: "Could not create walk-in student" });
                    }

                    res.json({
                        success: true,
                        credentials: { studentId: email }
                    });
                }
            );
        }
    );
});

/* ================= WALK-IN CREDENTIAL RESET ================= */
router.put("/students/walkin/password", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    db.query(
        `SELECT student_id FROM students WHERE email_id = ?`,
        [email],
        (err, rows) => {
            if (err) {
                console.error("Walk-in password lookup error:", err);
                return res.status(500).json({ success: false, message: "Server error" });
            }

            if (!rows || rows.length === 0) {
                return res.status(404).json({ success: false, message: "Walk-in student not found" });
            }

            db.query(
                `
                INSERT INTO student_credentials (student_id, password, role_id)
                VALUES (?, ?, 1)
                ON DUPLICATE KEY UPDATE password = VALUES(password)
                `,
                [rows[0].student_id, password],
                (err2) => {
                    if (err2) {
                        console.error("Walk-in password update error:", err2);
                        return res.status(500).json({ success: false, message: "Could not update password" });
                    }

                    res.json({ success: true });
                }
            );
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
    const { event_id, course, stream } = req.body;

    if (!event_id) {
        return res.status(400).json({ success: false, message: "Event is required" });
    }

    db.query(
        `
        SELECT event_type
        FROM exam_event
        WHERE event_id = ?
          AND (is_deleted = 'NO' OR is_deleted IS NULL)
        `,
        [event_id],
        (err, rows) => {
            if (err || !rows || rows.length === 0) {
                console.error("Create exam lookup error:", err);
                return res.json({ success: false, message: "Invalid event" });
            }

            const eventType = (rows[0].event_type || "REGULAR").toUpperCase();
            let payloadValue = "";

            if (eventType === "WALKIN") {
                if (!stream || !stream.trim()) {
                    return res.json({
                        success: false,
                        message: "Select a stream for walk-in exams"
                    });
                }
                payloadValue = stream.trim();
            } else {
                const normalizedCourse = String(course || "").trim();
                if (!normalizedCourse) {
                    return res.json({
                        success: false,
                        message: "Select a course for regular exams"
                    });
                }
                payloadValue = normalizedCourse;
            }

            db.query(
                `
                INSERT INTO exams (event_id, course, exam_status)
                VALUES (?, ?, 'DRAFT')
                ON DUPLICATE KEY UPDATE exam_status = 'DRAFT'
                `,
                [event_id, payloadValue],
                err2 => {
                    if (err2) {
                        console.error("Create exam error:", err2);
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

    db.query(`DELETE FROM questions WHERE exam_id = ?`, [examId], err => {
        if (err) {
            console.error("❌ Delete questions error:", err);
            return res.json({ success: false });
        }

        db.query(`DELETE FROM exams WHERE exam_id = ?`, [examId], err2 => {
            if (err2) {
                console.error("❌ Delete exam error:", err2);
                return res.json({ success: false });
            }
            res.json({ success: true });
        });
    });
});

/* ================= GENERATE QUESTIONS ================= */
router.post("/generate-questions/:examId", async (req, res) => {
    const examId = req.params.examId;
    const questionCount = Number(req.body.questionCount) || 5;

    db.query(
        `
        SELECT e.course, e.exam_status, ev.event_type
        FROM exams e
        JOIN exam_event ev ON ev.event_id = e.event_id
        WHERE e.exam_id = ?
        `,
        [examId],
        async (err, rows) => {
            if (err || !rows || rows.length === 0) {
                return res.json({ success: false, message: "Exam not found" });
            }

            if (rows[0].exam_status !== "DRAFT") {
                return res.json({ success: false, message: "Questions already generated" });
            }

            const eventType = (rows[0].event_type || "REGULAR").toUpperCase();
            const sourceValue = String(rows[0].course || "").trim();

            if (!sourceValue) {
                return res.json({
                    success: false,
                    message: "Missing course/stream for question generation"
                });
            }

            try {
                const questions =
                    eventType === "WALKIN"
                        ? await generateQuestionsForStream(sourceValue, questionCount)
                        : await generateQuestionsForCourse(sourceValue, questionCount);

                const insertSql = `
                    INSERT INTO questions
                    (question_text, option_a, option_b, option_c, option_d, correct_answer, exam_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `;

                for (const q of questions) {
                    await new Promise((resolve, reject) => {
                        db.query(
                            insertSql,
                            [
                                q.question_text,
                                q.option_a,
                                q.option_b,
                                q.option_c,
                                q.option_d,
                                q.correct_answer,
                                examId
                            ],
                            err => (err ? reject(err) : resolve())
                        );
                    });
                }

                db.query(
                    `UPDATE exams SET exam_status = 'READY' WHERE exam_id = ?`,
                    [examId],
                    err2 => {
                        if (err2) {
                            console.error("Exam status update error:", err2);
                            return res.json({ success: false });
                        }
                        res.json({ success: true });
                    }
                );
            } catch (error) {
                console.error("Question generation error:", error);
                res.status(500).json({ success: false, message: "Question generation failed" });
            }
        }
    );
});

module.exports = router;
