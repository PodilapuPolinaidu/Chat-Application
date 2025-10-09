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

  const createPeerConnection = useCallback(
    (callType = "video") => {
      const configuration = {
        iceServers: [
          { urls: "stun:yourdomain.com:3478" },
          {
            urls: "turn:yourdomain.com:3478",
            username: "poli@gmail.com",
            credential: "Poli@123",
          },
        ],
      };

      const pc = new RTCPeerConnection(configuration);

      // Lock m-line order: audio first, then video (if video)
      pc.addTransceiver("audio", { direction: "sendrecv" });
      if (callState.callType === "video" || callType === "video") {
        pc.addTransceiver("video", { direction: "sendrecv" });
      }

      // Add any local tracks (if available) AFTER adding transceivers so the m-line order stays consistent.
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      pc.ontrack = (event) => {
        const remoteStream = event.streams && event.streams[0];
        if (remoteVideoRef.current && remoteStream) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && callState.callId) {
          // send iceCandidate to the other peer; target must be the other user's id
          const target =
            // if we are callee, callerId is in callerInfo; if caller, we need answerer id (set in callState when accepted)
            callState.callerInfo?.callerId ||
            callState.answererId ||
            receiver?.id;
          socket.emit("iceCandidate", {
            target,
            candidate: event.candidate,
            callId: callState.callId,
          });
        }
      };

      return pc;
    },
    [socket, receiver, callState]
  );

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
        answererId: answerFrom,
      }));

      try {
        // create pc and attach local stream
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
          peerConnectionRef.current = null;
        }
        peerConnectionRef.current = createPeerConnection(callState.callType);

        // get local media (if not already)
        if (!localStreamRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: callState.callType === "video",
            audio: true,
          });
          localStreamRef.current = stream;
          if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        }

        localStreamRef.current
          .getTracks()
          .forEach((track) =>
            peerConnectionRef.current.addTrack(track, localStreamRef.current)
          );

        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);

        // send offer to answerer
        socket.emit("webrtcOffer", {
          target: answerFrom,
          sdp: offer,
          callId,
        });
      } catch (err) {
        console.error("Error creating offer:", err);
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
        // If an existing PC is present, clean it up first
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
          peerConnectionRef.current = null;
        }

        // Mark that we got an incoming offer and save caller info
        setCallState((prev) => ({
          ...prev,
          isIncomingCall: true,
          isCalling: false,
          isRinging: false,
          callId,
          callerInfo: { from, callerId: from }, // 'from' should be caller id
        }));

        // Create PC and attach local stream (getUserMedia must be called earlier / on accept)
        peerConnectionRef.current = createPeerConnection();

        // If we already have local stream, add tracks (if not, we'll add them before answer)
        if (localStreamRef.current) {
          localStreamRef.current
            .getTracks()
            .forEach((track) =>
              peerConnectionRef.current.addTrack(track, localStreamRef.current)
            );
        }

        // set remote offer
        await peerConnectionRef.current.setRemoteDescription(sdp);

        // If we don't have local stream yet (callee hasn't accepted), obtain it now so we can answer
        if (!localStreamRef.current) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: callState.callType === "video" || true, // safe default, you'll prompt user
            audio: true,
          });
          localStreamRef.current = stream;
          if (localVideoRef.current) localVideoRef.current.srcObject = stream;

          stream
            .getTracks()
            .forEach((track) =>
              peerConnectionRef.current.addTrack(track, stream)
            );
        }

        // create answer and send it back
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);

        socket.emit("webrtcAnswer", {
          target: from,
          sdp: answer,
          callId,
        });

        // update callState to on-call
        setCallState((prev) => ({
          ...prev,
          isIncomingCall: false,
          isOnCall: true,
        }));
      } catch (err) {
        console.error("Error handling offer:", err);
        cleanupCall();
      }
    };

    const handleWebRTCAnswer = async ({ sdp }) => {
      if (!peerConnectionRef.current) return;
      try {
        await peerConnectionRef.current.setRemoteDescription(sdp);
      } catch (err) {
        console.error("Error handling answer:", err);
        cleanupCall();
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
