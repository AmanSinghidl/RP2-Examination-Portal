import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import useBodyClass from "../hooks/useBodyClass.js";

function Result() {
  useBodyClass("exam-page result-page");
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const examId = params.get("examId");
  const studentId = localStorage.getItem("studentId");
  const [status, setStatus] = useState("Result");
  const [details, setDetails] = useState("");
  const [subtitle, setSubtitle] = useState("Exam submitted successfully. Thank you for giving it your best.");

  useEffect(() => {
    if (!studentId) {
      navigate("/student/login");
      return;
    }
    if (!examId) {
      alert("Invalid exam");
      navigate("/student/dashboard");
      return;
    }

    const loadResult = async () => {
      try {
        const response = await fetch("/exam/result", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId, examId }),
        });
        const data = await response.json();
        if (!data.success) {
          alert(data.message || "Unable to load result");
          return;
        }
        setStatus(data.resultStatus === "PASS" ? "PASS" : "FAIL");
        setDetails(`Marks Obtained: ${data.totalMarks}`);
        setSubtitle(
          data.resultStatus === "PASS"
            ? "Congratulations! Your answers have been successfully recorded."
            : "Thanks for your effort. We will share the final verdict shortly."
        );
      } catch (err) {
        console.error("Result error:", err);
        alert("Server error while loading result");
      }
    };

    loadResult();
  }, [studentId, examId, navigate]);

  return (
    <div className="result-shell">
      <section className="result-hero">
        <p className="eyebrow">Session complete</p>
        <h1>Thank you!</h1>
        <p className="result-subtitle">{subtitle}</p>

        <div className="result-card">
          <div className="result-row">
            <span className="result-label">Result status</span>
            <strong className={`result-badge ${status === "PASS" ? "pass" : "fail"}`}>
              {status}
            </strong>
          </div>
          <div className="result-row">
            <span className="result-label">Details</span>
            <span className="result-detail-value">{details || "Awaiting processed score..."}</span>
          </div>
        </div>

        <p className="result-note">Exam submitted successfully. We appreciate your discipline and effort.</p>
        <button className="primary-action" onClick={() => navigate("/student/dashboard")}>
          Back to dashboard
        </button>
      </section>
    </div>
  );
}

export default Result;
