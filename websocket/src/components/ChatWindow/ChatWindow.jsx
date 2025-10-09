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
import axios from "axios";
import { VideoCall } from "../VideoCall/VideoCall";
import CallModal from "../CallModel/CallModal";

const socket = io("https://chat-application-5-qgda.onrender.com", {
  autoConnect: false,
});

const ChatWindow = React.memo(
  ({ currentUser, receiver, setStatus }) => {
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState([]);

    const messagesEndRef = useRef(null);
    const {
      callState,
      startCall,
      acceptCall,
      rejectCall,
      endCall,
      localVideoRef,
      remoteVideoRef,
    } = VideoCall(socket, currentUser, receiver);
    const room = useMemo(() => {
      if (!currentUser?.id || !receiver?.id) return null;
      return [currentUser.id, receiver.id].sort().join("_");
    }, [currentUser?.id, receiver?.id]);

    const isReceiverOnline = useMemo(() => {
      return onlineUsers.includes(receiver?.id);
    }, [onlineUsers, receiver?.id]);
    const handleSendMessage = useCallback(
      (content) => {
        if (!content.trim() || !currentUser?.id || !receiver?.id || !room)
          return;

        const tempId = Date.now();
        const messageData = {
          senderid: currentUser.id,
          receiverid: receiver.id,
          content: content.trim(),
          room,
          tempId,
          senderName: currentUser.name,
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [
          ...prev,
          { ...messageData, sender: currentUser.name, status: "pending" },
        ]);

        socket.emit("send_message", messageData, (savedMessage) => {
          console.log(savedMessage);
          if (savedMessage?.id) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.tempId === tempId
                  ? {
                      ...savedMessage,
                      sender: currentUser.name,
                      status: "sent",
                    }
                  : msg
              )
            );
          }
        });
      },
      [currentUser, receiver, room]
    );

    const scrollToBottom = useCallback(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    useEffect(() => {
      if (!room) return;

      const fetchMessages = async () => {
        setIsLoading(true);
        try {
          const response = await axios.get(
            `https://chat-application-5-qgda.onrender.com/api/chat/${currentUser.id}/${receiver.id}`
          );
          const data = response.data;
          console.log(response.data);
          setMessages(Array.isArray(data) ? data : []);
        } catch (error) {
          console.error("Error fetching messages:", error);
          setMessages([]);
        } finally {
          setIsLoading(false);
        }
      };

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

      const handleReceiveMessage = (message) => {
        console.log(message);
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

        if (receiver && message.senderid === receiver.id) {
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
      socket.on("receive_message", handleReceiveMessage);
      socket.on("user_online", handleUserOnline);
      socket.on("user_offline", handleUserOffline);
      socket.on("online_users", handleOnlineUsers);

      if (socket.connected) {
        socket.emit("join_room", room);
        socket.emit("user_online", currentUser.id);
      }

      return () => {
        socket.off("connect", handleConnect);
        socket.off("receive_message", handleReceiveMessage);
        socket.off("user_online", handleUserOnline);
        socket.off("user_offline", handleUserOffline);
        socket.off("online_users", handleOnlineUsers);
      };
    }, [room, currentUser.id, receiver]);

    useEffect(() => {
      if (messages.length > 0) {
        scrollToBottom();
      }
    }, [messages, scrollToBottom]);

    useEffect(() => {
      const handleMessageDelivered = (messageId) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, status: "delivered" } : msg
          )
        );
      };

      const handleMessageRead = (messageId) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, status: "read" } : msg
          )
        );
      };

      socket.on("message_delivered", handleMessageDelivered);
      socket.on("message_read", handleMessageRead);

      return () => {
        socket.off("message_delivered", handleMessageDelivered);
        socket.off("message_read", handleMessageRead);
      };
    }, []);

    useEffect(() => {
      return () => {
        console.log("Component unmounting");
        if (socket.connected && room) {
          socket.emit("leave_room", room);
        }
      };
    }, [room]);

    if (!receiver || !currentUser) {
      return (
        <div className="chat-window-container">
          <div className="no-chat-selected">
            Select a user to start chatting
          </div>
        </div>
      );
    }

    const showProfileInfo = () => {
      setStatus((prev) => ({
        ...prev,
        receiverUser: true,
      }));
    };

    return (
      <div className="chat-window-container">
        <CallModal
          callState={callState}
          onAcceptCall={acceptCall}
          onRejectCall={rejectCall}
          onEndCall={endCall}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          receiver={receiver}
          currentUser={currentUser}
        />
        <div className="chat-header">
          <div className="receiver-info" onClick={showProfileInfo}>
            <div className="receiver-avatar">
              {receiver.name.charAt(0).toUpperCase()}
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
          <div className="call-section">
            <button
              className="call-btn video"
              onClick={() => startCall("video")}
              title="Video Call"
            >
              <i className="bi bi-camera-video"></i>
            </button>
            <button
              className="call-btn audio"
              onClick={() => startCall("audio")}
              title="Audio Call"
            >
              <i className="bi bi-telephone"></i>
            </button>
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
                  msg.id || msg.tempId || `msg-${msg.timestamp}-${msg.senderid}`
                }
                message={msg}
                isOwn={msg.senderid === currentUser.id}
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
