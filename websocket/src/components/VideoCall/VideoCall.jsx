import { useState, useRef, useCallback, useEffect } from "react";

export const VideoCall = (socket, currentUser, receiver) => {
  const [callState, setCallState] = useState({
    isCalling: false,
    isRinging: false,
    isIncomingCall: false,
    isOnCall: false,
    callType: null,
    callerInfo: null,
    callId: null,
  });

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const callTimerRef = useRef(null);

  // Cleanup function
  const cleanupCall = useCallback(() => {
    console.log("🧹 Cleaning up call...");

    // Stop all media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      localStreamRef.current = null;
    }

    // Clear video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Clear timers
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    setCallState({
      isCalling: false,
      isRinging: false,
      isIncomingCall: false,
      isOnCall: false,
      callType: null,
      callerInfo: null,
      callId: null,
    });
  }, []);

  // In your VideoCall hook, modify the createPeerConnection function
  const createPeerConnection = useCallback(() => {
    // Close existing connection if any
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    const configuration = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    };

    const pc = new RTCPeerConnection(configuration);

    // Add local stream to connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Handle incoming remote stream
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    };

    // ICE candidate handling
    // Add this to your createPeerConnection function
    pc.onconnectionstatechange = () => {
      console.log("🔄 PeerConnection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        console.log("✅ PeerConnection connected successfully!");
      } else if (pc.connectionState === "failed") {
        console.log("❌ PeerConnection failed");
        // Attempt to restart
        setTimeout(() => {
          if (pc.connectionState === "failed") {
            console.log("🔄 Restarting failed connection...");
            cleanupCall();
          }
        }, 2000);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("🧊 ICE connection state:", pc.iceConnectionState);
    };

    pc.onsignalingstatechange = () => {
      console.log("📶 Signaling state:", pc.signalingState);
    };

    pc.onnegotiationneeded = () => {
      console.log("Negotiation needed");
    };

    return pc;
  }, [cleanupCall]);

  // In your startCall and acceptCall functions, make sure to remove existing tracks
  const startCall = async (callType = "video") => {
    try {
      // Clean up any existing call first
      cleanupCall();

      setCallState((prev) => ({
        ...prev,
        isCalling: true,
        callType,
      }));

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: callType === "video",
        audio: true,
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Create new peer connection
      peerConnectionRef.current = createPeerConnection();

      socket.emit("callUser", {
        targetUserId: receiver.id,
        from: currentUser.name,
        callerId: currentUser.id,
        callType,
      });
    } catch (error) {
      console.error("❌ Error starting call:", error);
      cleanupCall();
    }
  };

  const acceptCall = useCallback(async () => {
    if (!callState.isIncomingCall || !callState.callerInfo) return;

    try {
      setCallState((prev) => ({
        ...prev,
        isIncomingCall: false,
        isOnCall: true,
        isRinging: false,
      }));

      const stream = await navigator.mediaDevices.getUserMedia({
        video: callState.callType === "video",
        audio: true,
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      peerConnectionRef.current = createPeerConnection();

      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);

      socket.emit("webrtcAnswer", {
        target: callState.callerInfo.callerId,
        sdp: peerConnectionRef.current.localDescription,
        callId: callState.callId,
      });

      socket.emit("acceptCall", {
        callerId: callState.callerInfo.callerId,
        callId: callState.callId,
      });
    } catch (error) {
      console.error("Error accepting call:", error);
      cleanupCall();
    }
  }, [callState, socket, createPeerConnection, cleanupCall]);

  const rejectCall = useCallback(() => {
    if (callState.isIncomingCall && callState.callerInfo) {
      socket.emit("rejectCall", {
        callerId: callState.callerInfo.callerId,
        callId: callState.callId,
      });
    }
    cleanupCall();
  }, [callState, socket, cleanupCall]);

  const endCall = useCallback(() => {
    if (callState.callId && receiver?.id) {
      socket.emit("endCall", {
        targetUserId: receiver.id,
        callId: callState.callId,
      });
    }
    cleanupCall();
  }, [callState, receiver, socket, cleanupCall]);

  useEffect(() => {
    const handleCallInitiated = ({ callId }) => {
      setCallState((prev) => ({
        ...prev,
        isRinging: true,
        callId,
      }));
    };

    const handleIncomingCall = ({ from, callerId, callType, callId }) => {
      setCallState({
        isCalling: false,
        isRinging: false,
        isIncomingCall: true,
        isOnCall: false,
        callType,
        callerInfo: { from, callerId },
        callId,
      });
    };

    const handleCallAccepted = ({ answerFrom, callId }) => {
      setCallState((prev) => ({
        ...prev,
        isRinging: false,
        isOnCall: true,
        callId,
      }));

      setTimeout(async () => {
        try {
          peerConnectionRef.current = createPeerConnection();
          const offer = await peerConnectionRef.current.createOffer();
          await peerConnectionRef.current.setLocalDescription(offer);

          socket.emit("webrtcOffer", {
            target: answerFrom,
            sdp: offer,
            callId,
          });
        } catch (error) {
          console.error("Error creating offer:", error);
          cleanupCall();
        }
      }, 1000);
    };

    const handleCallRejected = () => {
      cleanupCall();
    };

    const handleCallCanceled = () => {
      cleanupCall();
    };

    const handleCallEnded = () => {
      cleanupCall();
    };

    // In your useEffect socket handlers, update these:

    const handleWebRTCOffer = async ({ sdp, from, callId }) => {
      console.log("🔍 [WebRTC] Received offer from:", from);

      if (!peerConnectionRef.current) {
        console.log("🔄 [WebRTC] Creating new peer connection for offer");
        peerConnectionRef.current = createPeerConnection();
      }

      try {
        // Reset any existing streams
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }

        const offer = new RTCSessionDescription(sdp);
        console.log("📝 [WebRTC] Setting remote description...");

        await peerConnectionRef.current.setRemoteDescription(offer);
        console.log("✅ [WebRTC] Remote description set successfully");

        console.log("📝 [WebRTC] Creating answer...");
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        console.log("✅ [WebRTC] Local description set");

        socket.emit("webrtcAnswer", {
          target: from,
          sdp: peerConnectionRef.current.localDescription,
          callId,
        });
        console.log("📤 [WebRTC] Answer sent back");
      } catch (error) {
        console.error("❌ [WebRTC] Error in handleWebRTCOffer:", error);

        // Clean up and restart on error
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
          peerConnectionRef.current = null;
        }

        // Create fresh connection
        peerConnectionRef.current = createPeerConnection();
      }
    };

    const handleWebRTCAnswer = async ({ sdp }) => {
      if (!peerConnectionRef.current) {
        console.log("❌ No peer connection for answer");
        return;
      }

      try {
        console.log("📨 Handling WebRTC answer...");

        const answer = new RTCSessionDescription(sdp);
        await peerConnectionRef.current.setRemoteDescription(answer);
        console.log("✅ Remote answer set");
      } catch (error) {
        console.error("❌ Error handling answer:", error);
      }
    };

    const handleICECandidate = async ({ candidate }) => {
      if (!peerConnectionRef.current) return;

      try {
        await peerConnectionRef.current.addIceCandidate(candidate);
      } catch (error) {
        console.error("Error adding ICE candidate:", error);
      }
    };

    // Register event listeners
    socket.on("callInitiated", handleCallInitiated);
    socket.on("incomingCall", handleIncomingCall);
    socket.on("callAccepted", handleCallAccepted);
    socket.on("callRejected", handleCallRejected);
    socket.on("callCanceled", handleCallCanceled);
    socket.on("callEnded", handleCallEnded);
    socket.on("webrtcOffer", handleWebRTCOffer);
    socket.on("webrtcAnswer", handleWebRTCAnswer);
    socket.on("iceCandidate", handleICECandidate);

    // Cleanup
    return () => {
      socket.off("callInitiated", handleCallInitiated);
      socket.off("incomingCall", handleIncomingCall);
      socket.off("callAccepted", handleCallAccepted);
      socket.off("callRejected", handleCallRejected);
      socket.off("callCanceled", handleCallCanceled);
      socket.off("callEnded", handleCallEnded);
      socket.off("webrtcOffer", handleWebRTCOffer);
      socket.off("webrtcAnswer", handleWebRTCAnswer);
      socket.off("iceCandidate", handleICECandidate);
    };
  }, [socket, createPeerConnection, cleanupCall]);

  return {
    callState,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    localVideoRef,
    remoteVideoRef,
    cleanupCall,
  };
};
