import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export const VideoCallPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('Starting camera…');
  // localStream as state so the ref-sync effect re-runs when it becomes available
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // These refs hold the *current* active resources so controls (mute/hang-up) always
  // reference the live objects even after React StrictMode double-init.
  const streamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const peerRef  = useRef<RTCPeerConnection | null>(null);

  const getBackendOrigin = () => {
    try {
      const url = import.meta.env.VITE_API_URL;
      if (url) return new URL(url).origin;
    } catch { /* ignore */ }
    return 'http://localhost:5000';
  };

  useEffect(() => {
    // `ignore` is scoped to each individual effect invocation.
    // When StrictMode's first cleanup runs, it sets ignore=true and stops
    // resources.  The second invocation gets ignore=false and starts fresh.
    let ignore = false;

    // Local copies so cleanup can reach them even after refs are updated
    let localStreamInEffect: MediaStream | null = null; // renamed to avoid shadowing state
    let localSocket: Socket | null = null;
    let localPeer:   RTCPeerConnection | null = null;

    const makePeer = (stream: MediaStream, socket: Socket): RTCPeerConnection => {
      localPeer?.close();
      const peer = new RTCPeerConnection(ICE_SERVERS);

      stream.getTracks().forEach(track => peer.addTrack(track, stream));

      peer.ontrack = (ev) => {
        if (!ignore && remoteVideoRef.current && ev.streams[0]) {
          remoteVideoRef.current.srcObject = ev.streams[0];
          setConnected(true);
          setStatus('Connected ✓');
        }
      };

      peer.onicecandidate = (ev) => {
        if (ev.candidate) {
          socket.emit('ice-candidate', { roomId, candidate: ev.candidate });
        }
      };

      peer.onconnectionstatechange = () => {
        if (ignore) return;
        const s = peer.connectionState;
        if (s === 'disconnected' || s === 'failed' || s === 'closed') {
          setConnected(false);
          setStatus('Peer disconnected. Waiting…');
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        }
      };

      localPeer = peer;
      peerRef.current = peer;
      return peer;
    };

    const init = async () => {
      try {
        // 1. Acquire media
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (ignore) { stream.getTracks().forEach(t => t.stop()); return; }

        localStreamInEffect = stream;
        streamRef.current = stream;
        setLocalStream(stream);          // triggers the ref-sync effect below
        setStatus('Connecting to signaling server…');

        // 2. Connect Socket.IO
        const socket = io(getBackendOrigin(), { transports: ['websocket', 'polling'] });
        if (ignore) { socket.disconnect(); return; }

        localSocket = socket;
        socketRef.current = socket;

        // 3. Wire up signaling events
        socket.on('connect', () => {
          if (ignore) return;
          console.log('[VC] connected as', socket.id);
          socket.emit('join-room', { roomId, userId: user?.id });
          setStatus('Joined room. Waiting for participants…');
        });

        // Received when we are the JOINER (others already in room)
        socket.on('room-participants', async (participants: string[]) => {
          if (ignore || participants.length === 0) return;
          const stream = streamRef.current;
          if (!stream) return;
          console.log('[VC] room-participants:', participants);
          setStatus('Participant found. Establishing connection…');
          const peer = makePeer(stream, socket);
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          socket.emit('offer', { roomId, offer });
        });

        // Received when we are the EXISTING user (new person joined)
        socket.on('user-connected', ({ socketId }: { userId: string; socketId: string }) => {
          if (ignore) return;
          console.log('[VC] user-connected:', socketId);
          toast.success('Someone joined the room!');
          setStatus('Participant joined. Waiting for offer…');
        });

        // We are the existing user — answer the offer
        socket.on('offer', async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
          if (ignore) return;
          const stream = streamRef.current;
          if (!stream) return;
          console.log('[VC] received offer from', from);
          const peer = makePeer(stream, socket);
          await peer.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          socket.emit('answer', { roomId, answer, to: from });
        });

        // We are the joiner — receive the answer
        socket.on('answer', async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
          if (ignore) return;
          console.log('[VC] received answer');
          const peer = peerRef.current;
          if (peer && peer.signalingState !== 'stable') {
            await peer.setRemoteDescription(new RTCSessionDescription(answer));
          }
        });

        // ICE trickle
        socket.on('ice-candidate', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
          if (ignore || !candidate) return;
          try { await peerRef.current?.addIceCandidate(new RTCIceCandidate(candidate)); }
          catch { /* stale candidate – safe to ignore */ }
        });

        socket.on('user-disconnected', () => {
          if (ignore) return;
          toast('Participant left the call', { icon: '👋' });
          setConnected(false);
          setStatus('Participant left. Waiting…');
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
          peerRef.current?.close();
          peerRef.current = null;
          localPeer = null;
        });

        socket.on('connect_error', (err) => {
          if (ignore) return;
          console.error('[VC] socket error:', err);
          setStatus('Signaling server error — is the backend running?');
        });

      } catch (err) {
        if (!ignore) {
          toast.error('Camera / microphone access denied');
          setStatus('Camera access denied — check browser permissions');
        }
      }
    };

    init();

    // Cleanup: stop everything owned by THIS invocation
    return () => {
      ignore = true;
      localStreamInEffect?.getTracks().forEach(t => t.stop());
      localPeer?.close();
      localSocket?.disconnect();
    };
  // roomId and user.id are the only real dependencies
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user?.id]);

  // Sync local camera stream → video element (handles async+StrictMode timing)
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  /* ── Controls ──────────────────────────────────────────────────────────── */

  const toggleAudio = () => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsAudioEnabled(track.enabled); }
  };

  const toggleVideo = () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsVideoEnabled(track.enabled); }
  };

  const hangUp = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    socketRef.current?.disconnect();
    peerRef.current?.close();
    navigate(-1);
  };

  /* ── Render ────────────────────────────────────────────────────────────── */

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-4 animate-fade-in">

      {/* Header */}
      <div className="flex justify-between items-center bg-white px-5 py-3 rounded-xl shadow-sm border border-gray-200">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Users size={20} className="text-primary-600" />
            Room: <span className="font-mono text-primary-700">{roomId}</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">{status}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
          connected ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-amber-400'}`} />
          {connected ? 'Connected' : 'Waiting'}
        </span>
      </div>

      {/* Video stage */}
      <div className="flex-1 bg-gray-950 rounded-2xl overflow-hidden relative flex items-center justify-center">

        {/* Remote feed (full-screen) */}
        <video ref={remoteVideoRef} autoPlay playsInline
          className={`w-full h-full object-cover transition-opacity duration-300 ${connected ? 'opacity-100' : 'opacity-0'}`}
        />

        {/* Waiting overlay */}
        {!connected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-4 px-8">
            <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
              <Video size={36} className="opacity-40" />
            </div>
            <p className="text-base font-medium">{status}</p>
            <p className="text-xs text-gray-600 text-center max-w-xs">
              Open a second browser tab (or another logged-in device) and go to:
            </p>
            <code
              className="text-xs bg-gray-800 px-4 py-2 rounded-lg text-primary-400 cursor-pointer border border-gray-700"
              onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('URL copied!'); }}
              title="Click to copy"
            >
              {window.location.href}
            </code>
          </div>
        )}

        {/* Local feed (picture-in-picture) */}
        <div className="absolute bottom-24 right-5 w-44 h-32 bg-gray-800 rounded-xl overflow-hidden border-2 border-gray-700 shadow-2xl">
          <video ref={localVideoRef} autoPlay muted playsInline
            className={`w-full h-full object-cover ${!isVideoEnabled ? 'opacity-0' : ''}`}
          />
          {!isVideoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-white text-lg font-bold">
                {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
              </div>
            </div>
          )}
          <span className="absolute bottom-1.5 left-1.5 text-xs text-white/60 px-1 py-px rounded bg-black/40">You</span>
        </div>

        {/* Control bar */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-gray-900/80 backdrop-blur-md px-6 py-3 rounded-full flex items-center gap-4 shadow-2xl border border-gray-700">
          <button onClick={toggleAudio} title={isAudioEnabled ? 'Mute' : 'Unmute'}
            className={`p-3 rounded-full transition-colors ${isAudioEnabled ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}>
            {isAudioEnabled ? <Mic size={20}/> : <MicOff size={20}/>}
          </button>
          <button onClick={toggleVideo} title={isVideoEnabled ? 'Camera off' : 'Camera on'}
            className={`p-3 rounded-full transition-colors ${isVideoEnabled ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}>
            {isVideoEnabled ? <Video size={20}/> : <VideoOff size={20}/>}
          </button>
          <button onClick={hangUp}
            className="p-3 px-6 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors flex items-center gap-2">
            <PhoneOff size={20}/> Leave
          </button>
        </div>
      </div>
    </div>
  );
};
