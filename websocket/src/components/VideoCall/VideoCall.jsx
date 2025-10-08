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

  const pendingCandidatesRef = useRef([]);
  const remoteDescriptionSetRef = useRef(false);
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

    // Reset refs
    pendingCandidatesRef.current = [];
    remoteDescriptionSetRef.current = false;

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
      console.log("🎥 Received remote track:", event.track.kind);
      const remoteStream = event.streams[0];
      if (remoteVideoRef.current && remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
        console.log("✅ Remote video stream set");
      }
    };

    // ICE candidate handling
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("🧊 Sending ICE candidate");
        socket.emit("iceCandidate", {
          target: receiver.id,
          candidate: event.candidate,
          callId: callState.callId,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("🔄 PeerConnection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        console.log("✅ PeerConnection connected successfully!");
      } else if (pc.connectionState === "failed") {
        console.log("❌ PeerConnection failed");
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

    return pc;
  }, [socket, receiver, callState.callId, cleanupCall]);

  const startCall = async (callType = "video") => {
    try {
      // Clean up any existing call first
      cleanupCall();

      setCallState((prev) => ({
        ...prev,
        isCalling: true,
        callType,
      }));

      // Get user media with better constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        video:
          callType === "video"
            ? {
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }
            : false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        console.log("✅ Local video stream set");
      }

      // Create new peer connection
      peerConnectionRef.current = createPeerConnection();

      // Create and set local offer
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);

      // Emit call event
      socket.emit("callUser", {
        targetUserId: receiver.id,
        from: currentUser.name,
        callerId: currentUser.id,
        callType,
        sdp: offer, // Send the offer immediately
      });

      console.log("📞 Call initiated to:", receiver.id);
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

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video:
          callState.callType === "video"
            ? {
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }
            : false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Create peer connection
      peerConnectionRef.current = createPeerConnection();

      // Set remote description from the offer that was sent with the call
      if (callState.remoteOffer) {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(callState.remoteOffer)
        );
      }

      // Create answer
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);

      // Send answer
      socket.emit("webrtcAnswer", {
        target: callState.callerInfo.callerId,
        sdp: answer,
        callId: callState.callId,
      });

      socket.emit("acceptCall", {
        callerId: callState.callerInfo.callerId,
        callId: callState.callId,
      });

      console.log("✅ Call accepted");
    } catch (error) {
      console.error("❌ Error accepting call:", error);
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

    const handleIncomingCall = ({ from, callerId, callType, callId, sdp }) => {
      setCallState({
        isCalling: false,
        isRinging: false,
        isIncomingCall: true,
        isOnCall: false,
        callType,
        callerInfo: { from, callerId },
        callId,
        remoteOffer: sdp, // Store the offer for later use
      });
    };

    const handleCallAccepted = ({ answerFrom, callId }) => {
      setCallState((prev) => ({
        ...prev,
        isRinging: false,
        isOnCall: true,
        callId,
      }));
      console.log("✅ Call accepted by:", answerFrom);
    };

    const handleCallRejected = () => {
      console.log("❌ Call rejected");
      cleanupCall();
    };

    const handleCallCanceled = () => {
      console.log("📞 Call canceled");
      cleanupCall();
    };

    const handleCallEnded = () => {
      console.log("📞 Call ended");
      cleanupCall();
    };

    const handleWebRTCOffer = async ({ sdp, from }) => {
      console.log("🔍 [WebRTC] Received offer from:", from);

      if (!peerConnectionRef.current) {
        console.log("❌ No peer connection for offer");
        return;
      }

      try {
        console.log("📝 [WebRTC] Setting remote description...");
        const offer = new RTCSessionDescription(sdp);
        await peerConnectionRef.current.setRemoteDescription(offer);
        remoteDescriptionSetRef.current = true;

        console.log("✅ [WebRTC] Remote description set successfully");

        // Add pending ICE candidates
        for (const candidate of pendingCandidatesRef.current) {
          await peerConnectionRef.current.addIceCandidate(candidate);
        }
        pendingCandidatesRef.current = [];
      } catch (error) {
        console.error("❌ [WebRTC] Error handling offer:", error);
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
        remoteDescriptionSetRef.current = true;

        // Add pending ICE candidates
        for (const candidate of pendingCandidatesRef.current) {
          await peerConnectionRef.current.addIceCandidate(candidate);
        }
        pendingCandidatesRef.current = [];

        console.log("✅ Remote answer set");
      } catch (error) {
        console.error("❌ Error handling answer:", error);
      }
    };

    const handleICECandidate = async ({ candidate }) => {
      if (!peerConnectionRef.current) return;

      try {
        const iceCandidate = new RTCIceCandidate(candidate);

        if (peerConnectionRef.current.remoteDescription) {
          await peerConnectionRef.current.addIceCandidate(iceCandidate);
          console.log("🧊 ICE candidate added");
        } else {
          console.log("⏳ Queuing ICE candidate");
          pendingCandidatesRef.current.push(iceCandidate);
        }
      } catch (error) {
        console.error("❌ Error adding ICE candidate:", error);
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
  }, [socket, cleanupCall]);

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
