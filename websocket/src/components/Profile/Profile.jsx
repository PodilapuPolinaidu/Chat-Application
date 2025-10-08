import React from "react";
import "./profile.css";
const Profile = ({ user }) => {

  return (
    <div className="whatsapp-profile">
      <div className="profile-header">
        <div className="header-content">
          <button className="btn-back">
            <i className="bi bi-arrow-left"></i>
          </button>
          <h5>Profile</h5>
        </div>
      </div>

      <div className="profile-image-section">
        <div className="profile-image-container">
          <img
            src={
              "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face"
            }
            alt={user.name}
            className="profile-image"
          />
          <button className="btn-camera">
            <i className="bi bi-camera-fill"></i>
          </button>
        </div>
      </div>

      <div className="profile-info">
        <div className="info-item">
          <div className="info-content">
            <div className="info-text">
              <label className="info-label">Your name</label>
              <p className="info-value">{user.name}</p>
            </div>
            <i className="bi bi-pencil edit-icon"></i>
          </div>
        </div>

        <div className="info-item">
          <div className="info-content">
            <div className="info-text">
              <label className="info-label">About</label>
              <p className="info-value">Hi this is {user.name}</p>
            </div>
            <i className="bi bi-pencil edit-icon"></i>
          </div>
        </div>

        <div className="info-item">
          <div className="info-content">
            <div className="info-text">
              <label className="info-label">Phone</label>
              <p className="info-value">{user.email}</p>
            </div>
          </div>
        </div>

        <div className="info-item">
          <div className="info-content">
            <div className="info-text">
              <label className="info-label">Last seen</label>
            </div>
          </div>
        </div>
      </div>

      <div className="profile-actions">
        <button className="btn-action">
          <i className="bi bi-share"></i>
          Share profile
        </button>
        <button className="btn-action">
          <i className="bi bi-chat-text"></i>
          Send message
        </button>
        <button className="btn-action btn-danger">
          <i className="bi bi-ban"></i>
          Block contact
        </button>
      </div>
    </div>
  );
};

export default Profile;
