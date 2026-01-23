console.log("Admin dashboard JS loaded");

/* ================= GLOBAL ================= */
const adminId = localStorage.getItem("adminId");
const collegeId = localStorage.getItem("collegeId");
const collegeName = localStorage.getItem("collegeName");

function formatEventDate(value) {
    if (!value) return "-";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleDateString();
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

    document.getElementById("createEventBtn")
        .addEventListener("click", createEvent);

    loadEvents();
    updateExamFields();

    // Event select change
    document.getElementById("eventSelect").addEventListener("change", e => {
        const selected = e.target.options[e.target.selectedIndex];
        const isActive = selected.dataset.active === "YES";

        const inactiveNote = document.getElementById("inactiveNote");
        if (inactiveNote) {
            inactiveNote.style.display = isActive ? "none" : "block";
        }

        if (e.target.value) {
            loadExams(e.target.value);
        }
        updateExamFields();
    });

    // Course dropdown change (OTHER handling)
    document.getElementById("courseSelect").addEventListener("change", e => {
        const customInput = document.getElementById("customCourse");
        if (e.target.value === "OTHER") {
            customInput.style.display = "block";
        } else {
            customInput.style.display = "none";
            customInput.value = "";
        }
    });
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
                    </tr>
                `;
                return;
            }

            data.forEach(event => {
                const row = document.createElement("tr");

                const dateValue =
                    event.exam_date || event.exam_start_date || event.exam_end_date;
                row.innerHTML = `
                    <td>${event.event_id}</td>
                    <td>${event.exam_name}</td>
                    <td>${formatEventDate(dateValue)}</td>
                    <td>${event.start_time} - ${event.end_time}</td>
                    <td>${event.cutoff_percentage}</td>
                    <td>
                        <span class="${
                            event.is_active === "YES"
                                ? "status-active"
                                : "status-inactive"
                        }">
                            ${event.is_active}
                        </span>
                    </td>
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
                opt.dataset.active = event.is_active;
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
    const name = document.getElementById("eventName").value;
    const date = document.getElementById("eventDate").value;
    const start = document.getElementById("startTime").value;
    const end = document.getElementById("endTime").value;
    const cutoff = document.getElementById("cutoff").value;
    const eventType =
        document.getElementById("eventType")?.value?.trim() || "REGULAR";

    if (!name || !date || !start || !end || !cutoff) {
        alert("Fill all event details");
        return;
    }

    fetch("/admin/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            exam_name: name,
            exam_start_date: date,
            exam_end_date: date,
            start_time: start,
            end_time: end,
            cutoff_percentage: cutoff,
            event_type: (eventType || "REGULAR").toUpperCase(),
            college_id: collegeId
        })
    })
    .then(res => res.json())
    .then(data => {
        document.getElementById("eventStatus").innerText =
            data.success
                ? "✅ Event created"
                : "❌ Event creation failed";
        loadEvents();
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
                    </tr>
                `;
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
        });
}

/* ================= CREATE EXAM ================= */
function createExam() {
    const eventId = document.getElementById("eventSelect").value;
    const courseSelect = document.getElementById("courseSelect").value;
    const customCourse = document.getElementById("customCourse").value;
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
            courseSelect === "OTHER" ? customCourse.trim() : courseSelect;
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
    }).then(() => loadExams(eventId));
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

/* ================= DELETE EXAM ================= */
function deleteExam(examId, eventId) {
    if (!confirm("Delete this exam?")) return;

    fetch(`/admin/exam/${examId}`, { method: "DELETE" })
        .then(() => loadExams(eventId));
}

/* ================= EVENT ACTIONS ================= */
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
        .then(() => loadEvents());
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

    status.innerText = "⏳ Generating questions...";

    fetch(`/admin/generate-questions/${examId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            questionCount: Number(questionCount)
        })
    })
    .then(res => res.json())
    .then(data => {
        status.innerText = data.success
            ? "✅ Questions generated successfully"
            : data.message || "❌ Generation failed";
    })
    .catch(() => {
        status.innerText = "❌ Server error during generation";
    });
}

/* ================= LOGOUT ================= */
function logoutAdmin() {
    localStorage.clear();
    window.location.href = "/admin";
}
