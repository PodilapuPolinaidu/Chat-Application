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

// Socket instance outside component
const socket = io("http://localhost:2000", {
  autoConnect: false,
});

const ChatWindow = React.memo(
  ({ currentUser, receiver, setStatus }) => {
    // State
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [incomingCall, setIncomingCall] = useState(null);
    const [isInCall, setIsInCall] = useState(false);
    const [outgoingCall, setOutgoingCall] = useState(null);

    // Refs
    const messagesEndRef = useRef(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const remoteAudioRef = useRef(null);
    const peerConnection = useRef(null);
    const callTimeoutRef = useRef(null);

    // Stable refs that don't change
    const stableRefs = useRef({
      localStream: null,
      remoteStream: null,
      isCallActive: false,
      currentCallType: null,
      pendingIceCandidates: [],
      isCaller: false, // Track if this user initiated the call
    }).current;

    // Memoized values
    const room = useMemo(() => {
      if (!currentUser?.id || !receiver?.id) return null;
      return [currentUser.id, receiver.id].sort().join("_");
    }, [currentUser?.id, receiver?.id]);

    const isReceiverOnline = useMemo(() => {
      return onlineUsers.includes(receiver?.id);
    }, [onlineUsers, receiver?.id]);

    // Media functions
    const startMedia = useCallback(
      async (callType) => {
        try {
          console.log("Starting media for:", callType);
          const stream = await navigator.mediaDevices.getUserMedia({
            video: callType === "video",
            audio: true,
          });

          stableRefs.localStream = stream;

          // Always set local video stream if it's a video call
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }

          return stream;
        } catch (error) {
          console.error("Error accessing media:", error);
          alert(
            `Cannot access ${
              callType === "video" ? "camera" : "microphone"
            }. Please check permissions.`
          );
          throw error;
        }
      },
      [stableRefs]
    );

    const cleanupMedia = useCallback(() => {
      console.log("Cleaning up media");

      if (stableRefs.localStream) {
        stableRefs.localStream.getTracks().forEach((track) => track.stop());
        stableRefs.localStream = null;
      }

      if (stableRefs.remoteStream) {
        stableRefs.remoteStream = null;
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }

      // Clear pending ICE candidates
      stableRefs.pendingIceCandidates = [];
      stableRefs.isCaller = false;
    }, [stableRefs]);

    const endCall = useCallback(() => {
      if (!stableRefs.isCallActive) return;

      console.log("Ending call");
      stableRefs.isCallActive = false;
      stableRefs.currentCallType = null;
      stableRefs.isCaller = false;

      if (peerConnection.current) {
        peerConnection.current.close();
        peerConnection.current = null;
      }

      cleanupMedia();
      setIsInCall(false);
      setIncomingCall(null);
      setOutgoingCall(null);

      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }

      if (receiver?.id) {
        socket.emit("endCall", { targetUserId: receiver.id });
      }
    }, [receiver?.id, cleanupMedia, stableRefs]);

    const cancelCall = useCallback(() => {
      console.log("Canceling call");
      setOutgoingCall(null);
      stableRefs.isCaller = false;

      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }

      if (receiver?.id) {
        socket.emit("cancelCall", { targetUserId: receiver.id });
      }
    }, [receiver?.id, stableRefs]);

    // Process pending ICE candidates
    const processPendingIceCandidates = useCallback(async () => {
      if (!peerConnection.current || !peerConnection.current.remoteDescription)
        return;

      while (stableRefs.pendingIceCandidates.length > 0) {
        const candidate = stableRefs.pendingIceCandidates.shift();
        try {
          await peerConnection.current.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
          console.log("Processed pending ICE candidate");
        } catch (error) {
          console.error("Error processing pending ICE candidate:", error);
        }
      }
    }, [stableRefs]);

    // Create WebRTC offer (caller side)
    const createOffer = useCallback(
      async (callType) => {
        try {
          console.log("Creating offer as caller, type:", callType);

          if (peerConnection.current) {
            peerConnection.current.close();
          }

          peerConnection.current = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          });

          const stream = await startMedia(callType);
          stableRefs.currentCallType = callType;
          stableRefs.isCaller = true;

          // Add local tracks to connection
          stream.getTracks().forEach((track) => {
            peerConnection.current.addTrack(track, stream);
          });

          // Handle incoming remote stream
          peerConnection.current.ontrack = (event) => {
            console.log(
              "Received remote stream - tracks:",
              event.streams[0].getTracks().length
            );
            stableRefs.remoteStream = event.streams[0];

            if (callType === "video" && remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = stableRefs.remoteStream;
              remoteVideoRef.current.play().catch(console.error);
            } else if (remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = stableRefs.remoteStream;
            }
          };

          // Handle ICE candidates
          peerConnection.current.onicecandidate = (event) => {
            if (event.candidate && receiver?.id) {
              socket.emit("iceCandidate", {
                target: receiver.id,
                candidate: event.candidate,
              });
            }
          };

          // Create and send offer
          const offer = await peerConnection.current.createOffer();
          await peerConnection.current.setLocalDescription(offer);

          socket.emit("webrtcOffer", {
            target: receiver.id,
            sdp: offer,
            callType: callType,
          });

          console.log("Offer created and sent");
        } catch (error) {
          console.error("Error creating offer:", error);
          endCall();
        }
      },
      [startMedia, endCall, stableRefs, receiver?.id]
    );

    // Handle WebRTC offer (callee side)
    const handleOffer = useCallback(
      async (sdp, from, callType) => {
        try {
          console.log("Handling offer from:", from, "type:", callType);

          if (peerConnection.current) {
            peerConnection.current.close();
          }

          peerConnection.current = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          });

          const stream = await startMedia(callType);
          stableRefs.currentCallType = callType;
          stableRefs.isCaller = false;

          // Add local tracks to connection
          stream.getTracks().forEach((track) => {
            peerConnection.current.addTrack(track, stream);
          });

          // Handle incoming remote stream
          peerConnection.current.ontrack = (event) => {
            console.log(
              "Received remote stream - tracks:",
              event.streams[0].getTracks().length
            );
            stableRefs.remoteStream = event.streams[0];

            if (callType === "video" && remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = stableRefs.remoteStream;
              remoteVideoRef.current.play().catch(console.error);
            } else if (remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = stableRefs.remoteStream;
            }
          };

          // Handle ICE candidates
          peerConnection.current.onicecandidate = (event) => {
            if (event.candidate) {
              socket.emit("iceCandidate", {
                target: from,
                candidate: event.candidate,
              });
            }
          };

          // Set remote description and create answer
          await peerConnection.current.setRemoteDescription(
            new RTCSessionDescription(sdp)
          );

          // Process any pending ICE candidates
          await processPendingIceCandidates();

          const answer = await peerConnection.current.createAnswer();
          await peerConnection.current.setLocalDescription(answer);

          socket.emit("webrtcAnswer", {
            target: from,
            sdp: answer,
          });

          console.log("Answer created and sent");
        } catch (error) {
          console.error("Error handling offer:", error);
          endCall();
        }
      },
      [startMedia, endCall, stableRefs, processPendingIceCandidates]
    );

    // Handle WebRTC answer
    const handleAnswer = useCallback(
      async (sdp) => {
        try {
          console.log("Handling answer from receiver");
          if (
            peerConnection.current &&
            peerConnection.current.signalingState !== "stable"
          ) {
            await peerConnection.current.setRemoteDescription(
              new RTCSessionDescription(sdp)
            );
            // Process any pending ICE candidates after setting remote description
            await processPendingIceCandidates();
            console.log("Remote description set from answer");

            // Now activate the call
            stableRefs.isCallActive = true;
            setIsInCall(true);
            setOutgoingCall(null);
          }
        } catch (error) {
          console.error("Error handling answer:", error);
          endCall();
        }
      },
      [stableRefs, processPendingIceCandidates, endCall]
    );

    // Handle ICE candidate with proper timing
    const handleIceCandidate = useCallback(
      async (candidate) => {
        if (!peerConnection.current) {
          console.log("No peer connection, storing ICE candidate for later");
          stableRefs.pendingIceCandidates.push(candidate);
          return;
        }

        if (!peerConnection.current.remoteDescription) {
          console.log("Remote description not set yet, storing ICE candidate");
          stableRefs.pendingIceCandidates.push(candidate);
          return;
        }

        try {
          await peerConnection.current.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
          console.log("Successfully added ICE candidate");
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      },
      [stableRefs]
    );

    // Call initiation (caller)
    const initiateCall = useCallback(
      (callType) => {
        if (!receiver?.id || !currentUser?.id) return;

        if (!isReceiverOnline) {
          alert("User is offline. Cannot make call.");
          return;
        }

        console.log(`Initiating ${callType} call to:`, receiver.name);

        setOutgoingCall({
          targetUser: receiver.name,
          callType: callType,
          timestamp: Date.now(),
        });

        socket.emit("callUser", {
          targetUserId: receiver.id,
          from: currentUser.name,
          callerId: currentUser.id,
          callType: callType,
        });

        // Auto cancel after 30 seconds
        if (callTimeoutRef.current) {
          clearTimeout(callTimeoutRef.current);
        }

        callTimeoutRef.current = setTimeout(() => {
          if (outgoingCall) {
            console.log("Call timeout - no response");
            cancelCall();
            alert("Call not answered. Try again later.");
          }
        }, 30000);
      },
      [receiver, currentUser, isReceiverOnline, cancelCall, outgoingCall]
    );

    // Accept incoming call (callee)
    const acceptCall = useCallback(() => {
      if (!incomingCall) return;

      console.log("Accepting call from:", incomingCall.from);
      socket.emit("acceptCall", { callerId: incomingCall.callerId });

      // Start media immediately when accepting call
      const callType = incomingCall.callType;
      startMedia(callType)
        .then(() => {
          stableRefs.currentCallType = callType;
          stableRefs.isCallActive = true;
          setIsInCall(true);
          setIncomingCall(null);
        })
        .catch((error) => {
          console.error("Failed to start media for call:", error);
          socket.emit("rejectCall", { callerId: incomingCall.callerId });
          setIncomingCall(null);
        });
    }, [incomingCall, startMedia, stableRefs]);

    // Separate call handlers for better clarity
    const handleVideoCall = useCallback(() => {
      initiateCall("video");
    }, [initiateCall]);

    const handleAudioCall = useCallback(() => {
      initiateCall("audio");
    }, [initiateCall]);

    // Message handling
    const handleSendMessage = useCallback(
      (content) => {
        if (!content.trim() || !currentUser?.id || !receiver?.id || !room)
          return;

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

    // Scroll to bottom
    const scrollToBottom = useCallback(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    // Effects
    useEffect(() => {
      if (!room) return;

      const fetchMessages = async () => {
        setIsLoading(true);
        try {
          const response = await fetch(
            ` https://chat-application-3-d7ex.onrender.com/api/chat/${currentUser.id}/${receiver.id}`
          );
          const data = await response.json();
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

    // Socket connection and basic events
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

    // Message scroll effect
    useEffect(() => {
      if (messages.length > 0) {
        scrollToBottom();
      }
    }, [messages, scrollToBottom]);

    // Message status effects
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

    // Call events
    useEffect(() => {
      console.log("Setting up call event listeners");

      const handleIncomingCall = ({ from, callerId, callType }) => {
        console.log("Incoming call from:", from, "type:", callType);
        setIncomingCall({ from, callerId, callType });
      };

      const handleCallAccepted = async ({ answerFrom }) => {
        console.log("Call accepted by:", answerFrom);
        // Only create offer if we are the caller
        if (outgoingCall && stableRefs.isCaller === false) {
          await createOffer(outgoingCall.callType);
        }
      };

      const handleCallRejected = () => {
        console.log("Call rejected");
        alert("Receiver rejected your call");
        setOutgoingCall(null);
        stableRefs.isCaller = false;
      };

      const handleCallCanceled = () => {
        console.log("Call canceled");
        setIncomingCall(null);
        alert("Call was canceled by the caller");
      };

      const handleWebrtcOffer = async ({ sdp, from, callType }) => {
        console.log("Received WebRTC offer from:", from);
        await handleOffer(sdp, from, callType);
      };

      const handleWebrtcAnswer = async ({ sdp }) => {
        console.log("Received WebRTC answer");
        await handleAnswer(sdp);
      };

      const handleIceCandidateEvent = async ({ candidate }) => {
        console.log("Received ICE candidate");
        await handleIceCandidate(candidate);
      };

      const handleCallEnded = () => {
        console.log("Call ended by other user");
        endCall();
      };

      // Remove existing listeners
      socket.off("incomingCall");
      socket.off("callAccepted");
      socket.off("callRejected");
      socket.off("callCanceled");
      socket.off("webrtcOffer");
      socket.off("webrtcAnswer");
      socket.off("iceCandidate");
      socket.off("callEnded");

      // Add new listeners
      socket.on("incomingCall", handleIncomingCall);
      socket.on("callAccepted", handleCallAccepted);
      socket.on("callRejected", handleCallRejected);
      socket.on("callCanceled", handleCallCanceled);
      socket.on("webrtcOffer", handleWebrtcOffer);
      socket.on("webrtcAnswer", handleWebrtcAnswer);
      socket.on("iceCandidate", handleIceCandidateEvent);
      socket.on("callEnded", handleCallEnded);

      return () => {
        console.log("Cleaning up call listeners");
        socket.off("incomingCall", handleIncomingCall);
        socket.off("callAccepted", handleCallAccepted);
        socket.off("callRejected", handleCallRejected);
        socket.off("callCanceled", handleCallCanceled);
        socket.off("webrtcOffer", handleWebrtcOffer);
        socket.off("webrtcAnswer", handleWebrtcAnswer);
        socket.off("iceCandidate", handleIceCandidateEvent);
        socket.off("callEnded", handleCallEnded);
      };
    }, [
      createOffer,
      handleOffer,
      handleAnswer,
      endCall,
      handleIceCandidate,
      outgoingCall,
      stableRefs,
    ]);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        console.log("Component unmounting");
        endCall();
        if (socket.connected && room) {
          socket.emit("leave_room", room);
        }
      };
    }, [room, endCall]);

    // Early return if no receiver
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

    const currentCallType =
      incomingCall?.callType ||
      outgoingCall?.callType ||
      stableRefs.currentCallType;

    return (
      <div className="chat-window-container">
        <div className="chat-header">
          <div className="receiver-info" onClick={showProfileInfo}>
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
          <div className="call-section">
            <button
              className={`call-btn video ${
                !isReceiverOnline ? "disabled" : ""
              }`}
              onClick={handleVideoCall}
              disabled={!isReceiverOnline}
              title="Video Call"
            >
              <i className="bi bi-camera-video"></i>
            </button>
            <button
              className={`call-btn audio ${
                !isReceiverOnline ? "disabled" : ""
              }`}
              onClick={handleAudioCall}
              disabled={!isReceiverOnline}
              title="Audio Call"
            >
              <i className="bi bi-telephone"></i>
            </button>
          </div>
        </div>

        {/* Outgoing Call Modal */}
        {outgoingCall && (
          <div className="call-modal outgoing-call">
            <div className="call-modal-content">
              <div className="call-icon">
                {outgoingCall.callType === "video" ? "📹" : "🔊"}
              </div>
              <h3>Calling {outgoingCall.targetUser}</h3>
              <p>
                {outgoingCall.callType === "video" ? "Video" : "Audio"} call -
                Waiting for response...
              </p>
              <div className="call-actions">
                <button className="cancel-call-btn" onClick={cancelCall}>
                  Cancel Call
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Incoming Call Modal */}
        {incomingCall && !isInCall && (
          <div className="call-modal incoming-call">
            <div className="call-modal-content">
              <div className="call-icon">
                {incomingCall.callType === "video" ? "📹" : "🔊"}
              </div>
              <h3>Incoming Call</h3>
              <p>
                {incomingCall.from} is calling you ({incomingCall.callType}{" "}
                call)
              </p>
              <div className="call-actions">
                <button className="accept-call-btn" onClick={acceptCall}>
                  Accept
                </button>
                <button
                  className="reject-call-btn"
                  onClick={() => {
                    socket.emit("rejectCall", {
                      callerId: incomingCall.callerId,
                    });
                    setIncomingCall(null);
                  }}
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        )}

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

        {isInCall && (
          <div className="call-container">
            <div className="call-header">
              <h3>
                {currentCallType === "video" ? "Video" : "Audio"} Call with{" "}
                {incomingCall?.from || receiver.name}
              </h3>
            </div>

            {currentCallType === "video" ? (
              <div className="video-call-container">
                <video
                  className="remote-video"
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  muted={false}
                />
                <video
                  className="local-video"
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                />
              </div>
            ) : (
              <div className="audio-call-container">
                <div className="audio-call-icon">🔊</div>
                <p>
                  Audio call in progress with{" "}
                  {incomingCall?.from || receiver.name}
                </p>
                <audio ref={remoteAudioRef} autoPlay playsInline />
              </div>
            )}

            <div className="call-controls">
              <button className="end-call-btn" onClick={endCall}>
                End Call
              </button>
            </div>
          </div>
        )}

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
