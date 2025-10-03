import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import io from "socket.io-client";
import MessageInput from "../MessageInput/MessageInput";
import Message from "../Message/Message";
import "./chatWindow.css";

const socket = io("http://localhost:2000", {
  autoConnect: false,
});

const ChatWindow = React.memo(
  ({ currentUser, receiver, setStatus }) => {
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const messagesEndRef = useRef(null);
    // const [staus, setStatus] = useState(false);
    const room = useMemo(() => {
      if (!currentUser?.id || !receiver?.id) return null;
      return [currentUser.id, receiver.id].sort().join("_");
    }, [currentUser?.id, receiver?.id]);

    const scrollToBottom = useCallback(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    const isReceiverOnline = useMemo(() => {
      return onlineUsers.includes(receiver?.id);
    }, [onlineUsers, receiver?.id]);

    // Handle incoming call

    useEffect(() => {
      if (!room) return;

      async function fetchMessages() {
        setIsLoading(true);
        try {
          const response = await fetch(
            `http://localhost:2000/api/chat/${currentUser.id}/${receiver.id}`
          );
          const data = await response.json();
          setMessages(Array.isArray(data) ? data : []);
        } catch (error) {
          console.error("Error fetching messages:", error);
          setMessages([]);
        } finally {
          setIsLoading(false);
        }
      }

      fetchMessages();
    }, [room, currentUser.id, receiver.id]);

    useEffect(() => {
      if (!room) return;

      if (!socket.connected) {
        socket.connect();
      }

      const handleConnect = () => {
        socket.emit("user_online", currentUser.id);
        socket.emit("join_room", room);
      };

      const handleDisconnect = () => {
        console.log("Socket disconnected");
      };

      const handleReceiveMessage = (message) => {
        setMessages((prev) => {
          const isDuplicate = prev.some(
            (msg) =>
              msg.id === message.id ||
              (msg.tempId && msg.tempId === message.tempId)
          );
          return isDuplicate ? prev : [...prev, message];
        });

        socket.emit("message_delivered", {
          messageId: message.id,
          room,
        });

        if (receiver && message.senderId === receiver.id) {
          socket.emit("message_read", {
            messageId: message.id,
            room,
          });
        }
      };

      const handleUserOnline = (userId) => {
        setOnlineUsers((prev) =>
          prev.includes(userId) ? prev : [...prev, userId]
        );
      };

      const handleUserOffline = (userId) => {
        setOnlineUsers((prev) => prev.filter((id) => id !== userId));
      };

      const handleOnlineUsers = (userIds) => {
        setOnlineUsers(userIds);
      };

      socket.on("connect", handleConnect);
      socket.on("disconnect", handleDisconnect);
      socket.on("receive_message", handleReceiveMessage);
      socket.on("user_online", handleUserOnline);
      socket.on("user_offline", handleUserOffline);
      socket.on("online_users", handleOnlineUsers);

      if (socket.connected) {
        socket.emit("join_room", room);
        socket.emit("user_online", currentUser.id);
      }

      return () => {
        console.log("Cleaning up socket listeners");
        socket.off("connect", handleConnect);
        socket.off("disconnect", handleDisconnect);
        socket.off("receive_message", handleReceiveMessage);
        socket.off("user_online", handleUserOnline);
        socket.off("user_offline", handleUserOffline);
        socket.off("online_users", handleOnlineUsers);

        if (room && socket.connected) {
          socket.emit("leave_room", room);
        }
      };
    }, [room, currentUser.id, receiver]);

    useEffect(() => {
      if (messages.length > 0) {
        scrollToBottom();
      }
    }, [messages, scrollToBottom]);

    // Sending a message
    const handleSendMessage = (content) => {
      if (!content.trim()) return;

      const tempId = Date.now();
      const messageData = {
        senderId: currentUser.id,
        receiverId: receiver.id,
        content: content.trim(),
        room,
        tempId,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [
        ...prev,
        { ...messageData, sender: currentUser.name, status: "pending" },
      ]);

      socket.emit("send_message", messageData, (savedMessage) => {
        if (savedMessage?.id) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.tempId === tempId
                ? { ...savedMessage, sender: currentUser.name, status: "sent" }
                : msg
            )
          );
        }
      });
    };

    useEffect(() => {
      socket.on("message_delivered", (messageId) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, status: "delivered" } : msg
          )
        );
      });

      socket.on("message_read", (messageId) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, status: "read" } : msg
          )
        );
      });

      return () => {
        socket.off("message_delivered");
        socket.off("message_read");
      };
    }, []);

    if (!receiver || !currentUser) {
      return (
        <div className="chat-window-container">
          <div className="no-chat-selected">
            Select a user to start chatting
          </div>
        </div>
      );
    }

    function showPrileInfo() {
      setStatus((prev) => ({
        ...prev,
        receiverUser: true,
      }));
    }

    return (
      <div className="chat-window-container">
        <div className="chat-header">
          <div className="receiver-info" onClick={() => showPrileInfo()}>
            <div className="receiver-avatar">
              {receiver.name.charAt(0).toUpperCase()}
              <div
                className={`status-indicator ${
                  isReceiverOnline ? "online" : "offline"
                }`}
              ></div>
            </div>
            <div className="receiver-details">
              <h3>{receiver.name}</h3>
              <div className="receiver-status">
                <span
                  className={`status-text ${
                    isReceiverOnline ? "online" : "offline"
                  }`}
                >
                  {isReceiverOnline ? "Online" : "Offline"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="messages-container">
          {isLoading ? (
            <div className="loading-messages">
              <div className="loading-spinner"></div>
              <p>Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="no-messages">
              <div className="no-messages-icon">💭</div>
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <Message
                key={
                  msg.id || msg.tempId || `msg-${msg.timestamp}-${msg.senderId}`
                }
                message={msg}
                isOwn={msg.senderId === currentUser.id}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <MessageInput onSendMessage={handleSendMessage} />
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.currentUser?.id === nextProps.currentUser?.id &&
      prevProps.receiver?.id === nextProps.receiver?.id
    );
  }
);

export default ChatWindow;
