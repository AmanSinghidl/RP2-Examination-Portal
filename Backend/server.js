require("dotenv").config();
const express = require("express");
const session = require("express-session");
const path = require("path");
const fs = require("fs");


const studentRoutes = require("./routes/student.routes");
const examRoutes = require("./routes/exam.routes");
const adminRoutes = require("./routes/admin.routes");

const app = express();

const reactDist = path.join(__dirname, "../frontend-react/dist");
const legacyFrontend = path.join(__dirname, "../Frontend");
const hasReactBuild = fs.existsSync(reactDist);

app.use(express.json());
app.use(
    session({
        secret: process.env.SESSION_SECRET || "dev-session-secret",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax"
        }
    })
);

if (hasReactBuild) {
    app.use(express.static(reactDist));
    app.use(express.static(legacyFrontend));
} else {
    app.use(express.static(legacyFrontend));
}

const sendIndex = (res) => {
    if (hasReactBuild) {
        return res.sendFile(path.join(reactDist, "index.html"));
    }

    const legacyIndex = path.join(legacyFrontend, "index.html");
    if (fs.existsSync(legacyIndex)) {
        return res.sendFile(legacyIndex);
    }

    res.status(404).send("Missing frontend build");
};

const requireAdminPage = (req, res, next) => {
    if (req.session?.admin) {
        return next();
    }
    return res.redirect("/admin/login");
};

const requireStudentPage = (req, res, next) => {
    if (req.session?.student) {
        return next();
    }
    return res.redirect("/student/login");
};

/* ✅ ROOT ROUTE (ADD THIS) */
app.get("/", (req, res) => {
    sendIndex(res);
});

if (hasReactBuild) {
    app.get("/admin/dashboard", requireAdminPage, (req, res) => {
        sendIndex(res);
    });

    app.get("/student/dashboard", requireStudentPage, (req, res) => {
        sendIndex(res);
    });

    app.get("/exam.html", (req, res) => {
        res.sendFile(path.join(legacyFrontend, "exam.html"));
    });

    app.get("/result.html", (req, res) => {
        res.sendFile(path.join(legacyFrontend, "result.html"));
    });
}

/* ROUTES */
app.use("/student", studentRoutes);
app.use("/exam", examRoutes);
app.use("/admin", adminRoutes);

if (hasReactBuild) {
    app.get(/^\/(admin|student)(\/.*)?$/, (req, res, next) => {
        if (
            req.path.startsWith("/admin/events") ||
            req.path.startsWith("/admin/exams") ||
            req.path.startsWith("/student/exams") ||
            req.path.startsWith("/student/attempted-exams")
        ) {
            return next();
        }
        sendIndex(res);
    });

    app.get(["/register", "/exam", "/result"], (req, res) => {
        sendIndex(res);
    });
}

app.listen(5000, () => {
    console.log("✅ Server running at http://localhost:5000");
});
