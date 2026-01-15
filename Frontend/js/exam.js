console.log("Exam page loaded");

// ================= AUTH =================
const studentId = localStorage.getItem("studentId");
if (!studentId) {
    window.location.href = "/";
}

// ================= GET EXAM ID =================
const params = new URLSearchParams(window.location.search);
const examId = params.get("examId");

if (!examId) {
    alert("Invalid exam");
    window.location.href = "/student";
}

// ================= PREVENT RE-ATTEMPT =================
fetch(`/exam/attempted/${studentId}/${examId}`)
    .then(res => res.json())
    .then(data => {
        if (data.attempted) {
            alert("You have already attempted this exam.");
            window.location.href = "/student";
        }
    })
    .catch(err => {
        console.error("Attempt check error:", err);
        alert("Unable to verify exam now");
        window.location.href = "/student";
    });

// ================= TIMER =================
let timeLeft = 30 * 60; // 30 minutes
const timerEl = document.getElementById("timerText");

const timerInterval = setInterval(() => {
    const min = Math.floor(timeLeft / 60);
    const sec = timeLeft % 60;

    timerEl.innerText =
        `Time Left: ${min}:${sec < 10 ? "0" : ""}${sec}`;

    timeLeft--;

    if (timeLeft < 0) {
        clearInterval(timerInterval);
        alert("Time up! Submitting exam.");
        document.getElementById("examForm").dispatchEvent(new Event("submit"));
    }
}, 1000);

// ================= LOAD QUESTIONS =================
fetch(`/exam/questions/${examId}`)
    .then(res => res.json())
    .then(data => {
        const container = document.getElementById("questionsContainer");

        if (!data || data.length === 0) {
            container.innerHTML = "<p>No questions found.</p>";
            return;
        }

        data.forEach((q, index) => {
            const div = document.createElement("div");
            div.className = "question-box";

            div.innerHTML = `
                <p><strong>Q${index + 1}. ${q.question_text}</strong></p>

                <label>
                    <input type="radio" name="q_${q.question_id}" value="A"> ${q.option_a}
                </label><br>

                <label>
                    <input type="radio" name="q_${q.question_id}" value="B"> ${q.option_b}
                </label><br>

                <label>
                    <input type="radio" name="q_${q.question_id}" value="C"> ${q.option_c}
                </label><br>

                <label>
                    <input type="radio" name="q_${q.question_id}" value="D"> ${q.option_d}
                </label>
            `;

            container.appendChild(div);
        });
    })
    .catch(err => {
        console.error("Load questions error:", err);
        document.getElementById("questionsContainer").innerHTML =
            "<p>Error loading questions</p>";
    });

// ================= SUBMIT EXAM =================
document.getElementById("examForm").addEventListener("submit", e => {
    e.preventDefault();

    const answers = [];
    const inputs = document.querySelectorAll("input[type=radio]:checked");

    inputs.forEach(input => {
        const questionId = input.name.split("_")[1];
        answers.push({
            question_id: questionId,
            selected_option: input.value
        });
    });

    if (answers.length === 0) {
        alert("Please answer at least one question");
        return;
    }

    fetch("/exam/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            studentId,
            examId,
            answers
        })
    })
    .then(res => res.json())
    .then(data => {
        if (!data.success) {
            alert(data.message || "Submission failed");
            return;
        }

        // ✅ STORE SUCCESS MESSAGE
        localStorage.setItem(
            "examSuccessMessage",
            "✅ Exam submitted successfully"
        );

        // ✅ REDIRECT TO DASHBOARD
        window.location.href = "/student";
    })
    .catch(err => {
        console.error("Exam submit error:", err);
        alert("Server error during submission");
    });
});
