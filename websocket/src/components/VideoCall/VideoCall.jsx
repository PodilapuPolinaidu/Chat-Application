import { useState, useRef, useCallback, useEffect } from "react";

export const VideoCall = (socket, currentUser, receiver) => {
  const [callState, setCallState] = useState({
    isCalling: false,
    isRinging: false,
    isIncomingCall: false,
    isOnCall: false,
    callType: null, // 'video' or 'audio'
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
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

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

  // Initialize peer connection
  const createPeerConnection = useCallback(() => {
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
    pc.onicecandidate = (event) => {
      if (event.candidate && callState.callId) {
        socket.emit("iceCandidate", {
          target: callState.callerInfo?.callerId || receiver.id,
          candidate: event.candidate,
          callId: callState.callId,
        });
      }
    };

    return pc;
  }, [socket, receiver, callState]);

  // Start a call
  const startCall = useCallback(
    async (callType = "video") => {
      if (!receiver?.id || !currentUser?.id) return;

      try {
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

        socket.emit("callUser", {
          targetUserId: receiver.id,
          from: currentUser.name,
          callerId: currentUser.id,
          callType,
        });
      } catch (error) {
        console.error("Error starting call:", error);
        cleanupCall();
      }
    },
    [currentUser, receiver, socket, cleanupCall]
  );

  // Accept incoming call
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

  // Reject call
  const rejectCall = useCallback(() => {
    if (callState.isIncomingCall && callState.callerInfo) {
      socket.emit("rejectCall", {
        callerId: callState.callerInfo.callerId,
        callId: callState.callId,
      });
    }
    cleanupCall();
  }, [callState, socket, cleanupCall]);

  // End call
  const endCall = useCallback(() => {
    if (callState.callId && receiver?.id) {
      socket.emit("endCall", {
        targetUserId: receiver.id,
        callId: callState.callId,
      });
    }
    cleanupCall();
  }, [callState, receiver, socket, cleanupCall]);

  // Socket event handlers
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

      // Start WebRTC offer process
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

    const handleCallRejected = ({ reason }) => {
      console.log("Call rejected:", reason);
      cleanupCall();
    };

    const handleCallCanceled = () => {
      console.log("Call canceled by caller");
      cleanupCall();
    };

    const handleCallEnded = () => {
      console.log("Call ended by other party");
      cleanupCall();
    };

    const handleWebRTCOffer = async ({ sdp, from, callId }) => {
      if (!peerConnectionRef.current) return;

      try {
        await peerConnectionRef.current.setRemoteDescription(sdp);
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);

        socket.emit("webrtcAnswer", {
          target: from,
          sdp: answer,
          callId,
        });
      } catch (error) {
        console.error("Error handling offer:", error);
      }
    };

    const handleWebRTCAnswer = async ({ sdp }) => {
      if (!peerConnectionRef.current) return;

      try {
        await peerConnectionRef.current.setRemoteDescription(sdp);
      } catch (error) {
        console.error("Error handling answer:", error);
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
