import React, { useEffect, useRef, useState } from "react";
import Peer from "peerjs";
import { io } from "socket.io-client";

const WebRTCConnection = () => {
  const [stream, setStream] = useState(null);
  const [currentCall, setCurrentCall] = useState(null);
  const [isReceivingCall, setIsReceivingCall] = useState(false);
  const [callerId, setCallerId] = useState(null);
  const [peerId, setPeerId] = useState(null);
  const [availablePeers, setAvailablePeers] = useState([]);
  //const [videoDevices, setVideoDevices] = useState([]);
  const [currentDeviceId, setCurrentDeviceId] = useState(null);
  const [useBackCamera, setUseBackCamera] = useState(false); // Track the camera mode

  const socket = useRef();
  const peerRef = useRef();
  const videoRef = useRef();
  const remoteVideoRef = useRef();

  useEffect(() => {
    // Initialize WebSocket connection
    socket.current = io("https://backendkyc.onrender.com");

    // Initialize PeerJS
    const peer = new Peer({
      config: {
        iceServers: [
          {
            url: "stun:stun.manchtech.com:5349",
            username: "vkyc",
            credential: "esign@vkyc",
          },
        ],
      },
    });
    peerRef.current = peer;

    peer.on("open", (id) => {
      setPeerId(id);
      console.log("Generated Peer ID:", id);
      socket.current.emit("register-peer", id);
    });

    socket.current.on("peers-list", (peers) => {
      console.log("Updated peers list:", peers);
      setAvailablePeers(peers);
    });

    socket.current.on("incoming-call", (callerPeerId) => {
      console.log("Incoming call from:", callerPeerId);
      setIsReceivingCall(true);
      setCallerId(callerPeerId);
    });

    peer.on("call", (call) => {
      getUserMediaStream().then((localStream) => {
        setStream(localStream);
        videoRef.current.srcObject = localStream;
        call.answer(localStream);
        setCurrentCall(call);

        call.on("stream", (remoteStream) => {
          remoteVideoRef.current.srcObject = remoteStream;
        });

        call.on("close", () => {
          console.log("Call ended");
          cleanupStreams();
        });
      });
    });

    return () => {
      peer.destroy();
      socket.current.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useBackCamera]); // Add useBackCamera to dependency to re-trigger when the camera is toggled

  useEffect(() => {
    // Enumerate devices and set initial video device
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const videoInputDevices = devices.filter(
        (device) => device.kind === "videoinput"
      );
     // setVideoDevices(videoInputDevices);

      const backCamera = videoInputDevices.find(
        (device) =>
          device.label.toLowerCase().includes("back") ||
          device.label.toLowerCase().includes("environment")
      );

      setCurrentDeviceId(
        backCamera ? backCamera.deviceId : videoInputDevices[0]?.deviceId
      );
    });
  }, []);

  useEffect(() => {
    if (currentDeviceId) {
      switchCamera(currentDeviceId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDeviceId]);

  const getUserMediaStream = async () => {
    const constraints = {
      video: { facingMode: useBackCamera ? { exact: "environment" } : "user" },
      audio: true,
    };

    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      console.error("Error accessing camera:", err);
      return null;
    }
  };

  const switchCamera = async () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    const newStream = await getUserMediaStream();
    setStream(newStream);
    videoRef.current.srcObject = newStream; // Update video source
  };

  const initiateCall = () => {
    const targetPeerId = availablePeers.find((id) => id !== peerId);
    if (targetPeerId) {
      console.log("Initiating call to:", targetPeerId);
      socket.current.emit("call-peer", targetPeerId);
    } else {
      console.log("No other peers available");
    }
  };

  const acceptCall = () => {
    getUserMediaStream().then((localStream) => {
      setStream(localStream);
      videoRef.current.srcObject = localStream;

      const call = peerRef.current.call(callerId, localStream);
      setCurrentCall(call);

      call.on("stream", (remoteStream) => {
        remoteVideoRef.current.srcObject = remoteStream;
      });

      call.on("close", () => {
        console.log("Call ended");
        cleanupStreams();
      });
    });
    setIsReceivingCall(false);
  };

  const endCall = () => {
    if (currentCall) {
      currentCall.close();
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
    setCallerId(null);
  };

  const toggleCamera = () => {
    setUseBackCamera((prev) => !prev); // Toggle the camera mode
    if (stream) {
      cleanupStreams();
      getUserMediaStream().then((newStream) => {
        setStream(newStream);
        videoRef.current.srcObject = newStream;
      });
    }
  };

  return (
    <div>
      <h1>WebRTC Video Call with Camera Toggle</h1>

      {isReceivingCall ? (
        <div>
          <h2>Incoming Call from {callerId}</h2>
          <button onClick={acceptCall}>Accept Call</button>
        </div>
      ) : (
        <button onClick={initiateCall} disabled={!peerId}>
          Call
        </button>
      )}

      <button onClick={endCall} disabled={!currentCall}>
        End Call
      </button>

      <button onClick={toggleCamera}>
        Switch to {useBackCamera ? "Front" : "Back"} Camera
      </button>

      <div>
        <h2>Local Video</h2>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ width: "80%", border: "1px solid black" }}
        />
      </div>
      <div>
        <h2>Remote Video</h2>
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          style={{ width: "80%", border: "1px solid black" }}
        />
      </div>
    </div>
  );
};

export default WebRTCConnection;
