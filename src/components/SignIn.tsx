import React, { useState } from "react";
import "./SignIn.css";

interface SignInProps {
  onClose?: () => void;
}

const SignIn: React.FC<SignInProps> = ({ onClose }) => {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  const handleLogin = () => {
    if (!email || !password) {
      alert("Please fill in all fields");
      return;
    }
    alert(`Login successful!\nEmail: ${email}`);
  };

  return (
    <>
      <div className="page">
        <div className="circle1"></div>
        <div className="circle2"></div>
        <div className="circle3"></div>
        <div className="login-container">
          {onClose && (
            <button
              onClick={onClose}
              className="signin-button"
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                zIndex: 20,
              }}
            >
              ×
            </button>
          )}
          <div className="logo">
            <div className="logo-icon">
              <svg
                width="32"
                height="32"
                fill="none"
                stroke="white"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <p>Please login to your account</p>
          </div>

          {/* EMAIL */}
          <div className="form-group">
            <div className="input-wrapper">
              <input
                type="email"
                className="form-control"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* PASSWORD */}
          <div className="form-group">
            <input
              // type={showPass ? "text" : "password"}
              className="form-control"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {/* OPTIONS */}
          <div className="form-options">
            <a href="#">Forgot Password?</a>
          </div>

          {/* LOGIN BUTTON */}
          <button className="btn-login" onClick={handleLogin}>
            Sign In
          </button>

          <div className="signup-prompt">
            Don't have an account? <a href="#">Sign up</a>
          </div>
        </div>
      </div>
    </>
  );
};

export default SignIn;
