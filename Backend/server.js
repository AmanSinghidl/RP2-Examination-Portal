const express = require("express");
const path = require("path");
require("dotenv").config();

const studentRoutes = require("./routes/student.routes");
const examRoutes = require("./routes/exam.routes");
const adminRoutes = require("./routes/admin.routes");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "../Frontend")));

/* ✅ ROOT ROUTE (ADD THIS) */
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../Frontend/student-login.html"));
});

/* ROUTES */
app.use("/student", studentRoutes);
app.use("/exam", examRoutes);
app.use("/admin", adminRoutes);

app.listen(5000, () => {
    console.log("✅ Server running at http://localhost:5000");
});
