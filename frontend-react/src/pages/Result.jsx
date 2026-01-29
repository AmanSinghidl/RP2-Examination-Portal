import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import useBodyClass from "../hooks/useBodyClass.js";

function Result() {
  useBodyClass("exam-page result-page");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const examId = params.get("examId");
  const studentId = localStorage.getItem("studentId");

  useEffect(() => {
    if (!studentId) {
      navigate("/student/login");
      return;
    }
    if (!examId) {
      alert("Invalid exam");
      navigate("/student/dashboard");
    }
  }, [studentId, examId, navigate]);

  return (
    <div className="result-shell">
      <section className="result-hero">
        <p className="eyebrow">Session complete</p>
        <h1>Exam submitted successfully</h1>
        <p className="result-subtitle">
          Your responses are recorded. Results will be published soon, and we will notify you once
          they are released.
        </p>
        <p className="result-note">
          Thank you for your focus. Please check back later for the official announcement.
        </p>
        <button className="primary-action" onClick={() => navigate("/student/dashboard")}>
          Back to dashboard
        </button>
      </section>
    </div>
  );
}

export default Result;
