import React, { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import { io } from 'socket.io-client';

const WebRTCConnection = () => {
  const [stream, setStream] = useState(null);
  const [currentCall, setCurrentCall] = useState(null);
  const [isReceivingCall, setIsReceivingCall] = useState(false);
  const [callerId, setCallerId] = useState(null);
  const [peerId, setPeerId] = useState(null);
  const [availablePeers, setAvailablePeers] = useState([]);
  const socket = useRef();
  const peerRef = useRef();
  const videoRef = useRef();
  const remoteVideoRef = useRef();

  useEffect(() => {
    // Initialize WebSocket connection
    socket.current = io('https://backendkyc.onrender.com');

    // Initialize PeerJS
    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', (id) => {
      setPeerId(id);
      console.log('Generated Peer ID:', id);
      // Register peer with signaling server
      socket.current.emit('register-peer', id);
    });

    // Handle updated peers list
    socket.current.on('peers-list', (peers) => {
      console.log('Updated peers list:', peers);
      setAvailablePeers(peers);
    });

    // Handle incoming call notification
    socket.current.on('incoming-call', (callerPeerId) => {
      console.log('Incoming call from:', callerPeerId);
      setIsReceivingCall(true);
      setCallerId(callerPeerId);
    });

    // Handle WebRTC call setup
    peer.on('call', (call) => {
      getUserMediaStream().then((localStream) => {
        setStream(localStream);
        videoRef.current.srcObject = localStream; // Show local video
        call.answer(localStream); // Answer the call
        setCurrentCall(call);

        call.on('stream', (remoteStream) => {
          remoteVideoRef.current.srcObject = remoteStream; // Show remote video
        });

        call.on('close', () => {
          console.log('Call ended');
          cleanupStreams();
        });
      });
    });

    return () => {
      peer.destroy();
      socket.current.disconnect();
    };
  }, []);

  const getUserMediaStream = async () => {
    const constraints = {
      video: true,
      audio: true,
    };
    return await navigator.mediaDevices.getUserMedia(constraints);
  };

  const initiateCall = () => {
    const targetPeerId = availablePeers.find((id) => id !== peerId); // Find another peer
    if (targetPeerId) {
      console.log('Initiating call to:', targetPeerId);
      socket.current.emit('call-peer', targetPeerId);
    } else {
      console.log('No other peers available');
    }
  };

  const acceptCall = () => {
    getUserMediaStream().then((localStream) => {
      setStream(localStream);
      videoRef.current.srcObject = localStream; // Show local video

      const call = peerRef.current.call(callerId, localStream);
      setCurrentCall(call);

      call.on('stream', (remoteStream) => {
        remoteVideoRef.current.srcObject = remoteStream; // Show remote video
      });

      call.on('close', () => {
        console.log('Call ended');
        cleanupStreams();
      });
    });
    setIsReceivingCall(false);
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
    setCallerId(null);
  };

  return (
    <div>
      <h1>WebRTC Video Call</h1>

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
