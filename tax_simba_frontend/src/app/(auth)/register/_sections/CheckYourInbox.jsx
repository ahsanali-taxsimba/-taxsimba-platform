"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { useReVerifyEmail } from "@/hooks/reVerifyEmail";
import { useState, useEffect } from "react";
import { IoMdMail, IoMdRefresh } from "react-icons/io";
import { FaCheckCircle } from "react-icons/fa";
import TranslatedText from "@/components/TranslatedText";

export default function CheckYourInbox({ email, onBack }) {
  const router = useRouter();
  const [isActiveButton, setIsActiveButton] = useState(false);
  const [timer, setTimer] = useState(30);

  useEffect(() => {
    let interval;

    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else {
      setIsActiveButton(true);
    }

    return () => clearInterval(interval);
  }, [timer]);

  const reVerifyHandler = async () => {
    if (!email) {
      toast.error("Email is required to re-verify.");
      return;
    }

    setTimer(30); // Restart countdown after resending
    setIsActiveButton(false);
    const { type, message } = await useReVerifyEmail(email);
    if (type) {
      toast.success(message);
    } else {
      toast.error(message);
    }
  };

  return (
    <>
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spin-icon {
          animation: spin 1.5s linear infinite;
        }
      `}</style>
      <div 
        className="registration_login_full min-vh-100 d-flex align-items-center justify-content-center p-3" 
        style={{ 
          backgroundImage: 'url("/images/login_ban.png")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: '#F3F4F6'
        }}
      >
        <div 
          className="bg-white p-4 p-md-5 rounded-4 shadow-lg text-center" 
          style={{ 
            maxWidth: '460px', 
            width: '100%', 
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
          }}
        >
          {/* Header Icon */}
          <div className="d-flex justify-content-center mb-4">
            <div className="position-relative d-flex align-items-center justify-content-center rounded-circle" style={{ width: '80px', height: '80px', backgroundColor: '#EBF7F2' }}>
              <IoMdMail style={{ fontSize: '36px', color: '#2D9C75' }} />
              <div className="position-absolute rounded-circle bg-white d-flex align-items-center justify-content-center shadow-sm" style={{ bottom: '2px', right: '2px', width: '22px', height: '22px' }}>
                <FaCheckCircle style={{ fontSize: '16px', color: '#2D9C75' }} />
              </div>
            </div>
          </div>

          {/* Heading */}
          <h3 className="fw-bold mb-3" style={{ color: '#111827', fontSize: '1.75rem' }}>
            <TranslatedText>Verify your email</TranslatedText>
          </h3>

          {/* Subtitle */}
          <p className="text-muted mb-4" style={{ fontSize: '0.925rem', lineHeight: '1.6' }}>
            <TranslatedText>We've sent a verification link to</TranslatedText> <br />
            <span className="fw-bold" style={{ color: '#2D9C75', wordBreak: 'break-all' }}>{email}</span> <br />
            <TranslatedText>Please click the link in the email to activate your account.</TranslatedText>
          </p>

          {/* Guidelines Box */}
          <div className="p-3 mb-4 rounded-3 text-start" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <div className="fw-bold mb-2" style={{ fontSize: '0.85rem', color: '#475569' }}>
              <TranslatedText>Didn't receive the email?</TranslatedText>
            </div>
            <div className="d-flex align-items-start gap-2 mb-2" style={{ fontSize: '0.825rem', color: '#64748B' }}>
              <FaCheckCircle style={{ color: '#2D9C75', marginTop: '3px', flexShrink: 0, fontSize: '12px' }} />
              <span><TranslatedText>Check your spam or junk folder</TranslatedText></span>
            </div>
            <div className="d-flex align-items-start gap-2" style={{ fontSize: '0.825rem', color: '#64748B' }}>
              <FaCheckCircle style={{ color: '#2D9C75', marginTop: '3px', flexShrink: 0, fontSize: '12px' }} />
              <span><TranslatedText>Make sure the email address is correct</TranslatedText></span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="d-flex flex-column gap-2 mb-4">
            <button 
              type="button" 
              onClick={reVerifyHandler} 
              disabled={!isActiveButton} 
              className="w-100 btn d-flex align-items-center justify-content-center gap-2"
              style={{ 
                backgroundColor: isActiveButton ? '#2D9C75' : '#8ED6BC', 
                color: '#ffffff', 
                border: 'none', 
                borderRadius: '8px', 
                padding: '12px 24px', 
                fontWeight: '600',
                transition: 'all 0.2s',
                cursor: isActiveButton ? 'pointer' : 'not-allowed'
              }}
            >
              <IoMdRefresh className={!isActiveButton ? "spin-icon" : ""} style={{ fontSize: '18px' }} />
              {isActiveButton ? <TranslatedText>Resend verification email</TranslatedText> : <span><TranslatedText>Resend in</TranslatedText> {timer}s</span>}
            </button>

            <button 
              type="button" 
              onClick={onBack ? onBack : () => router.back()} 
              className="w-100 btn d-flex align-items-center justify-content-center gap-2"
              style={{ 
                backgroundColor: '#ffffff', 
                color: '#2D9C75', 
                border: '1px solid #2D9C75', 
                borderRadius: '8px', 
                padding: '12px 24px', 
                fontWeight: '600',
                transition: 'all 0.2s',
                cursor: 'pointer'
              }}
            >
              <TranslatedText>Change email address</TranslatedText>
            </button>
          </div>

          {/* Already Verified Link */}
          <div className="text-center" style={{ fontSize: '0.875rem' }}>
            <span className="text-muted"><TranslatedText>Already verified?</TranslatedText> </span>
            <Link href="/login" className="fw-semibold text-decoration-none" style={{ color: '#2D9C75' }}>
              <TranslatedText>Continue to Sign In</TranslatedText>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}