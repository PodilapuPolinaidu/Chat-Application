import React from "react";
import "./usersList.css";

const UsersList = React.memo(({ users, selectedUser, onUserSelect }) => {
  return (
    <div className="users-list">
      {users.map((user) => (
        <div
          key={user.id}
          className={`user-item ${
            selectedUser?.id === user.id ? "user-active" : ""
          }`}
          onClick={() => onUserSelect(user)}
        >
          <div className="user-avatar">{user.name.charAt(0).toUpperCase()}</div>
          <div className="user-details">
            <h4>{user.name}</h4>
          </div>
        </div>
      ))}
    </div>
  );
});

export default UsersList;
