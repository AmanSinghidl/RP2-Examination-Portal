import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import useBodyClass from "../hooks/useBodyClass.js";

const EXAM_DURATION_SECONDS = 30 * 60;
const MAX_VIOLATIONS = 3;
const VIOLATION_DEBOUNCE_MS = 1000;

function Exam() {
  useBodyClass("exam-page");

  const navigate = useNavigate();
  const [params] = useSearchParams();
  const examId = params.get("examId");

  const studentId = localStorage.getItem("studentId");
  const [timeLeft, setTimeLeft] = useState(EXAM_DURATION_SECONDS);
  const [questionBank, setQuestionBank] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [violations, setViolations] = useState(0);
  const [proctorMessage, setProctorMessage] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [fullscreenPrompted, setFullscreenPrompted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [examReady, setExamReady] = useState(false);
  const [preExamOpen, setPreExamOpen] = useState(true);

  const currentQuestion = questionBank[currentIndex];
  const lastViolationRef = useRef(0);
  const submitLockRef = useRef(false);
  const answersRef = useRef(answers);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

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

    const checkAttempt = async () => {
      try {
        const response = await fetch(`/exam/attempted/${studentId}/${examId}`, {
          credentials: "include",
        });
        const data = await response.json();
        if (data.attempted) {
          alert("You have already attempted this exam.");
          navigate("/student/dashboard");
        }
      } catch (err) {
        console.error("Attempt check error:", err);
        alert("Unable to verify exam now");
        navigate("/student/dashboard");
      }
    };

    checkAttempt();
  }, [studentId, examId, navigate]);

  useEffect(() => {
    if (!examId) return;
    const loadQuestions = async () => {
      try {
        const response = await fetch(`/exam/questions/${examId}`, {
          credentials: "include",
        });
        const data = await response.json();
        if (!data || data.length === 0) {
          setError("No questions found.");
          setLoading(false);
          return;
        }
        setQuestionBank(data);
      } catch (err) {
        console.error("Load questions error:", err);
        setError("Error loading questions.");
      } finally {
        setLoading(false);
      }
    };

    loadQuestions();
  }, [examId]);

  const requestFullscreen = useCallback(async () => {
    if (!document.documentElement.requestFullscreen) {
      setFullscreenSupported(false);
      setProctorMessage("Fullscreen is not supported in this browser.");
      return;
    }
    try {
      await document.documentElement.requestFullscreen();
      setProctorMessage("");
    } catch (err) {
      console.error("Fullscreen request failed:", err);
      setProctorMessage("Please enter fullscreen to continue the exam.");
    }
  }, []);

  const handleSubmit = useCallback(async (event, options = {}) => {
    if (event) event.preventDefault();
    if (submitLockRef.current) return;

    const { force = false } = options;
    const answerEntries = Object.entries(answersRef.current).map(([questionId, value]) => ({
      question_id: Number(questionId),
      selected_option: value,
    }));

    if (!force && answerEntries.length === 0) {
      alert("Please answer at least one question");
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
      const response = await fetch("/exam/submit", {
        credentials: "include",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          examId,
          answers: answerEntries,
        }),
      });
      const data = await response.json();
      if (!data.success) {
        alert(data.message || "Submission failed");
        submitLockRef.current = false;
        setIsSubmitting(false);
        return;
      }
      localStorage.setItem(
        "examSuccessMessage",
        "Exam submitted successfully. Results will be published soon."
      );
      navigate(`/result?examId=${examId}`);
    } catch (err) {
      console.error("Exam submit error:", err);
      alert("Server error during submission");
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  }, [examId, navigate, studentId]);

  const recordViolation = useCallback((reason) => {
    const now = Date.now();
    if (now - lastViolationRef.current < VIOLATION_DEBOUNCE_MS) return;
    lastViolationRef.current = now;

    setViolations((prev) => {
      const next = prev + 1;
      setProctorMessage(`Violation ${next}/${MAX_VIOLATIONS}: ${reason}.`);
      if (next >= MAX_VIOLATIONS) {
        setProctorMessage("Violation limit reached. Submitting exam...");
        setTimeout(() => {
          handleSubmit(null, { force: true });
        }, 300);
      }
      return next;
    });
  }, [handleSubmit]);

  useEffect(() => {
    const supported = Boolean(document.fullscreenEnabled);
    setFullscreenSupported(supported);
    setIsFullscreen(Boolean(document.fullscreenElement));
  }, []);

  useEffect(() => {
    if (!fullscreenSupported || fullscreenPrompted || !examReady) return;
    setFullscreenPrompted(true);
    requestFullscreen();
  }, [fullscreenSupported, fullscreenPrompted, requestFullscreen, examReady]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        recordViolation("Tab switching detected");
      }
    };

    const handleBlur = () => {
      recordViolation("Window lost focus");
    };

    const handleFullscreenChange = () => {
      const inFullscreen = Boolean(document.fullscreenElement);
      setIsFullscreen(inFullscreen);
      if (!inFullscreen) {
        recordViolation("Exited fullscreen");
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [recordViolation]);

  useEffect(() => {
    if (loading || !examReady) return;
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [loading, timeLeft, examReady]);

  useEffect(() => {
    if (timeLeft < 0) {
      handleSubmit();
    }
  }, [timeLeft]);

  const formattedTime = useMemo(() => {
    const min = Math.floor(Math.max(timeLeft, 0) / 60);
    const sec = Math.max(timeLeft, 0) % 60;
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
  }, [timeLeft]);

  const updateAnswer = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const isLastQuestion = currentIndex === questionBank.length - 1;
  const examRules = [
    "Remain in fullscreen until the session completes.",
    "Keep this tab active; tab switching counts as a violation.",
    "Answer a question before moving forward and review only by using Previous.",
    "Avoid refreshing or closing the browser while the exam is live.",
    "Reach out to support immediately if the question content looks broken."
  ];
  const progressPercent = questionBank.length
    ? ((currentIndex + 1) / questionBank.length) * 100
    : 0;
  return (
    <div className="exam-shell" aria-hidden={preExamOpen}>
      {preExamOpen && (
        <div className="preexam-overlay">
          <div className="preexam-panel">
            <header className="preexam-header">
              <p className="eyebrow">Pre-exam briefing</p>
              <h1>Review the notice board</h1>
              <p>
                You are about to enter a fully proctored session. This briefing captures the key
                notices, violation rules, and what you must do before the exam timer starts. Once you
                tap “Start exam,” the countdown cannot be reset.
              </p>
            </header>
            <div className="preexam-status">
              <div>
                <span className="status-label">Violations</span>
                <strong>
                  {violations}/{MAX_VIOLATIONS}
                </strong>
              </div>
              <div>
                <span className="status-label">Control room</span>
                <p>{proctorMessage || "Remain focused, keep this tab active, and stay full screen."}</p>
              </div>
            </div>
            <div className="preexam-notices">
              <h2>Instructions</h2>
              <ul>
                {examRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </div>
            <div className="preexam-actions">
              <button
                type="button"
                className="start-btn"
                onClick={() => {
                  setPreExamOpen(false);
                  setExamReady(true);
                  setProctorMessage("Exam session started. Keep fullscreen and stay focused.");
                }}
              >
                Start exam
              </button>
              <p className="preexam-footnote">
                Closing this overlay will begin the session immediately. Keep the browser stable and
                avoid refreshing.
              </p>
            </div>
          </div>
        </div>
      )}
      <section className="exam-top">
        <div className="exam-heading-card">
          <p className="eyebrow">Live proctored session</p>
          <h1>RP2 Scholarship Exam</h1>
        </div>
        <div className="exam-meta-widgets">
          <div className="exam-widget timer-widget">
            <span>Time remaining</span>
            <strong>{formattedTime}</strong>
          </div>
          <div className="exam-widget status-widget">
            <span>Violations</span>
            <strong>
              {violations}/{MAX_VIOLATIONS}
            </strong>
          </div>
          <div className="exam-widget fullscreen-widget">
            {fullscreenSupported
              ? isFullscreen
                ? "Fullscreen active"
                : "Fullscreen required"
              : "Fullscreen unavailable"}
          </div>
        </div>
      </section>

      <section className="exam-grid">
        <aside className="exam-rules-card">
          <div className="rules-header">
            <span className="rules-badge">Exam guide</span>
            <h2>Standardized instructions</h2>
            <p className="rules-intro">
              These steps keep the exam experience predictable for every candidate.
            </p>
          </div>
          <ul className="rules-list">
            {examRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <div className="rules-footer">
            <div className="rules-note">
              {proctorMessage || "You are set. Stay focused and avoid distractions."}
            </div>
            <div className="rules-actions">
              {fullscreenSupported && !isFullscreen && (
                <button type="button" className="proctor-btn" onClick={requestFullscreen}>
                  Enter fullscreen
                </button>
              )}
              {!fullscreenSupported && (
                <span className="rules-note">This browser does not support fullscreen.</span>
              )}
            </div>
          </div>
        </aside>

        <article className="question-panel">
          <form className="question-form" onSubmit={handleSubmit}>
            <div className="question-meta">
              <div className="question-counter">
                <span className="question-counter-label">Live question</span>
                <strong>
                  {questionBank.length ? currentIndex + 1 : "--"} / {questionBank.length || "--"}
                </strong>
              </div>
              <div className="question-progress">
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                </div>
                <small>
                  {questionBank.length
                    ? `${Math.round(progressPercent)}% complete`
                    : "Preparing questions"}
                </small>
              </div>
            </div>

            <div className="question-stage">
              {loading && <p className="status-text">Loading questions...</p>}
              {!loading && error && <p className="status-text error-text">{error}</p>}
              {!loading && !error && !currentQuestion && (
                <div className="status-card">
                  <p className="status-title">Questions already generated</p>
                  <p className="status-subtext">
                    The exam content is ready and waiting for the next step.
                  </p>
                </div>
              )}
              {!loading && !error && currentQuestion && (
                <div className="question-card slide-in-right">
                  <div className="question-prompt">
                    <span className="question-label">Q{currentIndex + 1}</span>
                    <p className="question-text">{currentQuestion.question_text}</p>
                  </div>
                  <div className="option-list">
                    {["A", "B", "C", "D"].map((option) => {
                      const optionKey = `option_${option.toLowerCase()}`;
                      const isSelected = answers[currentQuestion.question_id] === option;
                      return (
                        <label
                          key={option}
                          className={`option-item ${isSelected ? "selected" : ""}`}
                        >
                          <input
                            type="radio"
                            name={`q_${currentQuestion.question_id}`}
                            value={option}
                            checked={isSelected}
                            onChange={() => updateAnswer(currentQuestion.question_id, option)}
                          />
                          <span className="option-index">{option}</span>
                          <span className="option-text">{currentQuestion[optionKey]}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="exam-actions">
              <button
                type="button"
                className="nav-btn"
                id="prevBtn"
                disabled={currentIndex === 0 || isSubmitting}
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              >
                Previous
              </button>
              {!isLastQuestion && (
                <button
                  type="button"
                  className="nav-btn primary"
                  id="nextBtn"
                  disabled={isSubmitting}
                  onClick={() =>
                    setCurrentIndex((prev) => Math.min(questionBank.length - 1, prev + 1))
                  }
                >
                  Next
                </button>
              )}
              {isLastQuestion && (
                <button
                  type="submit"
                  className="submit-btn"
                  id="submitBtn"
                  disabled={isSubmitting}
                >
                  Submit Exam
                </button>
              )}
            </div>
          </form>
        </article>
      </section>
    </div>
  );
}

export default Exam;
