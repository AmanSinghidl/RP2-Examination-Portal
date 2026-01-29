const studentId = localStorage.getItem("studentId");
if (!studentId) {
    window.location.href = "/student-login.html";
}

const params = new URLSearchParams(window.location.search);
const examId = params.get("examId");

if (!examId) {
    alert("Invalid exam");
    window.location.href = "/student-dashboard.html";
}

const statusEl = document.getElementById("resultStatus");
const detailsEl = document.getElementById("resultDetails");

if (statusEl) {
    statusEl.innerText = "Exam Submitted Successfully";
}

if (detailsEl) {
    detailsEl.innerText =
        "Your responses are recorded. Results will be published soon.";
}

function goBack() {
    window.location.href = "/student-dashboard.html";
}
