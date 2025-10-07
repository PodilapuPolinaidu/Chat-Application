import React, { useState, useEffect } from "react";
import "./CallModal.css";

const CallModal = ({
  callState,
  onAcceptCall,
  onRejectCall,
  onEndCall,
  localVideoRef,
  remoteVideoRef,
  receiver,
  currentUser,
}) => {
  const [callDuration, setCallDuration] = useState(0);

  useEffect(() => {
    let interval;
    if (callState.isOnCall) {
      const startTime = Date.now();
      interval = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      setCallDuration(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callState.isOnCall]);

  if (
    !callState.isCalling &&
    !callState.isRinging &&
    !callState.isIncomingCall &&
    !callState.isOnCall
  ) {
    return null;
  }

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const getCallTitle = () => {
    if (callState.isIncomingCall) {
      return callState.callerInfo?.from || "Incoming Call";
    } else if (callState.isCalling || callState.isRinging) {
      return receiver.name;
    } else if (callState.isOnCall) {
      return receiver.name;
    }
    return "";
  };

  const getCallSubtitle = () => {
    if (callState.isIncomingCall) {
      return `${callState.callType === "video" ? "Video" : "Audio"} Call`;
    } else if (callState.isRinging) {
      return "Ringing...";
    } else if (callState.isCalling) {
      return "Calling...";
    } else if (callState.isOnCall) {
      return formatDuration(callDuration);
    }
    return "";
  };

  const getCallStatus = () => {
    if (callState.isIncomingCall) {
      return "Incoming Call";
    } else if (callState.isCalling || callState.isRinging) {
      return "Calling...";
    } else if (callState.isOnCall) {
      return "Connected";
    }
    return "";
  };

  return (
    <div className="call-modal-overlay">
      <div className={`call-modal ${callState.isOnCall ? "on-call" : ""}`}>
        {callState.isOnCall && callState.callType === "video" && (
          <div className="video-call-container">
            <div className="video-grid">
              <div className="video-wrapper remote-video-wrapper">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="remote-video"
                />
                <div className="video-label remote-label">
                  <span className="user-name">{receiver.name}</span>
                </div>
              </div>

              <div className="video-wrapper local-video-wrapper">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="local-video"
                />
                <div className="video-label local-label">
                  <span className="user-status">{currentUser.name}(You)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {(!callState.isOnCall || callState.callType === "audio") && (
          <div className="audio-call-ui">
            <div className="call-avatar-large">
              {callState.isIncomingCall
                ? (callState.callerInfo?.from?.charAt(0) || "U").toUpperCase()
                : receiver.name.charAt(0).toUpperCase()}
            </div>
            {callState.isOnCall && (
              <div className="audio-call-participants">
                <div className="participant">
                  <div className="participant-avatar small">
                    {currentUser.name.toUpperCase().slice(0, 9)}
                  </div>
                  <span className="participant-name">You</span>
                </div>
              </div>
            )}
          </div>
        )}

        {!callState.isOnCall && (
          <div className="call-info">
            <h2 className="call-title">{getCallTitle()}</h2>
            <p className="call-subtitle">{getCallSubtitle()}</p>
          </div>
        )}

        {callState.isOnCall && callState.callType === "audio" && (
          <div className="call-info">
            <h2 className="call-title">{getCallTitle()}</h2>
            <p className="call-subtitle">{getCallSubtitle()}</p>
            <div className="call-status">{getCallStatus()}</div>
          </div>
        )}

        <div className="call-controls">
          {callState.isIncomingCall && (
            <>
              <div className="control-group">
                <button
                  className="call-control-btn reject-btn"
                  onClick={onRejectCall}
                  title="Decline"
                >
                  <i className="bi bi-telephone-x"></i>
                </button>
                <span className="control-label">Decline</span>
              </div>

              <div className="control-group">
                <button
                  className="call-control-btn accept-btn"
                  onClick={onAcceptCall}
                  title="Accept"
                >
                  <i className="bi bi-telephone-fill"></i>
                </button>
                <span className="control-label">Accept</span>
              </div>
            </>
          )}

          {(callState.isCalling || callState.isRinging) && (
            <div className="control-group">
              <button
                className="call-control-btn cancel-btn"
                onClick={onEndCall}
                title="Cancel Call"
              >
                <i className="bi bi-telephone-x"></i>
              </button>
              <span className="control-label">Cancel</span>
            </div>
          )}

          {callState.isOnCall && (
            <div className="control-group">
              <button
                className="call-control-btn end-call-btn"
                onClick={onEndCall}
                title="End Call"
              >
                <i className="bi bi-telephone-fill"></i>
              </button>
              <span className="control-label">End Call</span>
            </div>
          )}
        </div>

        {/* Additional controls for active video call */}
        {/* {callState.isOnCall && callState.callType === 'video' && (
          <div className="secondary-controls">
            <button className="secondary-btn" title="Mute">
              <i className="bi bi-mic-fill"></i>
            </button>
            <button className="secondary-btn" title="Switch Camera">
              <i className="bi bi-camera-video"></i>
            </button>
            <button className="secondary-btn" title="Speaker">
              <i className="bi bi-speaker-fill"></i>
            </button>
          </div>
        )} */}
      </div>
    </div>
  );
};

export default CallModal;
