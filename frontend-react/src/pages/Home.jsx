import useBodyClass from "../hooks/useBodyClass.js";

function Home() {
  useBodyClass("landing-page student-landing");

  return (
    <div className="landing-shell">
        <header className="landing-header">
          <div className="brand">
            <img className="brand-logo" src="/assets/rp2-official.png" alt="RP2 logo" />
            <span className="brand-text">RP2 Scholarship Exam</span>
          </div>
        <nav className="landing-nav">
          <a href="#" className="nav-link">About</a>
          <a href="#" className="nav-link">Eligibility</a>
          <a href="#" className="nav-link">Exam Day</a>
          <a href="#" className="nav-link">Results</a>
          <a className="nav-cta" href="/student/login">Student Login</a>
        </nav>
      </header>

      <main className="landing-main">
        <section className="hero">
          <div className="hero-copy">
            <p className="hero-eyebrow">RP2 Scholarship Examination Application</p>
            <h1>Start your scholarship journey with one trusted portal.</h1>
            <p className="hero-subtitle">
              View eligibility, register for the exam, and track your results without delay.
              Built for students who want clarity from registration to selection.
            </p>
            <div className="hero-actions">
              <a className="button-primary" href="/student/login">Login as Student</a>
              <a className="button-ghost" href="/register">Create Account</a>
            </div>
          </div>
          <div className="hero-art" />
        </section>

        <section className="landing-strip">
          <div className="strip-item">
            <h3>Clear Eligibility</h3>
            <p>See requirements, required documents, and key dates with step-by-step guidance.</p>
          </div>
          <div className="strip-item">
            <h3>Exam Guidance</h3>
            <p>Get test day instructions, center details, allowed materials, and syllabus updates.</p>
          </div>
          <div className="strip-item">
            <h3>Track Results</h3>
            <p>Check scores, rank lists, and scholarship offers with notifications as soon as they release.</p>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        Ac 2025 Scholarship Examination Portal
      </footer>
    </div>
  );
}

export default Home;
