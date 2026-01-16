const express = require("express");
const path = require("path");
const router = express.Router();
const db = require("../db");

/* =================================================
   PAGE ROUTES
================================================= */

/* 🔁 REDIRECT /student → /student/dashboard */
router.get("/", (req, res) => {
    res.redirect("/student/dashboard");
});

/* STUDENT DASHBOARD PAGE */
router.get("/dashboard", (req, res) => {
    res.sendFile(
        path.join(__dirname, "../../Frontend/student-dashboard.html")
    );
});

/* =================================================
   AUTH
================================================= */

/* STUDENT LOGIN API */
router.post("/login", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.json({ success: false, message: "Missing credentials" });
    }

    const sql = `
        SELECT s.student_id, s.name, sc.password
        FROM students s
        JOIN student_credentials sc
            ON s.student_id = sc.student_id
        WHERE s.email_id = ?
    `;

    db.query(sql, [email], (err, rows) => {
        if (err || !rows || rows.length === 0) {
            return res.json({ success: false, message: "Invalid credentials" });
        }

        if (rows[0].password !== password) {
            return res.json({ success: false, message: "Invalid credentials" });
        }

        res.json({
            success: true,
            studentId: rows[0].student_id,
            name: rows[0].name
        });
    });
});

/* =================================================
   AVAILABLE EXAMS (COURSE-BASED, HIDE ATTEMPTED)
================================================= */

router.get("/exams/:studentId", (req, res) => {
    const sql = `
        SELECT 
            e.exam_id,
            ev.exam_name,
            ev.exam_date,
            ev.start_time,
            ev.end_time,
            e.course
        FROM students s
        JOIN exams e ON e.course = s.course
        JOIN exam_event ev ON ev.event_id = e.event_id
        WHERE s.student_id = ?
          AND e.exam_status = 'READY'
          AND ev.is_active = 'YES'
          AND (ev.is_deleted = 'NO' OR ev.is_deleted IS NULL)
          AND NOT EXISTS (
              SELECT 1
              FROM results r
              WHERE r.student_id = s.student_id
                AND r.exam_id = e.exam_id
          )
        ORDER BY ev.exam_date
    `;

    db.query(sql, [req.params.studentId], (err, rows) => {
        if (err) {
            console.error("Available exams error:", err);
            return res.json([]);
        }
        res.json(rows || []);
    });
});

/* =================================================
   ATTEMPTED EXAMS (HISTORY VIEW)
================================================= */

router.get("/attempted-exams/:studentId", (req, res) => {
    const sql = `
        SELECT 
            e.exam_id,
            ev.exam_name,
            ev.exam_date,
            e.course,
            r.attempt_status
        FROM results r
        JOIN exams e ON e.exam_id = r.exam_id
        JOIN exam_event ev ON ev.event_id = e.event_id
        WHERE r.student_id = ?
        ORDER BY ev.exam_date DESC
    `;

    db.query(sql, [req.params.studentId], (err, rows) => {
        if (err) {
            console.error("Attempted exams error:", err);
            return res.json([]);
        }
        res.json(rows || []);
    });
});

module.exports = router;
