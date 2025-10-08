import React, { useState } from "react";
import "./register.css";
import axios from "axios";
import Swal from "sweetalert2";
import "bootstrap-icons/font/bootstrap-icons.css";
export default function Register() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    image: null,
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const namePattern = /^[A-Za-z ]+$/;
  const emailPattern = /^[^ ]+@[^ ]+\.[a-z]{2,3}$/;
  const passwordPattern =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;

  function validate() {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    else if (!namePattern.test(formData.name))
      newErrors.name = "Invalid name format";

    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!emailPattern.test(formData.email))
      newErrors.email = "Invalid email format";

    if (!formData.password) newErrors.password = "Password is required";
    else if (!passwordPattern.test(formData.password))
      newErrors.password =
        "Password must contain 8+ chars, uppercase, lowercase, number & special character";

    if (!formData.image) newErrors.image = "Profile image is required";
    else if (!["image/jpeg", "image/png"].includes(formData.image.type))
      newErrors.image = "Only JPG or PNG images allowed";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (validate()) {
      setIsLoading(true);
      const data = new FormData();
      data.append("name", formData.name);
      data.append("email", formData.email);
      data.append("password", formData.password);
      data.append("image", formData.image);
      sendForm(data);
    }
  }

  async function sendForm(obj) {
    try {
      await axios.post(
        "https://chat-application-5-qgda.onrender.com/api/users/register",
        obj
      );
      Swal.fire({
        title: "Success!",
        text: "Chat account created successfully",
        icon: "success",
        showCancelButton: true,
        confirmButtonColor: "#10b981",
        cancelButtonColor: "#6b7280",
        confirmButtonText: "Go to Login",
        cancelButtonText: "Stay Here",
      }).then((result) => {
        if (result.isConfirmed) {
          window.location.href =
            "https://chat-application-5-qgda.onrender.com/login";
        } else {
          setFormData({ name: "", email: "", password: "", image: null });
          setErrors({});
        }
      });
    } catch (err) {
      Swal.fire({
        title: "Registration Failed!",
        text: `${err.response.data.msg}. You can login now`,
        icon: "warning",
        confirmButtonColor: "#10b981",
        cancelButtonText: "Stay Here",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="register-page">
      <div className="register-container">
        <div className="register-card">
          <div className="register-header">
            <i className="bi bi-chat-dots-fill"></i>
            <h2>Create Chat Account</h2>
            <p>Join our community and start chatting</p>
          </div>

          <div className="register-content">
            <div className="form-section">
              <form onSubmit={handleSubmit} className="register-form">
                <div className="form-group">
                  <label>
                    <i className="bi bi-person"></i> Full Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Enter your full name"
                    className={errors.name ? "error-input" : ""}
                  />
                  {errors.name && (
                    <span className="error-message">
                      <i className="bi bi-exclamation-circle"></i> {errors.name}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label>
                    <i className="bi bi-envelope"></i> Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="Enter your email"
                    className={errors.email ? "error-input" : ""}
                  />
                  {errors.email && (
                    <span className="error-message">
                      <i className="bi bi-exclamation-circle"></i>{" "}
                      {errors.email}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label>
                    <i className="bi bi-lock"></i> Password
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder="Create a strong password"
                    className={errors.password ? "error-input" : ""}
                  />
                  {errors.password && (
                    <span className="error-message">
                      <i className="bi bi-exclamation-circle"></i>{" "}
                      {errors.password}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label>
                    <i className="bi bi-image"></i> Profile Image
                  </label>
                  <div className="file-input-wrapper">
                    <input
                      type="file"
                      accept="image/png, image/jpeg"
                      onChange={(e) =>
                        setFormData({ ...formData, image: e.target.files[0] })
                      }
                      className="file-input"
                    />
                    <span className="file-label">
                      {formData.image
                        ? formData.image.name
                        : "Choose profile image (JPG/PNG)"}
                    </span>
                  </div>
                  {errors.image && (
                    <span className="error-message">
                      <i className="bi bi-exclamation-circle"></i>{" "}
                      {errors.image}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  className={`register-btn ${isLoading ? "loading" : ""}`}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <i className="bi bi-arrow-repeat spinner"></i>
                      Creating Account...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-person-plus"></i>
                      Create Account
                    </>
                  )}
                </button>

                <div className="login-redirect">
                  <p>
                    Already have an account?{" "}
                    <a href="https://chat-application-5-qgda.onrender.com/api/users/login">
                      <i className="bi bi-box-arrow-in-right"></i> Login here
                    </a>
                  </p>
                </div>
              </form>
            </div>

            <div className="oauth-section">
              <div className="oauth-content">
                <h3>Quick Sign In</h3>
                <p>Use your social account to get started faster</p>

                <div className="oauth-buttons">
                  <button className="oauth-btn google-btn">
                    <i className="bi bi-google"></i>
                    Continue with Google
                  </button>
                  <button className="oauth-btn github-btn">
                    <i className="bi bi-github"></i>
                    Continue with GitHub
                  </button>
                  <button
                    className="oauth-btn microsoft-btn"
                    onClick={() => {
                      window.location.href =
                        "https://chat-application-5-qgda.onrender.com/api/users/auth/microsoft";
                    }}
                  >
                    <i
                      className="bi bi-microsoft"
                      style={{ paddingRight: "10px" }}
                    ></i>
                    Continue with Microsoft
                  </button>
                </div>

                <div className="oauth-benefits">
                  <div className="benefit-item">
                    <i className="bi bi-lightning"></i>
                    <span>Faster setup</span>
                  </div>
                  <div className="benefit-item">
                    <i className="bi bi-shield-check"></i>
                    <span>Secure login</span>
                  </div>
                  <div className="benefit-item">
                    <i className="bi bi-key"></i>
                    <span>No password to remember</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
