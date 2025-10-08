import React, { useState } from "react";
import "./login.css";
import axios from "axios";
import Swal from "sweetalert2";
import "bootstrap-icons/font/bootstrap-icons.css";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState({ email: "", password: "", server: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      setError("All fields are required.");
      return;
    }
    const emailRegex = /^[^@]+@[^@]+\.[^@]+$/;
    if (!emailRegex.test(email)) {
      setError("Invalid email format.");
      return;
    }
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/users/login`,
        { email, password },
        { withCredentials: true }
      );
      console.log(res);
      Swal.fire({
        title: "Welcome 🎉",
        text: res.data.msg,
        icon: "success",
        confirmButtonColor: "#4CAF50",
        confirmButtonText: "Enter Chat",
      }).then((result) => {
        if (result.isConfirmed) {
          window.location.href =
            "https://chat-application-alpha-navy.vercel.app/home";
        }
      });

      setError("");
    } catch (err) {
      setError({ email: "", password: "", server: "" });
      if (err.response && err.response.data && err.response.data.msg) {
        const msg = err.response.data.msg;
        if (msg.includes("Password")) {
          setError((prev) => ({ ...prev, password: msg }));
        } else if (msg.includes("not")) {
          setError((prev) => ({ ...prev, email: msg }));
        } else {
          setError((prev) => ({ ...prev, server: msg }));
        }
      } else {
        setError((prev) => ({ ...prev, server: "Server not responding" }));
      }
    }
  };

  return (
    <div className="login-section">
      <div className="login-page">
        <div className="chat-preview">
          <h1>ChatZone 💬</h1>
          <div className="chat-window">
            <div className="message left">
              <img src="https://i.pravatar.cc/40?img=3" alt="user" />
              <p>Hey! Ready to join the chat? 😃</p>
            </div>
            <div className="message right">
              <p>Yes! Just logging in 🚀</p>
              <img src="https://i.pravatar.cc/40?img=5" alt="me" />
            </div>

            <div className="message left">
              <img src="https://i.pravatar.cc/40?img=4" alt="user" />
              <p>Awesome, see you inside 🔥</p>
            </div>
            <div className="message right">
              <p>Yes! Just logging in 🚀</p>
              <img src="https://i.pravatar.cc/40?img=5" alt="me" />
            </div>
            <div className="message left">
              <img src="https://i.pravatar.cc/40?img=3" alt="user" />
              <p>Hey! Ready to join the chat? 😃</p>
            </div>
            <div className="message right">
              <img src="https://i.pravatar.cc/40?img=4" alt="user" />
              <p>Awesome, see you inside 🔥</p>
            </div>
          </div>
        </div>
        <div className="login-container">
          <form onSubmit={handleSubmit} className="login-form animate-fade-in">
            <div className="login-header">
              <i className="bi bi-chat-dots-fill chat-icon"></i>
              <h2>Login</h2>
            </div>

            <div className="input-group">
              <label>
                <i className="bi bi-envelope-fill"></i> Email
              </label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {error.email && (
                <p className="error animate-shake">{error.email}</p>
              )}
            </div>

            <div className="input-group">
              <label>
                <i className="bi bi-lock-fill"></i> Password
              </label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              {error.password && (
                <p className="error animate-shake">{error.password}</p>
              )}
            </div>

            <button className="loginBtn" type="submit">
              <i className="bi bi-box-arrow-in-right"></i> Sign In
            </button>
            {error.server && (
              <p className="error animate-shake">{error.server}</p>
            )}

            <div className="extra-links">
              <a style={{ textDecoration: "none" }} href="/">
                Create Account
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
