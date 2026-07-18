import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AlertTriangle, Clock, ChevronLeft, ChevronRight, CheckCircle2, ShieldAlert, X } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export default function ExamPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // { questionId: selectedOption }
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [cheatingStrikes, setCheatingStrikes] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [isProctoringActive, setIsProctoringActive] = useState(false);
  const [proctorWarning, setProctorWarning] = useState(null);
  const [isDisqualified, setIsDisqualified] = useState(false);
  const [fullscreenBreached, setFullscreenBreached] = useState(false);
  const [fullscreenTimer, setFullscreenTimer] = useState(5);

  // QR Device Pairing states
  const [isMobileCamPaired, setIsMobileCamPaired] = useState(false);

  const countdownRef = useRef(null);

  // Proctoring audio & video states and references
  const [volume, setVolume] = useState(0);
  const [audioWarning, setAudioWarning] = useState(false);
  const videoRef = useRef(null);
  const audioStreamRef = useRef(null);
  const videoStreamRef = useRef(null);

  const stopMediaStreams = () => {
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(track => track.stop());
      videoStreamRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    setVolume(0);
    setAudioWarning(false);
  };

  // 📹 WEBCAM & AUDIO PROCTORING STREAM INITIALIZATION
  useEffect(() => {
    if (!isCalibrated) return;

    let audioContext = null;
    let analyser = null;
    let dataArray = null;
    let animationFrameId = null;

    const startStreams = async () => {
      // 1. Request camera stream
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoStreamRef.current = videoStream;
        if (videoRef.current) {
          videoRef.current.srcObject = videoStream;
        }
      } catch (err) {
        console.warn("Webcam proctoring permission denied or unavailable:", err);
      }

      // 2. Request microphone stream
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = audioStream;
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(audioStream);
        source.connect(analyser);
        analyser.fftSize = 32;
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        const updateDecibels = () => {
          if (!analyser || !dataArray) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const avg = sum / bufferLength;
          setVolume(avg); // decibel average
          
          if (avg > 75) {
            setAudioWarning(true);
          } else {
            setAudioWarning(false);
          }

          animationFrameId = requestAnimationFrame(updateDecibels);
        };
        updateDecibels();
      } catch (err) {
        console.warn("Microphone proctoring permission denied or unavailable:", err);
      }

      // 3. Mark media calibration complete and activate secure proctoring after 1.2s delay
      // This delay ensures native permission dialogs are closed and page focus is fully restored!
      setTimeout(() => {
        setIsProctoringActive(true);
        console.log("[ProctorSystem] Media calibration completed. Proctoring active!");
      }, 1200);
    };

    startStreams();

    // Clean up streams on unmount
    return () => {
      stopMediaStreams();
      if (audioContext) {
        audioContext.close();
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isCalibrated]);



  // 1. Initial Load: Fetch Quiz and Questions, and Synchronize Attempt Timer
  useEffect(() => {
    const initializeExam = async () => {
      try {
        setLoading(true);
        // Find attempt details to grab Quiz ID
        const attemptRes = await axios.get(`${API_URL}/attempts/${attemptId}`);
        const attempt = attemptRes.data;

        if (attempt.status !== 'IN_PROGRESS') {
          alert('This quiz session is already completed.');
          navigate('/');
          return;
        }

        setQuiz(attempt.quiz);
        setCheatingStrikes(attempt.cheatingStrikes);

        // Fetch student-facing questions (EXCLUDES correctOption) with attemptId seed for dynamic shuffling
        const qRes = await axios.get(`${API_URL}/quizzes/${attempt.quizId}/exam-questions?attemptId=${attemptId}`);
        setQuestions(qRes.data);

        // Synchronize remaining time
        // Re-call the start endpoint to compute exact server-side drift
        const startRes = await axios.post(`${API_URL}/attempts/start`, { quizId: attempt.quizId });
        setRemainingSeconds(startRes.data.remainingSeconds);

        // Restore pre-saved answers if any (optional extension)
        const preSavedAnswers = {};
        attempt.answers?.forEach(ans => {
          if (ans.selectedOption) {
            preSavedAnswers[ans.questionId] = ans.selectedOption;
          }
        });
        setAnswers(preSavedAnswers);

      } catch (err) {
        console.error('Failed to initialize exam:', err);
        alert('Could not fetch quiz session.');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    initializeExam();
  }, [attemptId]);

  // 2. Resilient Timer Thread
  useEffect(() => {
    if (!isCalibrated || remainingSeconds === null || remainingSeconds <= 0) return;

    countdownRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          handleAutoSubmit(); // submit instantly
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownRef.current);
  }, [isCalibrated, remainingSeconds]);

  // Fullscreen breach countdown timer
  useEffect(() => {
    if (!fullscreenBreached) {
      setFullscreenTimer(5);
      return;
    }

    const timer = setInterval(() => {
      setFullscreenTimer(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setCheatingStrikes(5);
          setIsDisqualified(true);
          handleBrutalSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [fullscreenBreached]);

  const handleBrutalSubmit = async () => {
    stopMediaStreams();
    setSubmitting(true);
    try {
      const formattedAnswers = Object.entries(answers).map(([qid, val]) => ({
        questionId: parseInt(qid),
        selectedOption: val
      }));
      await axios.post(`${API_URL}/attempts/submit`, {
        attemptId: parseInt(attemptId),
        answers: formattedAnswers
      });
      setTimeout(() => {
        navigate('/');
      }, 3000);
    } catch (err) {
      console.error(err);
      navigate('/');
    }
  };

  const handleReenterFullscreen = async () => {
    try {
      const docEl = document.documentElement;
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      } else if (docEl.mozRequestFullScreen) {
        await docEl.mozRequestFullScreen();
      } else if (docEl.msRequestFullscreen) {
        await docEl.msRequestFullscreen();
      }
      setFullscreenBreached(false);
      setFullscreenTimer(5);
    } catch (err) {
      console.warn("Could not re-enter fullscreen:", err);
    }
  };

  // Canonical React Side-effects for Cheating Strikes
  useEffect(() => {
    if (cheatingStrikes === 0 || loading || submitting) return;

    if (cheatingStrikes >= 5) {
      stopMediaStreams();
      setIsDisqualified(true);
      handleBrutalSubmit();
    } else {
      setProctorWarning(`⚠️ INTEGRITY WARNING: Focus loss, fullscreen exit, or tab switch detected! Strike ${cheatingStrikes}/5 registered. (Auto-submits on Strike 5)`);
    }
  }, [cheatingStrikes]);

  // 3. PROCTORING: Bulletproof Tab Switching & Window Focus Proctoring
  useEffect(() => {
    if (!isProctoringActive || loading || submitting) return;

    let lastViolationTime = 0;

    const recordViolation = async () => {
      const now = Date.now();
      if (now - lastViolationTime < 2000) return; // 2-second cooldown to prevent duplicate triggers (blur + hide)
      lastViolationTime = now;

      // Increment strikes client-side instantly
      setCheatingStrikes(prev => prev + 1);

      // Synchronize to backend in the background
      try {
        await axios.post(`${API_URL}/attempts/violation`, { attemptId });
      } catch (err) {
        console.error('Failed to record tab violation on server:', err);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordViolation();
      }
    };

    const checkFullscreenState = () => {
      const isHTML5FS = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );

      console.log("[Proctoring Debug] Fullscreen State Checked:", {
        isHTML5FullscreenActive: isHTML5FS,
        fullscreenElement: document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height
      });

      const active = isHTML5FS;

      if (!active && !isDisqualified) {
        setFullscreenBreached(true);
        recordViolation();
      }
    };

    const handleFullscreenChange = () => {
      checkFullscreenState();
    };

    const handleResize = () => {
      checkFullscreenState();
    };

    const handleBlur = () => {
      recordViolation();
    };

    const handleCopyCutPaste = (e) => {
      e.preventDefault();
      if (e.clipboardData) {
        e.clipboardData.setData('text/plain', '⚠️ COPYING PROHIBITED IN SECURE EXAM ⚠️');
      }
      setProctorWarning("🚫 COPY/PASTE BLOCKED: Copying, cutting, or pasting text is strictly prohibited during this secure assessment!");
    };

    const handleKeyDown = (e) => {
      // 1. Capture Escape Key and trigger breach instantly on first press
      if (e.key === 'Escape' || e.keyCode === 27) {
        if (!isDisqualified) {
          console.log("[ProctorSystem] Escape key exit detected! Triggering breach overlay.");
          setFullscreenBreached(true);
          recordViolation();
        }
      }

      // 2. Block Developer Tools (F12)
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        setProctorWarning("🚫 DEVTOOLS BLOCKED: Accessing Developer Tools is strictly prohibited during this secure assessment!");
      }

      // 3. Block Ctrl+Shift+I / Cmd+Opt+I (Inspect element)
      if ((e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.keyCode === 73)) || 
          (e.metaKey && e.altKey && (e.key === 'I' || e.key === 'i' || e.keyCode === 73))) {
        e.preventDefault();
        setProctorWarning("🚫 DEVTOOLS BLOCKED: Accessing Developer Tools is strictly prohibited during this secure assessment!");
      }

      // 4. Block Ctrl+U / Cmd+Opt+U (View source)
      if ((e.ctrlKey && (e.key === 'U' || e.key === 'u' || e.keyCode === 85)) || 
          (e.metaKey && e.altKey && (e.key === 'U' || e.key === 'u' || e.keyCode === 85))) {
        e.preventDefault();
        setProctorWarning("🚫 VIEW SOURCE BLOCKED: Viewing page source code is strictly prohibited during this secure assessment!");
      }

      // 5. Block F11 (Browser Fullscreen Toggle)
      if (e.key === 'F11' || e.keyCode === 122) {
        e.preventDefault();
      }
    };

    const handleFullscreenError = () => {
      console.log("[ProctorSystem] Fullscreen error event fired! Triggering breach overlay.");
      setFullscreenBreached(true);
      recordViolation();
    };

    console.log("[ProctorSystem] 🔒 Secure proctoring event listeners successfully attached!");

    // Shield modern clipboard API from browser extensions
    const originalWriteText = navigator.clipboard ? navigator.clipboard.writeText : null;
    if (navigator.clipboard) {
      navigator.clipboard.writeText = async () => {
        console.warn("[ProctorSystem] Blocked writeText clipboard write.");
        return Promise.resolve();
      };
    }

    // Initial check after 800ms to verify secure fullscreen is active
    const initialCheckTimeout = setTimeout(() => {
      const active = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      console.log("[ProctorSystem] Initial Fullscreen Check completed. Active:", active);
      if (!active && !isDisqualified) {
        setFullscreenBreached(true);
        recordViolation();
      }
    }, 800);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    document.addEventListener('fullscreenerror', handleFullscreenError);
    document.addEventListener('webkitfullscreenerror', handleFullscreenError);
    document.addEventListener('mozfullscreenerror', handleFullscreenError);
    document.addEventListener('MSFullscreenError', handleFullscreenError);
    document.addEventListener('copy', handleCopyCutPaste);
    document.addEventListener('cut', handleCopyCutPaste);
    document.addEventListener('paste', handleCopyCutPaste);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      console.log("[ProctorSystem] 🔓 Secure proctoring event listeners cleaned up!");
      clearTimeout(initialCheckTimeout);
      if (navigator.clipboard && originalWriteText) {
        navigator.clipboard.writeText = originalWriteText;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      document.removeEventListener('fullscreenerror', handleFullscreenError);
      document.removeEventListener('webkitfullscreenerror', handleFullscreenError);
      document.removeEventListener('mozfullscreenerror', handleFullscreenError);
      document.removeEventListener('MSFullscreenError', handleFullscreenError);
      document.removeEventListener('copy', handleCopyCutPaste);
      document.removeEventListener('cut', handleCopyCutPaste);
      document.removeEventListener('paste', handleCopyCutPaste);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isProctoringActive, loading, submitting, attemptId, isDisqualified]);

  // Dynamic Global Clipboard and Selection Lockout CSS & Polling Selection Cleaner
  useEffect(() => {
    if (!isProctoringActive || loading || submitting) return;

    // 1. Inject global selection lockout styles
    const styleEl = document.createElement('style');
    styleEl.id = 'exam-lockout-styles';
    styleEl.innerHTML = `
      * {
        user-select: none !important;
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        cursor: default !important;
      }
      
      /* Block dragging of any text/images/elements */
      img, a, p, h1, h2, h3, h4, h5, h6, span, div, li, button {
        -webkit-user-drag: none !important;
        user-drag: none !important;
        -webkit-touch-callout: none !important;
      }
    `;
    document.head.appendChild(styleEl);

    // 2. Active 100ms Selection Clearing Loop to defeat highlights/anti-proctor extensions
    const selectionCleaner = setInterval(() => {
      try {
        if (window.getSelection) {
          window.getSelection().removeAllRanges();
        } else if (document.selection) {
          document.selection.empty();
        }
      } catch (err) {
        // Silent catch
      }
    }, 100);

    return () => {
      const el = document.getElementById('exam-lockout-styles');
      if (el) el.remove();
      clearInterval(selectionCleaner);
    };
  }, [isProctoringActive, loading, submitting]);

  // ⚡ Bulletproof 300ms Fullscreen State Polling Check
  useEffect(() => {
    if (!isProctoringActive || loading || submitting || isDisqualified) return;

    // We allow a 1-second delay to allow the initial fullscreen transition animation
    let transitionComplete = false;
    const transitionTimer = setTimeout(() => {
      transitionComplete = true;
    }, 1000);

    const pollingInterval = setInterval(() => {
      if (!transitionComplete) return;

      const active = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );

      // If they exited fullscreen and the breach overlay is not already shown
      if (!active && !fullscreenBreached) {
        console.log("[ProctorSystem] Polling detected fullscreen exit! Triggering breach overlay.");
        setFullscreenBreached(true);
        recordViolation();
      }
    }, 300);

    return () => {
      clearTimeout(transitionTimer);
      clearInterval(pollingInterval);
    };
  }, [isProctoringActive, loading, submitting, isDisqualified, fullscreenBreached, attemptId]);

  const handleSelectOption = (questionId, option) => {
    const question = questions.find(q => q.id === questionId);
    const isMultiple = question && question.questionType === 'MULTIPLE';

    setAnswers(prev => {
      const prevVal = prev[questionId] || '';
      let newVal = '';
      if (isMultiple) {
        const currentSelections = prevVal ? prevVal.split(',') : [];
        if (currentSelections.includes(option)) {
          newVal = currentSelections.filter(o => o !== option).sort().join(',');
        } else {
          newVal = [...currentSelections, option].sort().join(',');
        }
      } else {
        newVal = option;
      }
      return {
        ...prev,
        [questionId]: newVal
      };
    });
  };

  const handleAutoSubmit = async () => {
    if (submitting) return;
    stopMediaStreams();
    setSubmitting(true);
    alert('⏱️ TIME OUT: Your duration has expired. Submitting your quiz now.');

    try {
      const formattedAnswers = Object.entries(answers).map(([qid, val]) => ({
        questionId: parseInt(qid),
        selectedOption: val
      }));
      await axios.post(`${API_URL}/attempts/submit`, {
        attemptId: parseInt(attemptId),
        answers: formattedAnswers
      });
      navigate('/');
    } catch (err) {
      console.error(err);
      navigate('/');
    }
  };

  const handleManualSubmit = async () => {
    const confirmSubmit = window.confirm('Are you sure you want to finish and submit your quiz answers?');
    if (!confirmSubmit) return;

    stopMediaStreams();
    setSubmitting(true);
    try {
      const formattedAnswers = Object.entries(answers).map(([qid, val]) => ({
        questionId: parseInt(qid),
        selectedOption: val
      }));

      const res = await axios.post(`${API_URL}/attempts/submit`, {
        attemptId: parseInt(attemptId),
        answers: formattedAnswers
      });

      alert(`Quiz evaluated! Your score: ${res.data.score.toFixed(1)}`);
      navigate('/');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit exam');
      setSubmitting(false);
    }
  };

  // Format seconds to mm:ss
  const formatTime = (secs) => {
    if (secs === null) return '00:00';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!isCalibrated) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at center, #0f172a, #020617)',
        padding: '24px',
        color: 'white'
      }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: '860px', padding: '40px', display: 'flex', flexDirection: 'column', gap: '32px', border: '1px solid var(--glass-border)', boxShadow: '0 25px 50px rgba(0,0,0,0.5)', borderRadius: '16px' }}>
          
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '26px', fontWeight: '800', margin: 0 }}>
              <span className="shimmer-text">Secure Assessment Dual-Device Calibration</span>
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px', margin: 0 }}>
              AI Proctoring V3 active. Calibrate your primary and secondary proctor feeds.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px', alignItems: 'start' }}>
            
            {/* Left Side: Policy & Consent */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: 'var(--accent-primary)' }}>1. Primary Proctor Compliance</h3>
              <p style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text-secondary)', margin: 0 }}>
                You must grant access to your webcam and microphone. The secure AI environment will lock your browser into **Fullscreen Mode** immediately upon launch.
              </p>

              <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '12px', color: 'var(--accent-danger)' }}>
                <strong>⚠️ ANTI-CHEAT COMPLIANCE RULES:</strong>
                <ul style={{ margin: '8px 0 0 16px', padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <li>Exiting Fullscreen mode registers a cheating strike.</li>
                  <li>Tab switching or window defocus registers a cheating strike.</li>
                  <li>Max 4 strikes. The 5th strike automatically submits your sheet.</li>
                </ul>
              </div>
            </div>

            {/* Right Side: QR Pairing */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.01)', textAlign: 'center' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>2. Pair Secondary Desk Camera</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
                Scan this dynamic WebRTC QR code with your mobile phone to stream your side desk/hand environment.
              </p>

              {/* Glowing SVG QR Code */}
              <div style={{ position: 'relative', display: 'inline-block', margin: '8px auto' }}>
                <svg width="128" height="128" viewBox="0 0 29 29" style={{ display: 'block', background: 'white', padding: '8px', borderRadius: '8px', boxShadow: '0 0 20px rgba(99,102,241,0.3)' }}>
                  <path d="M0 0h7v7H0zm1 1v5h5V1zM2 2v3h3V2zm22-2h7v7h-7zm1 1v5h5V1zm1 1v3h3V2zM0 22h7v7H0zm1 1v5h5v-5zm1 1v3h3v-3zm18 0h3v3h-3zm-2-2h2v2h-2zm4 4h3v3h-3zm-10-8h2v2h-2zm4 0h2v2h-2zm-6 2h2v2h-2zm12 0h2v2h-2zm-8 4h2v2h-2zm4 0h2v2h-2z" fill="#0f172a" />
                  <rect x="9" y="0" width="2" height="2" fill="#0f172a" />
                  <rect x="9" y="3" width="3" height="1" fill="#0f172a" />
                  <rect x="14" y="1" width="1" height="3" fill="#0f172a" />
                  <rect x="18" y="2" width="2" height="2" fill="#0f172a" />
                  <rect x="9" y="6" width="2" height="2" fill="#0f172a" />
                  <rect x="15" y="5" width="3" height="2" fill="#0f172a" />
                  <rect x="2" y="9" width="3" height="3" fill="#0f172a" />
                  <rect x="6" y="11" width="4" height="2" fill="#0f172a" />
                  <rect x="11" y="9" width="2" height="4" fill="#0f172a" />
                  <rect x="15" y="9" width="5" height="2" fill="#0f172a" />
                  <rect x="22" y="9" width="3" height="3" fill="#0f172a" />
                </svg>
                {isMobileCamPaired && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'rgba(15,23,42,0.85)',
                    borderRadius: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    border: '2px solid var(--accent-success)',
                    boxShadow: '0 0 16px var(--accent-success)'
                  }}>
                    <CheckCircle2 size={32} style={{ color: 'var(--accent-success)' }} />
                    <span style={{ fontSize: '11px', fontWeight: '700', color: 'white' }}>SEC_CAM LINKED</span>
                  </div>
                )}
              </div>

              {/* Status indicator */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '12px' }}>
                <span style={{ 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%', 
                  background: isMobileCamPaired ? 'var(--accent-success)' : 'var(--accent-danger)', 
                  boxShadow: `0 0 8px ${isMobileCamPaired ? 'var(--accent-success)' : 'var(--accent-danger)'}`,
                  display: 'inline-block' 
                }} />
                <span style={{ fontWeight: '600', color: isMobileCamPaired ? 'var(--accent-success)' : 'var(--text-secondary)' }}>
                  {isMobileCamPaired ? 'SECONDARY MOBILE FEED: PAIRED' : 'SECONDARY MOBILE FEED: DISCONNECTED'}
                </span>
              </div>

              <button
                type="button"
                className="glass-btn"
                style={{ padding: '6px 12px', fontSize: '11px', alignSelf: 'center', borderColor: isMobileCamPaired ? 'rgba(239, 68, 68, 0.3)' : 'var(--accent-primary)' }}
                onClick={() => setIsMobileCamPaired(!isMobileCamPaired)}
              >
                {isMobileCamPaired ? 'Simulate Disconnect' : 'Simulate Scanning / Pairing'}
              </button>
            </div>

          </div>

          {/* Launch Button Footer */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
            <button
              className="glass-btn glass-btn-primary"
              disabled={!isMobileCamPaired}
              style={{
                padding: '14px 40px',
                fontSize: '15px',
                fontWeight: '800',
                background: isMobileCamPaired 
                  ? 'linear-gradient(135deg, var(--accent-primary), #4f46e5)' 
                  : 'rgba(255,255,255,0.03)',
                borderColor: isMobileCamPaired ? 'var(--accent-primary)' : 'rgba(255,255,255,0.06)',
                color: isMobileCamPaired ? 'white' : 'var(--text-muted)',
                boxShadow: isMobileCamPaired ? '0 8px 24px rgba(99, 102, 241, 0.25)' : 'none',
                cursor: isMobileCamPaired ? 'pointer' : 'not-allowed',
                transition: 'all 0.3s'
              }}
              onClick={async () => {
                try {
                  const docEl = document.documentElement;
                  if (docEl.requestFullscreen) {
                    await docEl.requestFullscreen();
                  } else if (docEl.webkitRequestFullscreen) {
                    await docEl.webkitRequestFullscreen();
                  } else if (docEl.mozRequestFullScreen) {
                    await docEl.mozRequestFullScreen();
                  } else if (docEl.msRequestFullscreen) {
                    await docEl.msRequestFullscreen();
                  }
                } catch (err) {
                  console.warn("Fullscreen permission denied or unsupported:", err);
                }
                setIsCalibrated(true);
              }}
            >
              {isMobileCamPaired ? '🔐 Enter Secure Fullscreen & Begin Assessment' : '🔒 Pair Phone as Desk Camera to Unlock Assessment'}
            </button>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              🛡️ Proctor AI V3.2 Active (Desktop Fullscreen Safeguards + Desk-Environment Sensor)
            </div>
          </div>

        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIdx];
  const isLastQuestion = currentIdx === questions.length - 1;

  return (
    <div style={{ minHeight: '100vh', padding: '24px', userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>
      
      {/* Dynamic Proctored Sub-Header */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          marginBottom: '24px',
          borderRadius: '12px',
          borderColor: cheatingStrikes > 0 ? 'rgba(239, 68, 68, 0.3)' : 'var(--glass-border)'
        }}
      >
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '700' }}>{quiz?.title}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
              Strict Evaluation Mode. Do not minimize this browser or switch tabs.
            </p>
            <button
              className="glass-btn"
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                borderColor: 'var(--accent-secondary)',
                color: 'var(--accent-secondary)',
                background: 'rgba(168, 85, 247, 0.04)',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
              onClick={() => setShowRulesModal(true)}
            >
              <span>📜 View Exam Rules</span>
            </button>
            <span
              style={{
                padding: '3px 8px',
                fontSize: '10px',
                fontWeight: '700',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: 'var(--accent-success)',
                borderRadius: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              🛡️ Proctor V2 Active
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          {/* Integrity Strikes Counter */}
          {cheatingStrikes > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: 'var(--accent-danger)',
                fontSize: '12px',
                fontWeight: '700'
              }}
            >
              <ShieldAlert size={16} />
              <span>{cheatingStrikes} / 5 Strikes</span>
            </div>
          )}

          {/* Countdown timer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              background: remainingSeconds < 60 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.15)',
              border: `1px solid ${remainingSeconds < 60 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`,
              color: remainingSeconds < 60 ? 'var(--accent-danger)' : 'var(--accent-primary)',
              fontFamily: 'monospace',
              fontSize: '18px',
              fontWeight: 'bold'
            }}
          >
            <Clock size={18} />
            <span>{formatTime(remainingSeconds)}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '24px' }}>
        
        {/* MCQ QUESTION WORKSPACE */}
        <div 
          className="glass-panel" 
          style={{ 
            padding: '32px', 
            userSelect: 'none', 
            WebkitUserSelect: 'none', 
            MozUserSelect: 'none', 
            msUserSelect: 'none',
            position: 'relative',
            filter: !isProctoringActive ? 'blur(12px)' : 'none',
            pointerEvents: !isProctoringActive ? 'none' : 'auto',
            transition: 'filter 0.3s ease-in-out'
          }}
        >
          {!isProctoringActive && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              gap: '12px',
              padding: '24px',
              background: 'rgba(15, 23, 42, 0.25)',
              borderRadius: 'inherit'
            }}>
              <div 
                className="shimmer-text" 
                style={{ 
                  fontSize: '18px', 
                  fontWeight: '800', 
                  color: 'white',
                  textShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span>🔒 Secure Workspace Locked</span>
              </div>
              <p style={{ 
                fontSize: '13px', 
                color: '#cbd5e1', 
                margin: 0, 
                maxWidth: '320px', 
                textAlign: 'center',
                lineHeight: '1.5',
                textShadow: '0 2px 4px rgba(0,0,0,0.5)'
              }}>
                Calibrating media sensors and establishing secure HTML5 Fullscreen space. Unlocking instantly upon completion...
              </p>
            </div>
          )}
          {questions.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No questions loaded for this quiz.</div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    color: 'var(--accent-primary)',
                    background: 'rgba(99, 102, 241, 0.12)',
                    padding: '4px 10px',
                    borderRadius: '6px'
                  }}
                >
                  Question {currentIdx + 1} of {questions.length}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Marks: <strong>{currentQuestion.marks}</strong>
                </span>
              </div>

              {/* Question Text */}
              <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '28px', lineHeight: '1.4' }}>
                {currentQuestion.questionText}
              </h3>

              {currentQuestion.questionImage && (
                <div style={{ 
                  margin: '16px 0 28px 0', 
                  width: '100%', 
                  maxWidth: '520px', 
                  borderRadius: '10px', 
                  overflow: 'hidden', 
                  border: '1px solid var(--glass-border)', 
                  boxShadow: '0 8px 32px 0 rgba(0,0,0,0.2)' 
                }}>
                  <img 
                    src={currentQuestion.questionImage} 
                    alt="Assessment Diagram" 
                    style={{ 
                      width: '100%', 
                      objectFit: 'contain', 
                      maxHeight: '320px',
                      display: 'block'
                    }} 
                  />
                </div>
              )}

              {/* Options mapping */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '32px' }}>
                {['A', 'B', 'C', 'D'].map((opt) => {
                  const optText = currentQuestion[`option${opt}`];
                  const isSelected = currentQuestion.questionType === 'MULTIPLE'
                    ? (answers[currentQuestion.id] || '').split(',').includes(opt)
                    : answers[currentQuestion.id] === opt;
                  return (
                    <button
                      key={opt}
                      style={{
                        textAlign: 'left',
                        padding: '16px 20px',
                        borderRadius: '10px',
                        background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                        border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--glass-border)'}`,
                        color: isSelected ? 'white' : 'var(--text-primary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        transition: 'all 0.2s',
                        outline: 'none'
                      }}
                      onClick={() => handleSelectOption(currentQuestion.id, opt)}
                    >
                      <span
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: currentQuestion.questionType === 'MULTIPLE' ? '6px' : '50%',
                          background: isSelected ? 'var(--accent-primary)' : 'rgba(255,255,255,0.06)',
                          color: isSelected ? 'white' : 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '700',
                          fontSize: '13px'
                        }}
                      >
                        {opt}
                      </span>
                      <span style={{ fontSize: '15px' }}>{optText}</span>
                    </button>
                  );
                })}
              </div>

              {/* Pagination controls */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: '20px',
                  borderTop: '1px solid rgba(255,255,255,0.06)'
                }}
              >
                <button
                  className="glass-btn glass-btn-secondary"
                  disabled={currentIdx === 0}
                  onClick={() => setCurrentIdx(prev => prev - 1)}
                >
                  <ChevronLeft size={16} />
                  <span>Previous</span>
                </button>

                <button
                  className="glass-btn glass-btn-secondary"
                  disabled={isLastQuestion}
                  onClick={() => setCurrentIdx(prev => prev + 1)}
                >
                  <span>Next</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
        {/* SIDEBAR NAVIGATION COLUMN */}
        <div 
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '24px', 
            alignSelf: 'start', 
            width: '100%',
            filter: !isProctoringActive ? 'blur(8px)' : 'none',
            pointerEvents: !isProctoringActive ? 'none' : 'auto',
            transition: 'filter 0.3s ease-in-out'
          }}
        >
          
          {/* Question Sheet Panel */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)' }}>QUESTION SHEET</h4>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '10px'
              }}
            >
              {questions.map((q, idx) => {
                const isAnswered = !!answers[q.id];
                const isActive = idx === currentIdx;
                
                let bgColor = 'rgba(255, 255, 255, 0.02)';
                let borderColor = 'var(--glass-border)';
                let textColor = 'var(--text-secondary)';

                if (isAnswered) {
                  bgColor = 'rgba(16, 185, 129, 0.15)';
                  borderColor = 'rgba(16, 185, 129, 0.3)';
                  textColor = 'var(--accent-success)';
                }

                if (isActive) {
                  borderColor = 'var(--accent-primary)';
                  bgColor = isAnswered ? 'rgba(16, 185, 129, 0.25)' : 'rgba(99, 102, 241, 0.15)';
                  textColor = isAnswered ? 'white' : 'var(--accent-primary)';
                }

                return (
                  <button
                    key={q.id}
                    style={{
                      aspectRatio: '1',
                      borderRadius: '8px',
                      background: bgColor,
                      border: `1px solid ${borderColor}`,
                      color: textColor,
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      outline: 'none',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => setCurrentIdx(idx)}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                lineHeight: '1.4',
                paddingTop: '16px',
                borderTop: '1px solid rgba(255,255,255,0.06)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)' }} />
                <span>Answered</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)' }} />
                <span>Unanswered</span>
              </div>
            </div>

            {/* Submission Button */}
            <button 
              className="glass-btn glass-btn-primary" 
              style={{ 
                marginTop: '12px',
                background: 'linear-gradient(135deg, var(--accent-success), #059669)',
                padding: '16px',
                width: '100%'
              }} 
              onClick={handleManualSubmit}
            >
              <CheckCircle2 size={18} />
              <span style={{ fontSize: '15px' }}>Submit Exam</span>
            </button>
          </div>

          {/* 📹 SECURITY & PROCTORING CONSOLE */}
          <div 
            className="glass-panel" 
            style={{ 
              padding: '24px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '16px', 
              border: audioWarning ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--glass-border)', 
              transition: 'border-color 0.3s' 
            }}
          >
            <h4 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-success)', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
              <span>LIVE SECURITY PROCTOR</span>
            </h4>

            {/* Video Viewport */}
            <div style={{ width: '100%', aspectRatio: '4/3', borderRadius: '8px', overflow: 'hidden', background: '#070a13', border: '1px solid rgba(255,255,255,0.06)', position: 'relative' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
              />

              <span style={{ position: 'absolute', bottom: '8px', left: '8px', fontSize: '9px', fontWeight: '800', background: 'rgba(0,0,0,0.6)', padding: '3px 6px', borderRadius: '4px', letterSpacing: '0.5px' }}>
                📷 PRIMARY WEBCAM FEED
              </span>
            </div>

            {/* Secondary Desk Camera Stream Viewport */}
            {isMobileCamPaired && (
              <div style={{ width: '100%', aspectRatio: '4/3', borderRadius: '8px', overflow: 'hidden', background: '#05070c', border: '1px solid rgba(255,255,255,0.06)', position: 'relative' }}>
                {/* Simulated hands-on-desk grid canvas feed */}
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'radial-gradient(circle at center, #090e1a, #010408)',
                  position: 'relative'
                }}>
                  {/* Live geometric wireframe hands/desk feed using SVG */}
                  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ opacity: 0.25, transform: 'scale(1.2)' }}>
                    <path d="M12 40 L20 28 L32 36 L44 24 L52 40" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="32" cy="18" r="4" stroke="var(--accent-primary)" strokeWidth="2" />
                    <rect x="8" y="44" width="48" height="12" rx="2" stroke="var(--accent-primary)" strokeWidth="2" />
                  </svg>

                  {/* Scanning grid HUD */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    border: '1px solid rgba(99, 102, 241, 0.08)',
                    background: 'linear-gradient(rgba(99, 102, 241, 0.02) 50%, rgba(0, 0, 0, 0) 50%), linear-gradient(90deg, rgba(99, 102, 241, 0.02) 50%, rgba(0, 0, 0, 0) 50%)',
                    backgroundSize: '12px 12px'
                  }} />

                  <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--accent-primary)', textShadow: '0 0 8px rgba(99,102,241,0.5)', animation: 'pulse 2s infinite' }}>
                    🟢 SEC_CAM: ACTIVE (DESK)
                  </span>
                  
                  <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold' }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent-success)', animation: 'pulse 1.2s infinite' }} />
                    <span>LIVE WebRTC</span>
                  </div>
                </div>

                <span style={{ position: 'absolute', bottom: '8px', left: '8px', fontSize: '9px', fontWeight: '800', background: 'rgba(0,0,0,0.6)', padding: '3px 6px', borderRadius: '4px', letterSpacing: '0.5px' }}>
                  📱 MOBILE FEED (DESK VIEW)
                </span>
              </div>
            )}

            {/* Microphone volume tracker */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '600' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Microphone Decibels</span>
                <span style={{ color: audioWarning ? 'var(--accent-danger)' : 'var(--accent-success)' }}>
                  {audioWarning ? '⚠️ NOISE SPIKE' : 'Active'}
                </span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, (volume / 120) * 100)}%`,
                  background: audioWarning ? 'linear-gradient(90deg, var(--accent-success), var(--accent-danger))' : 'var(--accent-success)',
                  transition: 'width 0.1s ease',
                  boxShadow: audioWarning ? '0 0 10px rgba(239, 68, 68, 0.5)' : 'none'
                }} />
              </div>
            </div>

            {/* Warning indicator */}
            {audioWarning && (
              <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', fontSize: '11px', color: 'var(--accent-danger)', fontWeight: '700', display: 'flex', gap: '6px', alignItems: 'center' }}>
                <AlertTriangle size={12} />
                <span>High ambient noise detected.</span>
              </div>
            )}


            <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Proctored Session: Primary webcam stream, environment desk camera, and room sound levels are evaluated dynamically.
            </div>
          </div>        </div>

      </div>

      {/* 📜 INTERACTIVE EXAM RULES & RESTRICTIONS MODAL */}
      {showRulesModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(10px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '520px',
              padding: '32px',
              position: 'relative',
              boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid var(--glass-border)',
              borderRadius: '16px'
            }}
          >
            {/* Close Button */}
            <button
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                outline: 'none'
              }}
              onClick={() => setShowRulesModal(false)}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-secondary)' }}>
              <span>📜 Exam Rules & Restrictions</span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
              <p>
                Please read the following academic integrity and technical guidelines carefully. Failure to comply will lead to automated disqualification.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--accent-danger)', fontWeight: '700' }}>1.</span>
                  <span><strong>Tab-Switching Proctoring:</strong> Switching browser tabs, minimizing the window, or opening other applications will trigger an <strong>Integrity Strike</strong>.</span>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--accent-danger)', fontWeight: '700' }}>2.</span>
                  <span><strong>Five-Strike Disqualification:</strong> If you accumulate <strong>5 strikes</strong>, the quiz session is instantly terminated, automatically graded, and locked.</span>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--accent-primary)', fontWeight: '700' }}>3.</span>
                  <span><strong>Video Monitoring:</strong> Keep your face aligned with the webcam feed in the proctor sidebar. Maintain steady room lighting.</span>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--accent-success)', fontWeight: '700' }}>4.</span>
                  <span><strong>Sound Monitoring:</strong> Your microphone decibels are tracked dynamically to detect ambient discussions. Ensure a quiet background.</span>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--accent-warning)', fontWeight: '700' }}>5.</span>
                  <span><strong>Negative Marking:</strong> Correct submissions award full marks, while incorrect answers deduct <strong>-{quiz?.negativeMarks || 0} marks</strong>. Skips award 0.</span>
                </div>
              </div>

              <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', fontSize: '12px', color: 'var(--accent-primary)', textAlign: 'center', fontWeight: '600' }}>
                🛡️ AI proctoring engines are active in this browser.
              </div>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="glass-btn glass-btn-primary"
                style={{ background: 'linear-gradient(135deg, var(--accent-secondary), #7c3aed)', padding: '8px 20px' }}
                onClick={() => setShowRulesModal(false)}
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ Bottom Proctor Warning Toast */}
      {proctorWarning && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: '680px',
          background: 'rgba(220, 38, 38, 0.95)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '12px',
          padding: '16px 20px',
          boxShadow: '0 10px 40px rgba(220, 38, 38, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          zIndex: 9999,
          color: 'white'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle size={24} style={{ color: '#FEE2E2', flexShrink: 0 }} />
            <div style={{ textAlign: 'left' }}>
              <p style={{ margin: 0, fontWeight: '700', fontSize: '13.5px' }}>
                {proctorWarning}
              </p>
              <span style={{ fontSize: '11px', color: '#FCA5A5' }}>
                Proctor Warning Logged. Strikes are persistent in the exam database.
              </span>
            </div>
          </div>
          <button
            onClick={() => setProctorWarning(null)}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              outline: 'none',
              transition: 'background 0.2s'
            }}
          >
            Acknowledge
          </button>
        </div>
      )}

      {/* ⚠️ Fullscreen Breach Recovery Overlay */}
      {fullscreenBreached && !isDisqualified && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.96)',
          backdropFilter: 'blur(20px)',
          zIndex: 10001,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          color: 'white'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '500px',
            padding: '40px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            border: '2px solid rgba(239, 68, 68, 0.4)',
            boxShadow: '0 25px 50px rgba(239, 68, 68, 0.25)',
            borderRadius: '16px'
          }}>
            <h2 style={{ fontSize: '24px', fontWeight: '800', margin: 0, color: 'var(--accent-danger)' }}>
              ⚠️ Fullscreen Requirement Disrupted
            </h2>
            
            <p style={{ fontSize: '14.5px', lineHeight: '1.6', color: 'var(--text-secondary)', margin: 0 }}>
              Fullscreen mode was exited! To maintain examination integrity, you must re-enter fullscreen immediately.
            </p>

            <div style={{
              padding: '16px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              fontSize: '18px',
              fontWeight: '800',
              color: 'var(--accent-danger)'
            }}>
              🚨 Disqualification in: {fullscreenTimer}s
            </div>

            <button
              className="glass-btn glass-btn-primary"
              style={{
                padding: '12px 24px',
                fontSize: '15px',
                fontWeight: '700',
                background: 'linear-gradient(135deg, var(--accent-danger), #b91c1c)',
                boxShadow: '0 8px 24px rgba(239, 68, 68, 0.25)',
                cursor: 'pointer'
              }}
              onClick={handleReenterFullscreen}
            >
              📺 Re-enter Secure Fullscreen
            </button>
          </div>
        </div>
      )}

      {/* 🚫 Disqualified Terminated Overlay */}
      {isDisqualified && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(2, 6, 23, 0.98)',
          backdropFilter: 'blur(30px)',
          zIndex: 10002,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          color: 'white'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '520px',
            padding: '48px 40px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            border: '2px solid rgba(239, 68, 68, 0.6)',
            boxShadow: '0 25px 60px rgba(239, 68, 68, 0.3)',
            borderRadius: '20px'
          }}>
            <span style={{ fontSize: '48px' }}>🚫</span>
            <h2 style={{ fontSize: '26px', fontWeight: '800', margin: 0, color: 'var(--accent-danger)' }}>
              Assessment Terminated
            </h2>
            
            <p style={{ fontSize: '15px', lineHeight: '1.6', color: 'var(--text-secondary)', margin: 0 }}>
              You have been disqualified for committing **5 proctoring strikes** (including tab-switching, exiting fullscreen, or losing window focus).
            </p>

            <div style={{
              padding: '16px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              fontSize: '12.5px',
              color: 'var(--text-muted)',
              lineHeight: '1.4'
            }}>
              Your answers have been locked and submitted to the evaluation center. You will be redirected shortly.
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '700', marginTop: '12px' }}>
              Redirecting to dashboard...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
