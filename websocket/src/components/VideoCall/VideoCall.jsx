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

  const createPeerConnection = useCallback(() => {
    const configuration = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:relay1.expressturn.com:3478",
          username: "eftekhar",
          credential: "turnserver",
        },
      ],
    };

    const pc = new RTCPeerConnection(configuration);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    };

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

  const startCall = useCallback(
    async (callType = "video") => {
      if (!receiver?.id || !currentUser?.id) return;

      try {
        setCallState((prev) => ({
          ...prev,
          isCalling: true,
          callType,
        }));

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

      await peerConnectionRef.current.setRemoteDescription(
        callState.remoteOffer
      ); // <-- set the offer received earlier
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);

      socket.emit("webrtcAnswer", {
        target: callState.callerInfo.callerId,
        sdp: answer,
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

    const handleCallAccepted = async ({ answerFrom, callId }) => {
      setCallState((prev) => ({
        ...prev,
        isRinging: false,
        isOnCall: true,
        callId,
      }));

      try {
        peerConnectionRef.current = createPeerConnection();

        const stream = await navigator.mediaDevices.getUserMedia({
          video: callState.callType === "video",
          audio: true,
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        stream
          .getTracks()
          .forEach((track) =>
            peerConnectionRef.current.addTrack(track, stream)
          );

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

    const handleWebRTCOffer = async ({ sdp, from, callId }) => {
      try {
        peerConnectionRef.current = createPeerConnection();

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
  }, [socket, createPeerConnection, cleanupCall, callState.callType]);

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
