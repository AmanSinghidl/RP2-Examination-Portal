console.log("Admin dashboard JS loaded");

/* ================= GLOBAL ================= */
const adminId = localStorage.getItem("adminId");
const collegeId = localStorage.getItem("collegeId");
const collegeName = localStorage.getItem("collegeName");

function formatEventDate(value) {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString();
}

function formatEventDateRange(event) {
    const startText = formatEventDate(event.exam_start_date || event.exam_date);
    const endText = formatEventDate(event.exam_end_date || event.exam_date);
    if (startText && endText && startText !== endText) {
        return `${startText} to ${endText}`;
    }
    return startText || endText || "-";
}

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", () => {

    if (!adminId || !collegeId) {
        window.location.href = "/admin";
        return;
    }

    // Show college name
    const collegeEl = document.getElementById("collegeNameText");
    if (collegeEl && collegeName) {
        collegeEl.innerText = collegeName;
    }

    // 🔹 Button bindings (IMPORTANT)
    document.getElementById("createEventBtn")
        .addEventListener("click", createEvent);

    document.getElementById("createExamBtn")
        .addEventListener("click", createExam);

    document.getElementById("generateBtn")
        .addEventListener("click", generateQuestions);

    // 🔹 Dropdown handlers
    document.getElementById("eventSelect")
        .addEventListener("change", e => {
            if (e.target.value) {
                loadExams(e.target.value);
            }
            updateExamFields();
        });

    document.getElementById("courseSelect")
        .addEventListener("change", e => {
            const customInput = document.getElementById("customCourse");
            if (e.target.value === "OTHER") {
                customInput.style.display = "block";
            } else {
                customInput.style.display = "none";
                customInput.value = "";
            }
        });

    loadEvents();
    updateExamFields();
});

/* ================= LOAD EVENTS ================= */
function loadEvents() {
    fetch(`/admin/events/${collegeId}`)
        .then(res => res.json())
        .then(data => {
            const table = document.getElementById("eventsTable");
            const eventSelect = document.getElementById("eventSelect");

            table.innerHTML = "";
            eventSelect.innerHTML = `<option value="">Select Event</option>`;

            if (!data || data.length === 0) {
                table.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align:center;">
                            No events found
                        </td>
                    </tr>`;
                return;
            }

            data.forEach(event => {
                const row = document.createElement("tr");
                const eventDateDisplay = formatEventDateRange(event);
                row.innerHTML = `
                    <td>${event.event_id}</td>
                    <td>${event.exam_name}</td>
                    <td>${eventDateDisplay}</td>
                    <td>${event.start_time} - ${event.end_time}</td>
                    <td>${event.cutoff_percentage}</td>
                    <td>${event.is_active}</td>
                    <td>
                        <button onclick="toggleEventStatus(${event.event_id}, '${event.is_active}')">
                            ${event.is_active === "YES" ? "Deactivate" : "Activate"}
                        </button>
                        <button class="danger-btn"
                            onclick="deleteEvent(${event.event_id})">
                            Delete
                        </button>
                    </td>
                `;
                table.appendChild(row);

            const opt = document.createElement("option");
            opt.value = event.event_id;
            opt.dataset.type = (event.event_type || "REGULAR").toUpperCase();
            opt.textContent = event.exam_name;
                eventSelect.appendChild(opt);
            });
            updateExamFields();
        })
        .catch(err => console.error("Load events error:", err));
}

/* ================= CREATE EVENT ================= */
function createEvent() {
    const name = document.getElementById("eventName").value.trim();
    const startDate = document.getElementById("examStartDate").value;
    const endDate = document.getElementById("examEndDate").value;
    const start = document.getElementById("startTime").value;
    const end = document.getElementById("endTime").value;
    const cutoff = document.getElementById("cutoff").value;
    const eventType =
        document.getElementById("eventType")?.value?.trim() || "REGULAR";

    if (!name || !startDate || !endDate || !start || !end || !cutoff || !eventType) {
        alert("Fill all event details");
        return;
    }

    fetch("/admin/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            college_id: collegeId,
            exam_name: name,
            exam_start_date: startDate,
            exam_end_date: endDate,
            start_time: start,
            end_time: end,
            cutoff_percentage: cutoff,
            event_type: eventType.toUpperCase()
        })
    })
    .then(res => res.json())
    .then(data => {
        document.getElementById("eventStatus").innerText =
            data.success ? "Event created" : "Event creation failed";
        loadEvents();
    })
    .catch(err => {
        console.error("Create event error:", err);
        document.getElementById("eventStatus").innerText = "Server error";
    });
}

/* ================= LOAD EXAMS ================= */
function loadExams(eventId) {
    fetch(`/admin/exams/${eventId}`)
        .then(res => res.json())
        .then(data => {
            const table = document.getElementById("examTable");
            const examSelect = document.getElementById("examSelect");

            table.innerHTML = "";
            examSelect.innerHTML = `<option value="">Select Exam</option>`;

            if (!data || data.length === 0) {
                table.innerHTML = `
                    <tr>
                        <td colspan="4" style="text-align:center;">
                            No exams found
                        </td>
                    </tr>`;
                return;
            }

            data.forEach(exam => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${exam.exam_id}</td>
                    <td>${exam.course}</td>
                    <td>${exam.exam_status}</td>
                    <td>
                        <button class="danger-btn"
                            onclick="deleteExam(${exam.exam_id}, ${eventId})">
                            Delete
                        </button>
                    </td>
                `;
                table.appendChild(row);

                const opt = document.createElement("option");
                opt.value = exam.exam_id;
                opt.textContent = `Exam ${exam.exam_id} (${exam.course})`;
                examSelect.appendChild(opt);
            });
        })
        .catch(err => console.error("Load exams error:", err));
}

