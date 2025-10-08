import React, { useState, useEffect, useCallback } from "react";
import UsersList from "../UsersList/UsersList";
import ChatWindow from "../ChatWindow/ChatWindow";
import Profile from "../Profile/Profile";
import "./chat.css";
import axios from "axios";

const Chat = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [cookieId, setCookieId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({
    loginUser: false,
    receiverUser: false,
  });
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const email = params.get("email");
    const userId = params.get("id");
    if (token) {
      document.cookie = `token=${token}; path=/`;
      document.cookie = `email=${email}; path=/`;
      document.cookie = `id=${userId}; path=/`;
    }

    const getCookieId = () => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; id=`);
      if (parts.length === 2) {
        return Number(parts.pop().split(";").shift());
      }
      return null;
    };

    if (userId) {
      setCookieId(Number(userId));
    } else {
      const id = getCookieId();
      setCookieId(id);
    }
  }, []);

  useEffect(() => {
    if (!cookieId) return;

    const fetchUsers = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/users`
        );
        const data = response.data;

        const filteredUsers = data.filter((u) => u.id !== cookieId);
        const userData = data.find((u) => u.id === cookieId);

        setCurrentUser(userData);
        setUsers(filteredUsers);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [cookieId]);

  const handleUserSelect = useCallback((user) => {
    setSelectedUser(user);
    setStatus((prev) => ({
      ...prev,
      loginUser: false,
      receiverUser: false,
    }));
  }, []);

  if (loading) {
    return (
      <div className="chat-loading">
        <div className="loading-spinner"></div>
        <p>Loading chat...</p>
      </div>
    );
  }

  function showProfile() {
    setStatus((prev) => ({
      ...prev,
      loginUser: !prev.loginUser,
    }));
  }

  return (
    <div className="chat-app-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="user-profile" onClick={() => showProfile()}>
            <div className="user-avatar">
              {currentUser?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="user-info">
              <h3>{currentUser?.name || "User"}</h3>
            </div>
          </div>
        </div>

        <div className="users-section">
          <h4>Contacts ({users.length})</h4>
          <UsersList
            users={users}
            selectedUser={selectedUser}
            onUserSelect={handleUserSelect}
          />
        </div>
      </div>

      <div className="main-chat">
        {selectedUser && currentUser ? (
          <ChatWindow
            currentUser={currentUser}
            receiver={selectedUser}
            setStatus={setStatus}
            key={`chat-${currentUser.id}-${selectedUser.id}`}
          />
        ) : (
          <div className="welcome-screen">
            <div className="welcome-content">
              <div className="welcome-icon">💬</div>
              <h2>Welcome to Chat App</h2>
              <p>Select a contact to start messaging</p>
            </div>
          </div>
        )}

        {status.loginUser && <Profile user={currentUser} />}
        {status.receiverUser && <Profile user={selectedUser} />}
      </div>
    </div>
  );
};

export default React.memo(Chat);
