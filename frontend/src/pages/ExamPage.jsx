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

        // Fetch student-facing questions (EXCLUDES correctOption)
        const qRes = await axios.get(`${API_URL}/quizzes/${attempt.quizId}/exam-questions`);
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
          setCheatingStrikes(3);
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

    if (cheatingStrikes >= 3) {
      stopMediaStreams();
      setIsDisqualified(true);
      handleBrutalSubmit();
    } else {
      setProctorWarning(`⚠️ INTEGRITY WARNING: Focus loss, fullscreen exit, or tab switch detected! Strike ${cheatingStrikes}/3 registered. (Auto-submits on Strike 3)`);
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

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--text-secondary)' }}>
        Loading secure exam session...
      </div>
    );
  }

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
        <div className="glass-panel" style={{ maxWidth: '500px', padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '24px', border: '1px solid var(--glass-border)', boxShadow: '0 25px 50px rgba(0,0,0,0.5)', borderRadius: '16px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '800', margin: 0 }}>
            <span className="shimmer-text">Secure Assessment Portal</span>
          </h2>
          
          <p style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--text-secondary)', margin: 0 }}>
            Before launching the assessment, the AI proctor must lock the screen into **Fullscreen Mode** and calibrate your camera/microphone.
          </p>

          <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', textAlign: 'left', fontSize: '12px', color: 'var(--accent-danger)' }}>
            <strong>⚠️ ANTI-CHEAT COMPLIANCE REQUIRED:</strong>
            <ul style={{ margin: '8px 0 0 16px', padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li>Leaving Fullscreen mode counts as an Integrity Strike.</li>
              <li>Switching tabs or clicking outside this window counts as an Integrity Strike.</li>
              <li>A maximum of 2 strikes is allowed; the 3rd strike triggers automatic submission.</li>
            </ul>
          </div>

          <button
            className="glass-btn glass-btn-primary"
            style={{
              padding: '12px 24px',
              fontSize: '15px',
              fontWeight: '700',
              background: 'linear-gradient(135deg, var(--accent-primary), #4f46e5)',
              boxShadow: '0 8px 24px rgba(99, 102, 241, 0.25)',
              cursor: 'pointer'
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
            Launch Assessment & Fullscreen
          </button>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '-8px' }}>
            🛡️ Proctor V2 Active (Strict Fullscreen Exit Hook)
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
              <span>{cheatingStrikes} / 3 Strikes</span>
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

                {isLastQuestion ? (
                  <button className="glass-btn glass-btn-primary" style={{ background: 'linear-gradient(135deg, var(--accent-success), #059669)' }} onClick={handleManualSubmit}>
                    <CheckCircle2 size={16} />
                    <span>Submit Quiz</span>
                  </button>
                ) : (
                  <button className="glass-btn glass-btn-secondary" onClick={() => setCurrentIdx(prev => prev + 1)}>
                    <span>Next</span>
                    <ChevronRight size={16} />
                  </button>
                )}
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
              
              {/* Green HUD Grid Overlay */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                border: '1px solid rgba(16, 185, 129, 0.12)',
                background: 'linear-gradient(rgba(16, 185, 129, 0.03) 50%, rgba(0, 0, 0, 0) 50%), linear-gradient(90deg, rgba(16, 185, 129, 0.03) 50%, rgba(0, 0, 0, 0) 50%)',
                backgroundSize: '8px 8px'
              }} />
              
              {/* Glow scan line */}
              <div style={{
                position: 'absolute',
                left: 0,
                width: '100%',
                height: '2px',
                background: 'rgba(16, 185, 129, 0.6)',
                boxShadow: '0 0 8px rgba(16, 185, 129, 0.8)',
                animation: 'scan 4s linear infinite',
                top: '0%'
              }} />

              <span style={{ position: 'absolute', bottom: '8px', left: '8px', fontSize: '9px', fontWeight: '800', background: 'rgba(0,0,0,0.6)', padding: '3px 6px', borderRadius: '4px', letterSpacing: '0.5px' }}>
                📷 WEBCAM FEED
              </span>
            </div>

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
              Proctored Session: Face alignment and room sound levels are evaluated dynamically.
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
                  <span><strong>Three-Strike Disqualification:</strong> If you accumulate <strong>3 strikes</strong>, the quiz session is instantly terminated, automatically graded, and locked.</span>
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
              You have been disqualified for committing **3 proctoring strikes** (including tab-switching, exiting fullscreen, or losing window focus).
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
