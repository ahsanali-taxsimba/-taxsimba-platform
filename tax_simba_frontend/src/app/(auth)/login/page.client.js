// global_login_holdr login
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import Image from "next/image";
import axios from 'axios';
import { signIn, getSession } from "next-auth/react";
import Link from "next/link";
import RegistrationLoginLayout from "../_authLayout/RegistrationLoginLayout";
import TextInputField from "../../..//components/default/TextInputField";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
// import { getSystemErrorMessage } from "util";
import { IoIosMail, IoMdMail } from "react-icons/io";
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import H2component from "../../utils/typography/H2component";
import Pcomponent from "../../utils/typography/Pcomponent";
import H3component from "../../utils/typography/H3component";
import UsePasswordSection from "./_sections/UsePasswordSection";
import UseCodeSection from "./_sections/UseCodeSection";
import { FcGoogle } from "react-icons/fc";
import toast from "react-hot-toast";
import { TranslatedHeading, TranslatedHeadingTwo, TranslatedHeadingThree, TranslatedHeadingFour, TranslatedHeadingFive, TranslatedParagraph, TranslatedButton, TranslatedSpan, TranslatedNextLink, TranslatedInput } from "@/components/TranslatedContent";
import TranslatedText from "@/components/TranslatedText";
import { FaGoogle } from "react-icons/fa";
import { AiFillGoogleCircle } from "react-icons/ai";
export default function LoginClientPage() {
  const [isUsePassword, setIsUsePassword] = useState(true); // P0: password path only (D1)
  const [isSendCode, setIsSendCode] = useState(false);
  const [isView, setIsView] = useState(false);
  const [loading, setLoading] = useState(false);
  const [componentLoading, setComponentLoading] = useState(false);
  const [code, setCode] = useState(0);
  const [codeDigits, setCodeDigits] = useState(["", "", "", ""]);
  const inputRefs = useRef([]);


  const [loginFormValidation, setLoginFormValidation] = useState({
    email: "",
    password: "",
  });
  const [loginFormError, setLoginformError] = useState({
    email: "",
    password: "",
  });
  const [unverifiedEmail, setUnverifiedEmail] = useState(null);
  const [resending, setResending] = useState(false);

  const [validError, setValidError] = useState({
    reqPass: false,
    upper: false,
    lower: false,
    sp: false,
    digit: false,
    max: false
  });

  const spanErrors = {
    errMsg: [
      // { id: 'reqPass', msg: 'Password is required' },
      // { id: 'upper', msg: 'Must contain uppercase letter' },
      // { id: 'lower', msg: 'Must contain lowercase letter' },
      // { id: 'sp', msg: 'Must contain a special character' },
      // { id: 'digit', msg: 'Must contain a number' },
      // { id: 'max', msg: 'Must be at least 8 characters' }
    ]
  };
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirectAfterLogin = async () => {
    try {
      // Small delay to ensure cookies are set and accessible by next-auth getSession
      await new Promise(resolve => setTimeout(resolve, 500));
      const session = await getSession();

      const planId = searchParams.get('plan');

      if (planId) {
        router.push(`/planlist/${planId}`);
      } else if (session?.user && !session.user.hasActiveService) {
        router.push('/planlist');
      } else if (session?.user && !session.user.isEngagementLetterAccepted) {
        router.push('/engagement-letter');
      } else if (session?.user && session.user.ownership === 'mtd') {
        router.push('/mtd-dashboard');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('Session check failed:', err);
      router.push('/dashboard');
    }
  };

  const handleCodeDigitChange = (e, index) => {
    const val = e.target.value;

    if (!/^\d?$/.test(val)) return;

    const updated = [...codeDigits];
    updated[index] = val;
    setCodeDigits(updated);
    setCode(updated.join(""));

    // Move to next input
    if (val && index < codeDigits.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace" && !codeDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };
  const handleChange = (e) => {
    const { name, value } = e.target;
    setLoginFormValidation((prev) => ({ ...prev, [name]: value }));
    validateForm(name, value);
    if (name === "email") {
      setUnverifiedEmail(null);
    }
  };

  const validateForm = (name, value) => {
    let errors = "";
    loginFormError.password = errors
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // let inputStyleClass = {
    //   email_field: document.querySelector(".email_field"),
    //   password_field: document.querySelector(".password_field"),
    // };
    const inputClassMap = {
      email: 'email_field',
      password: 'password_field',
    };
    const inputEl = document.querySelector(`.${inputClassMap[name]}`);
    //email validation
    if (name === "email") {
      if (!value) {
        errors = "Email is required"
      } else if (!emailRegex.test(value)) {
        errors = "Invalid email"
      } else {
        errors = ""
      }
      inputEl?.classList.toggle('input_err', !!errors);

    } else if (name === "password") {
      const rules = {
        reqPass: value.trim() !== '',
              };

      setValidError({
        reqPass: rules.reqPass,
            });

      if (!rules.reqPass) {
        errors = 'Password is required';
      }
      inputEl?.classList.toggle('input_err', !!errors);
    }
    setLoginformError((prev) => ({ ...prev, [name]: errors }));
  };

  const loginFormHandler = async (e) => {
    e.preventDefault();

    const newErrors = { ...loginFormError };
    Object.keys(loginFormValidation).forEach((field) => {
      validateForm(field, loginFormValidation[field]);
    });
    const isValid = Object.values(newErrors).every((error) => !error);
    if (isValid && Object.values(loginFormValidation).every(val => val)) {
      // router.push("/login");

      const result = await signIn("credentials", {
        redirect: false,
        email: loginFormValidation.email,
        password: loginFormValidation.password,
        code: null
      });


      if (result?.ok) {
        toast.success("Login successful");
        setLoading(true);
        await redirectAfterLogin();

      } else if (result?.error) {
        if (result.error.toLowerCase().includes("email not verified")) {
          setUnverifiedEmail(loginFormValidation.email);
        } else {
          setUnverifiedEmail(null);
        }
        toast.error(result?.error || "Invalid email or password");
      }


    } else {
      setLoginformError(newErrors)
    }
  };

  const loginFormHandler2 = async (e) => {
    e.preventDefault();

    if (code.toString().length !== 4) {
      toast.error("Please enter a valid code");
      return;
    }

    const result = await signIn("credentials", {
      redirect: false,
      email: loginFormValidation.email,
      password: null,
      code: code
    })

    if (result?.ok) {
      // setError("Invalid email or password");
      toast.success("Login Successful");
      setLoading(true);
      await redirectAfterLogin();

    } else if (result?.error) {
      toast.error("Invalid email or code");
    }
  }

  const handleView = () => {
    setIsView(!isView);
  };

  const handleSendCode = async () => {
    if (loginFormError.email || loginFormValidation.email === "") {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!loginFormError.email && loginFormValidation.email) {
      setComponentLoading(true);
      try {
        const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}auth/login-with-code`, {
          email: loginFormValidation.email,
          action: "request"
        })

        toast.success(res?.data?.message || "Code sent successfully");
        setIsSendCode(true)

      } catch (err) {
        toast.error(err?.response?.data?.message || "Failed to send code");
      }
      finally {
        setComponentLoading(false);
      }
    }

  }

  const handleGoogleLogin = (e) => {
    e.preventDefault();
    const callbackParam = searchParams.get("callbackUrl");
    const planId = searchParams.get("plan");

    let callbackUrl = "/login"; // Force /login so middleware intercepts and redirects based on subscription/engagement letter status

    if (planId) {
      callbackUrl = `/planlist/${planId}`;
    } else if (callbackParam && callbackParam !== "/") {
      callbackUrl = callbackParam;
    }

    signIn("google", {
      redirect: true,
      callbackUrl: callbackUrl,
    });
  };

  const handleResendVerification = async () => {
    if (!unverifiedEmail) return;
    setResending(true);
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}auth/re-verify-email`, {
        email: unverifiedEmail
      });
      toast.success(res?.data?.message || "Verification email has been resent.");
      setUnverifiedEmail(null);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to resend verification email.");
    } finally {
      setResending(false);
    }
  };

  if (loading) {
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{ height: "100vh", backgroundColor: "#fff" }}
      >
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* P0 K.3: OTP chooser + Google sign-in hidden (D1/D2). Password is the only path. */}
      {false && !isUsePassword && !isSendCode && <div className="registration_login_full">
        <div className="container-fluid">
          <div className="auth-inr-box">
            <div className="row">
              <div className="col-lg-6 col-md-5 pe-0">
                <div className="register_img text-center h-100">
                  {/* <img src="/images/login_pic.png" alt="" /> */}
                  <img src="/images/login-img.png" alt="" className="img-fluid" />

                  {/*  */}
                </div>
              </div>
              <div className="col-lg-6 col-md-7 ps-md-0 ps-3 pe-3">
                <div className="registration_part_inner">
                  <div className="global_login_holdr login">
                    <div className="sign_in_form_part ">

                      {
                        componentLoading ?
                          <div className="d-flex justify-content-center align-items-center">
                            <div className="spinner-border text-primary" role="status">
                              <span className="visually-hidden">Loading...</span>
                            </div>
                          </div>
                          :
                          <>
                            <div className="mb-4">
                              <h1 className="text-center mb-2 fs-3">Login to your account</h1>
                              {/* <p className="text-center text-muted">Sign in to your account to continue securely and manage <br /> your information with ease.</p> */}
                              <p className="text-center text-muted">Access your account by signing in.</p>
                            </div>
                            <form>
                              <div className="sign_in_form">
                                <div className="form_row position-relative">
                                  {/* <input type="email" className="email_field" placeholder="Your Email Address"/> */}
                                  <TextInputField
                                    type={"email"}
                                    name={"email"}
                                    value={loginFormValidation.email}
                                    handleFunction={handleChange}
                                    className="email_field"
                                    placeholder="Your Email Address"
                                    err={loginFormError.email}
                                    autoComplete="username"
                                  />
                                  <span className="mail-icon">
                                    <IoMdMail />
                                  </span>
                                </div>
                                <div className="code_password_condition">
                                  <div className="form_btn_row">
                                    <button type="button" className="common-btn w-100 justify-content-center" onClick={() => setIsUsePassword(true)}> <TranslatedText className="w-100"> Use password </TranslatedText></button>
                                  </div>
                                  <span className="or"><em>Or</em></span>
                                  <div className="form_btn_row">
                                    <button type="button" className="common-bd-btn w-100 justify-content-center" onClick={handleSendCode}>  <TranslatedText>Send sign-in code </TranslatedText></button>
                                  </div>
                                  {/* Google Login */}
                                  <span className="or"><em> <TranslatedText>Or Sign In with </TranslatedText></em></span>
                                  <ul
                                    className="social_reg ps-0 mt-3"
                                  >
                                    <li onClick={handleGoogleLogin}>
                                      <button
                                        type="button"
                                        className="w-100 gap-1 d-flex align-items-center justify-content-center border-0 bg-transparent"
                                        onClick={handleGoogleLogin}
                                        aria-label="Sign in with Google"
                                      >
                                        <FcGoogle size={20} /> Signin With Google
                                      </button>
                                    </li>
                                  </ul>
                                  <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                                    <div className="remember_me">
                                      <label className="cl-checkbox">
                                        <input type="checkbox" checked={undefined} />
                                        <TranslatedSpan>Remember me</TranslatedSpan>
                                      </label>
                                    </div>
                                    <div className="forgot_pass">
                                      <TranslatedNextLink href="/forgot-password">Forget your password?</TranslatedNextLink>
                                    </div>
                                  </div>
                                  <div className="resecd_code mb-0">
                                    <p> <TranslatedText>Don’t have any account? </TranslatedText><TranslatedNextLink href={`/register${searchParams.get('plan') ? `?plan=${searchParams.get('plan')}` : ''}`}>{" "}Sign Up</TranslatedNextLink></p>
                                  </div>

                                </div>
                              </div>
                            </form>
                          </>
                      }
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>}

      {isUsePassword && <UsePasswordSection
        isView={isView}
        loginFormValidation={loginFormValidation}
        handleChange={handleChange}
        loginFormError={loginFormError}
        validError={validError}
        spanErrors={spanErrors}
        handleView={handleView}
        loginFormHandler={loginFormHandler}
        unverifiedEmail={unverifiedEmail}
        resending={resending}
        handleResendVerification={handleResendVerification} />}


      {/* P0: customer OTP login UI hidden */}
      {false && isSendCode && <UseCodeSection
        codeDigits={codeDigits}
        // setCodeDigits={setCodeDigits} 
        handleCodeDigitChange={handleCodeDigitChange}
        loginFormValidation={loginFormValidation}
        loginFormHandler2={loginFormHandler2}
        handleChange={handleChange}
        isSendCode={isSendCode}
        setIsSendCode={setIsSendCode}
        handleSendCode={handleSendCode}
        code={code}
        setCode={setCode}
        setCodeDigits={setCodeDigits}
        handleKeyDown={handleKeyDown}
        inputRefs={inputRefs}
        loginFormError={loginFormError} />}


    </>
  );
}


