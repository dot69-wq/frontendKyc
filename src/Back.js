import React, { useEffect, useRef, useState } from "react";
import Peer from "peerjs";

const WebRTCConnection = () => {
  const [peerId, setPeerId] = useState("");
  const [remotePeerId, setRemotePeerId] = useState("");
  const [stream, setStream] = useState(null);
  const [currentCall, setCurrentCall] = useState(null);
  const [useBackCamera, setUseBackCamera] = useState(false);
  const videoRef = useRef();
  const remoteVideoRef = useRef();
  const peerRef = useRef();

  useEffect(() => {
    const peer = new Peer();
    peerRef.current = peer;

    peer.on("open", (id) => {
      console.log("My Peer ID:", id);
      setPeerId(id);
    });

    peer.on("call", (call) => {
      getUserMediaStream().then((localStream) => {
        setStream(localStream);
        videoRef.current.srcObject = localStream; // Display local video
        call.answer(localStream); // Answer the call with our stream
        setCurrentCall(call);

        call.on("stream", (remoteStream) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
          }
        });

        call.on("close", () => {
          console.log("Call ended");
          cleanupStreams();
        });
      });
    });

    return () => peer.destroy(); // Cleanup on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useBackCamera]);

  const getUserMediaStream = async () => {
    const constraints = {
      video: {
        facingMode: useBackCamera ? { exact: "environment" } : "user",
      },
      audio: true,
    };

    return await navigator.mediaDevices.getUserMedia(constraints);
  };

  const startCall = () => {
    if (!remotePeerId || !peerRef.current) return;

    getUserMediaStream().then((localStream) => {
      setStream(localStream);
      videoRef.current.srcObject = localStream; // Display local video

      const call = peerRef.current.call(remotePeerId, localStream);
      setCurrentCall(call);

      call.on("stream", (remoteStream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      });

      call.on("close", () => {
        console.log("Call ended");
        cleanupStreams();
      });
    });
  };

  const endCall = () => {
    if (currentCall) {
      currentCall.close(); // End the call
    }
    cleanupStreams();
  };

  const cleanupStreams = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setStream(null);

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setCurrentCall(null);
  };

  const toggleCamera = () => {
    setUseBackCamera((prev) => !prev);
    if (stream) {
      cleanupStreams(); // Stop current stream
      getUserMediaStream().then((newStream) => {
        setStream(newStream);
        videoRef.current.srcObject = newStream; // Update to new camera
      });
    }
  };

  return (
    <div>
      <h1>WebRTC with React</h1>
      <p>Your Peer ID: {peerId}</p>

      <input
        type="text"
        placeholder="Enter Remote Peer ID"
        value={remotePeerId}
        onChange={(e) => setRemotePeerId(e.target.value)}
      />
      <button onClick={startCall} disabled={!!currentCall}>
        Start Call
      </button>
      <button onClick={endCall} disabled={!currentCall}>
        End Call
      </button>
      <button onClick={toggleCamera}>
        Switch to {useBackCamera ? "Front" : "Back"} Camera
      </button>

      <div>
        <h2>Local Video</h2>
        <video ref={videoRef} autoPlay muted playsInline />
      </div>
      <div>
        <h2>Remote Video</h2>
        <video ref={remoteVideoRef} autoPlay playsInline />
      </div>
    </div>
  );
};

export default WebRTCConnection;