/* ================= CREATE EXAM ================= */
function createExam() {
    const eventId = document.getElementById("eventSelect").value;
    const courseSelect = document.getElementById("courseSelect").value;
    const customCourse = document.getElementById("customCourse").value.trim();
    const streamSelect = document.getElementById("streamSelect").value;
    const selectedType = (
        document.getElementById("eventSelect")
            .options[
                document.getElementById("eventSelect").selectedIndex
            ]?.dataset?.type || "REGULAR"
    ).toUpperCase();

    const payload = { event_id: eventId };

    if (!eventId) {
        alert("Select an event");
        return;
    }

    if (selectedType === "WALKIN") {
        if (!streamSelect) {
            alert("Select a stream for walk-in exams");
            return;
        }
        payload.stream = streamSelect;
    } else {
        const course =
            courseSelect === "OTHER" ? customCourse : courseSelect;
        if (!course) {
            alert("Select a course for regular exams");
            return;
        }
        payload.course = course;
    }

    fetch(`/admin/exam`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
    .then(() => loadExams(eventId))
    .catch(err => console.error("Create exam error:", err));
}

function updateExamFields() {
    const eventSelect = document.getElementById("eventSelect");
    const courseSelect = document.getElementById("courseSelect");
    const customInput = document.getElementById("customCourse");
    const streamSelect = document.getElementById("streamSelect");

    if (!eventSelect || !courseSelect || !customInput || !streamSelect) {
        return;
    }

    const selectedOption = eventSelect.options[eventSelect.selectedIndex];
    const eventType = (selectedOption?.dataset?.type || "REGULAR").toUpperCase();

    if (eventType === "WALKIN") {
        streamSelect.style.display = "block";
        courseSelect.style.display = "none";
        customInput.style.display = "none";
        courseSelect.value = "";
    } else {
        streamSelect.style.display = "none";
        streamSelect.value = "";
        courseSelect.style.display = "block";
    }
}

/* ================= DELETE / STATUS ================= */
function deleteExam(examId, eventId) {
    if (!confirm("Delete this exam?")) return;
    fetch(`/admin/exam/${examId}`, { method: "DELETE" })
        .then(() => loadExams(eventId));
}

function toggleEventStatus(eventId, currentStatus) {
    const newStatus = currentStatus === "YES" ? "NO" : "YES";
    fetch(`/admin/event/status/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
    }).then(loadEvents);
}

function deleteEvent(eventId) {
    if (!confirm("Delete this event?")) return;
    fetch(`/admin/event/delete/${eventId}`, { method: "PUT" })
        .then(loadEvents);
}

/* ================= GENERATE QUESTIONS ================= */
function generateQuestions() {
    const examId = document.getElementById("examSelect").value;
    const questionCount = document.getElementById("questionCount").value;
    const status = document.getElementById("generateStatus");

    if (!examId || !questionCount) {
        alert("Select exam and number of questions");
        return;
    }

    status.innerText = "Generating questions...";

    fetch(`/admin/generate-questions/${examId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionCount: Number(questionCount) })
    })
    .then(res => res.json())
    .then(data => {
        status.innerText = data.success
            ? "Questions generated successfully"
            : data.message || "Generation failed";
    })
    .catch(() => {
        status.innerText = "Server error during generation";
    });
}

/* ================= LOGOUT ================= */
function logoutAdmin() {
    fetch("/admin/logout", { method: "POST" })
        .catch(() => {})
        .finally(() => {
            localStorage.clear();
            window.location.href = "/admin/login";
        });
}
