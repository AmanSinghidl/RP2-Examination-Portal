console.log("Student dashboard JS loaded");

/* ================= AUTH GUARD ================= */
const studentId = localStorage.getItem("studentId");
const studentName = localStorage.getItem("studentName");

if (!studentId || !studentName) {
    alert("Please login first");
    window.location.href = "/";
}

function formatExamDate(value) {
    if (!value) return "-";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleDateString();
}

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", () => {

    // 👋 Show student name
    const nameEl = document.getElementById("studentNameText");
    if (nameEl) {
        nameEl.innerText = `Welcome, ${studentName}`;
    }

    // 📘 Load available exams
    loadStudentExams(studentId);

    // 📕 Load attempted exams
    loadAttemptedExams(studentId);
});

/* ================= LOAD AVAILABLE EXAMS ================= */
function loadStudentExams(studentId) {
    const table = document.getElementById("studentExamTable");
    table.innerHTML = "";

    fetch(`/student/exams/${studentId}`)
        .then(res => res.json())
        .then(data => {
            if (!data || data.length === 0) {
                table.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align:center;">
                            No exams available
                        </td>
                    </tr>
                `;
                return;
            }

            data.forEach(exam => {
                const row = document.createElement("tr");
            const displayDate = formatExamDate(
                exam.exam_start_date || exam.exam_end_date || exam.exam_date
            );

            row.innerHTML = `
                <td>${exam.exam_name}</td>
                <td>${displayDate}</td>
                <td>${exam.start_time} - ${exam.end_time}</td>
                <td>${exam.class}</td>
                <td>
                    <button onclick="startExam(${exam.exam_id})">
                        Start Exam
                    </button>
                </td>
            `;
                table.appendChild(row);
            });
        })
        .catch(err => {
            console.error("Load available exams error:", err);
            table.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center;">
                        Error loading exams
                    </td>
                </tr>
            `;
        });
}

/* ================= LOAD ATTEMPTED EXAMS ================= */
function loadAttemptedExams(studentId) {
    const table = document.getElementById("attemptedExamTable");
    table.innerHTML = "";

    fetch(`/student/attempted-exams/${studentId}`)
        .then(res => res.json())
        .then(data => {
            if (!data || data.length === 0) {
                table.innerHTML = `
                    <tr>
                        <td colspan="4" style="text-align:center;">
                            No attempted exams
                        </td>
                    </tr>
                `;
                return;
            }

            data.forEach(exam => {
                const row = document.createElement("tr");
            const displayDate = formatExamDate(
                exam.exam_start_date || exam.exam_end_date || exam.exam_date
            );

            row.innerHTML = `
                <td>${exam.exam_name}</td>
                <td>${displayDate}</td>
                <td>${exam.class}</td>
                <td>${exam.attempt_status}</td>
            `;
                table.appendChild(row);
            });
        })
        .catch(err => {
            console.error("Load attempted exams error:", err);
            table.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align:center;">
                        Error loading attempted exams
                    </td>
                </tr>
            `;
        });
}

/* ================= START EXAM ================= */
function startExam(examId) {
    fetch(`/exam/attempted/${studentId}/${examId}`)
        .then(res => res.json())
        .then(data => {
            if (data.attempted) {
                alert("You have already attempted this exam.");
            } else {
                window.location.href = `/exam.html?examId=${examId}`;
            }
        })
        .catch(err => {
            console.error("Exam verify error:", err);
            alert("Unable to verify exam status");
        });
}

/* ================= LOGOUT ================= */
function logoutStudent() {
    localStorage.removeItem("studentId");
    localStorage.removeItem("studentName");
    window.location.href = "/";
}
