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

fetch("http://localhost:5001/exam/result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentId, examId })
})
.then(res => res.json())
.then(data => {
    if (!data.success) {
        alert("Unable to load result");
        return;
    }

    // ✅ FIXED FIELD NAMES
    document.getElementById("resultStatus").innerText =
        data.resultStatus === "PASS" ? "🎉 PASS" : "❌ FAIL";

    document.getElementById("resultDetails").innerHTML = `
        <strong>Marks Obtained:</strong> ${data.totalMarks}
    `;
})
.catch(err => {
    console.error("Result error:", err);
    alert("Server error while loading result");
});

function goBack() {
    window.location.href = "/student-dashboard.html";
}
