console.log("✅ student-login.js loaded");

function studentLogin() {
    console.log("✅ Login button clicked");

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!email || !password) {
        alert("Please enter email and password");
        return;
    }

    fetch("/student/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    })
    .then(res => res.json())
    .then(data => {
        console.log("🔵 Login response:", data);

        if (!data.success) {
            alert("Invalid credentials");
            return;
        }

        // ✅ STORE SESSION
        localStorage.setItem("studentId", data.studentId);
        localStorage.setItem("studentName", data.name);
        localStorage.setItem("studentEmail", email);

        // ✅ REDIRECT (VERY IMPORTANT)
        window.location.href = "/student/dashboard";
    })
    .catch(err => {
        console.error("❌ Login error:", err);
        alert("Server error");
    });
}
