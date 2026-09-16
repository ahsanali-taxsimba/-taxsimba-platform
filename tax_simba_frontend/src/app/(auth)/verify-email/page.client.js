"use client";
export const dynamic = "force-dynamic";
import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import axios from "axios";
import CheckInbox from "../../../components/default/CheckInbox";
import RegistrationLoginLayout from "../_authLayout/RegistrationLoginLayout";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useReVerifyEmail } from "@/hooks/reVerifyEmail";

let isHitApi = false;

const VerifyEmail = () => {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [formEmail, setFormEmail] = useState("");
  const [canSendAgain, setCanSendAgain] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.getAll("token");

  useEffect(() => {
    if (!token) return;
    async function verifyEmail() {
      if (isHitApi) return;
      isHitApi = true;
      try {
        const response = await axios.post(
          process.env.NEXT_PUBLIC_API_URL + `auth/verify-email?token=${token}`
        );

        if (response?.status == 200 || response?.status == 201) {
          setMessage("Your email verification is successfully completed");

          // setTimeout(()=>{
          //     router.push('/login')
          // },3000)
        } else {
          const fallbackMessage =
            response?.data?.message || "Token verification failed.";
          setMessage(fallbackMessage);
          // setMessage(data.message || "token is not verified")
        }
      } catch (error) {
        const errMessage =
          error?.response?.data?.message ||
          "An error occurred during verification.";
        setMessage(errMessage);
      } finally {
        setLoading(false);
      }
    }
    verifyEmail();
  }, []);

  const handleLogin = () => {
    router.push("/login");
  };

  const handleSendAgain = async () => {
    if (formEmail === "") {
      toast.error("Please enter your email");
      return;
    }
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail) === false) {
      toast.error("Please enter a valid email address");
      return;
    }

    // 
    const { type, message } = await useReVerifyEmail(formEmail);
    if (type) {
      toast.success(message);
      setCanSendAgain(false);
      setFormEmail("");
    } else {
      toast.error(message);
    }
  }

  return (
    <div>
      <RegistrationLoginLayout>
        <CheckInbox
          h3Text={
            loading ? "Loading....." : message
          }
          inputBox={
            canSendAgain &&
            (
              <>
                <label className="form-label">Email</label>
                <input
                  name="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  type="email"
                  placeholder="Enter your email"
                  className="form-control"
                  required
                />
              </>
            )
          }
          button={
            loading ? (
              ""
            ) : message !== 'Invalid or expired verification token.' ?
              <button
                className="common-btn w-100 justify-content-center text-center"
                id="ifsure"
                onClick={handleLogin}
              >
                {'Go To Login'}
              </button>
              :
              <button
                className="basic_btn yellow_btn "
                id="ifsure"
                onClick={() => { canSendAgain ? handleSendAgain() : setCanSendAgain(true) }}
              >
                {'send again'}
              </button>

          }
        />
      </RegistrationLoginLayout>
    </div>
  );
};

export default VerifyEmail;
