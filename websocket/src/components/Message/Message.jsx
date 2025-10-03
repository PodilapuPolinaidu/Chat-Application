import React from "react";
import "./message.css";
import { BsCheck, BsCheckAll } from "react-icons/bs";

const Message = React.memo(({ message, isOwn }) => {
  const d = new Date(message.timestamp);

  const isSameDay = (d1, d2) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const isToday = isSameDay(d, new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = isSameDay(d, yesterday);

  const formatTime = (ts) =>
    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const formatDate = (ts) =>
    new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });

  const dateLabel = isToday
    ? "Today"
    : isYesterday
    ? "Yesterday"
    : formatDate(message.timestamp);

  const renderStatusIcon = () => {
    if (!isOwn) return null; // only show ticks for my messages

    switch (message.status) {
      case "pending":
        return (
          <span className="text-muted" title="Pending">
            <BsCheck />
          </span>
        );
      case "sent":
        return (
          <span className="text-muted" title="Sent">
            <BsCheck />
          </span>
        );
      case "delivered":
        return (
          <span className="text-muted" title="Delivered">
            <BsCheckAll />
          </span>
        );
      case "read":
        return (
          <span className="text-primary" title="Read">
            <BsCheckAll />
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`messages ${isOwn ? "message-own" : "message-other"}`}>
      <div className="message-content">
        {!isOwn && <div className="message-sender">{message.sender}</div>}
        <div className="message-bubble">
          <p>{message.content}</p>
          <div className="message-meta">
            <span className="message-time">
              {formatTime(message.timestamp)}
            </span>
            {!isToday && <span className="message-date"> · {dateLabel}</span>}
            {renderStatusIcon()}
          </div>
        </div>
      </div>
    </div>
  );
});

export default Message;
