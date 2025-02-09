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
  const [useBackCamera, setUseBackCamera] = useState(false);

  const socket = useRef();
  const peerRef = useRef();
  const videoRef = useRef();
  const remoteVideoRef = useRef();

  useEffect(() => {
    socket.current = io("https://backendkyc.onrender.com");

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
        if (!localStream) {
          console.error("Failed to get local stream");
          return;
        }

        setStream(localStream);
        videoRef.current.srcObject = localStream;
        call.answer(localStream);
        setCurrentCall(call);

        call.on("stream", (remoteStream) => {
          console.log("Remote stream received");
          remoteVideoRef.current.srcObject = remoteStream;
        });

        call.on("close", cleanupStreams);
        call.on("error", (err) => console.error("Call error:", err));

        console.log("Call received, currentCall set:", call);
      }).catch((err) => console.error("Error getting local stream:", err));
    });

    return () => {
      peer.destroy();
      socket.current.disconnect();
    };
  }, []);

  const getUserMediaStream = async () => {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { facingMode: useBackCamera ? "environment" : "user" },
        audio: true,
      });
    } catch (err) {
      console.error("Error accessing camera:", err);
      return null;
    }
  };

  const initiateCall = () => {
    const targetPeerId = availablePeers.find((id) => id !== peerId);
    if (targetPeerId) {
      console.log("Initiating call to:", targetPeerId);
      socket.current.emit("call-peer", targetPeerId);

      getUserMediaStream().then((localStream) => {
        if (!localStream) return console.error("Failed to get local stream");

        setStream(localStream);
        videoRef.current.srcObject = localStream;

        const call = peerRef.current.call(targetPeerId, localStream);
        setCurrentCall(call);

        call.on("stream", (remoteStream) => {
          console.log("Remote stream received");
          remoteVideoRef.current.srcObject = remoteStream;
        });

        call.on("close", cleanupStreams);
        call.on("error", (err) => console.error("Call error:", err));

        console.log("Call initiated, currentCall set:", call);
      }).catch((err) => console.error("Error getting local stream:", err));
    } else {
      console.log("No other peers available");
    }
  };

  const acceptCall = () => {
    getUserMediaStream().then((localStream) => {
      if (!localStream) return console.error("Failed to get local stream");

      setStream(localStream);
      videoRef.current.srcObject = localStream;

      const call = peerRef.current.call(callerId, localStream);
      setCurrentCall(call);

      call.on("stream", (remoteStream) => {
        console.log("Remote stream received");
        remoteVideoRef.current.srcObject = remoteStream;
      });

      call.on("close", cleanupStreams);
      call.on("error", (err) => console.error("Call error:", err));

      console.log("Call accepted, currentCall set:", call);
    }).catch((err) => console.error("Error getting local stream:", err));

    setIsReceivingCall(false);
  };

  const endCall = () => {
    if (currentCall) currentCall.close();
    cleanupStreams();
  };

  const cleanupStreams = () => {
    if (stream) stream.getTracks().forEach((track) => track.stop());
    setStream(null);
    if (videoRef.current) videoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setCurrentCall(null);
    setCallerId(null);
  };

  const switchCamera = async () => {
    console.log("Switching camera...");
    setUseBackCamera((prev) => !prev);

    try {
      const newStream = await getUserMediaStream();
      if (!newStream) return console.error("Failed to get new video stream.");

      const newVideoTrack = newStream.getVideoTracks()[0];

      if (videoRef.current) videoRef.current.srcObject = newStream;

      if (currentCall && currentCall.peerConnection) {
        console.log("Active call detected, replacing video track...");

        const senders = currentCall.peerConnection.getSenders();
        const videoSender = senders.find((sender) => sender.track?.kind === "video");

        if (videoSender) {
          await videoSender.replaceTrack(newVideoTrack);
          console.log("Video track replaced successfully.");
        } else {
          console.warn("No video sender found, renegotiating call...");
          currentCall.peerConnection.addTrack(newVideoTrack, newStream);
        }
      } else {
        console.warn("No active call, only updating local video stream.");
      }

      if (stream) stream.getTracks().forEach((track) => track.stop());

      setStream(newStream);
    } catch (error) {
      console.error("Error switching camera:", error);
    }
  };

  return (
    <div>
      <h1>WebRTC Video Call</h1>
      {isReceivingCall ? (
        <button onClick={acceptCall}>Accept Call</button>
      ) : (
        <button onClick={initiateCall} disabled={!peerId}>Call</button>
      )}
      <button onClick={endCall} disabled={!currentCall}>End Call</button>
      <button onClick={switchCamera}>Switch Camera</button>
      <video ref={videoRef} autoPlay muted />
      <video ref={remoteVideoRef} autoPlay />
    </div>
  );
};

export default WebRTCConnection;
