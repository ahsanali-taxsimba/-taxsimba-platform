"use client";
import {
  faEye,
  faEyeSlash
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import TextInputField from "../../../components/default/TextInputField";
// import RegisterApi from ".././../../lib/api";
import RegisterApi from "@/app/lib/api";
import { TranslatedButton, TranslatedNextLink } from "@/components/TranslatedContent";
import TranslatedText from "@/components/TranslatedText";
import { signIn } from "next-auth/react";
import Link from "next/link";
import toast from "react-hot-toast";
import { FaLock, FaPhone, FaUser } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { IoMdMail } from "react-icons/io";
import CheckYourInbox from "./_sections/CheckYourInbox";
export default function RegisterPage() {
  const [isView, setIsView] = useState({
    pass: false,
    confirmPass: false,
  });
  const [apiErrorMsg, setApiErrorMsg] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    surname: "",
    email: "",
    mobile: "",
    password: "",
    confirmPassword: "",
    userRole: "TAXSIMBA",
  });

  const [errors, setErrors] = useState({
    name: "",
    surname: "",
    email: "",
    mobile: "",
    password: "",
    confirmPassword: "",
  });

  const [validError, setValidError] = useState({
    reqPass: false,
    upper: false,
    lower: false,
    sp: false,
    digit: false,
    max: false,
  });

  const [valid, setValid] = useState(false);

  const spanErrors = {
    errMsg: [

      { id: "reqPass", msg: "Password is required" },
      { id: "upper", msg: "Must contain uppercase letter" },
      { id: "lower", msg: "Must contain lowercase letter" },
      { id: "sp", msg: "Must contain a special character" },
      { id: "digit", msg: "Must contain a number" },
      { id: "max", msg: "Must be at least 8 characters" },
    ],
  };

  const router = useRouter();
  const searchParams = useSearchParams();
  const rolePlaceholder = searchParams.get("role") || "";

  useEffect(() => {
    if (rolePlaceholder) {
      setFormData((prev) => ({
        ...prev,
        userRole: rolePlaceholder,
      }));
    }
  }, [rolePlaceholder]);

  const handleChange = (e) => {
    setApiErrorMsg("");
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    validateField(name, value);
  };

  const validateField = (name, value) => {
    let error = "";

    const inputClassMap = {
      name: "user_name",
      surname: "user_name",
      email: "email_field",
      mobile: "phone_field",
      password: "password_field",
      confirmPassword: "confirm",
    };

    const inputEl = document.querySelector(`.${inputClassMap[name]}`);

    if (name === "email") {
      if (!value) {
        error = "Email is required";
      } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) {
        error = "Invalid email address";
      }
      inputEl?.classList.toggle("input_err", !!error);
    } else if (name === "mobile") {

      const mobileRegex = /^\+?\d{1,15}$/;

      if (!value) {
        error = "Phone number is required";
      } else if (value.includes(" ")) {
        error = "Phone number must not contain spaces";
      } else if (!mobileRegex.test(value)) {
        error = "Phone number must contain only numbers";
      } else if (value.replace("+", "").length < 5 || value.replace("+", "").length > 15) {
        error = "Phone number must be between 5 and 15 digits";
      }
      inputEl?.classList.toggle("input_err", !!error);
    } else if (name === "name") {
      if (!value) {
        error = "Name is required";
      } else if (!/^[a-zA-Z\s]+$/.test(value)) {
        error = "Name must contain only letters and spaces";
      }
      inputEl?.classList.toggle("input_err", !!error);
    } else if (name === "surname") {
      if (!value) {
        error = "Surname is required";
      } else if (!/^[a-zA-Z\s]+$/.test(value)) {
        error = "Surname must contain only letters and spaces";
      }
      inputEl?.classList.toggle("input_err", !!error);
    }
    else if (name === "password") {
      const rules = {
        reqPass: value.trim() !== "",
        upper: /[A-Z]/.test(value),
        lower: /[a-z]/.test(value),
        sp: /[!@#$%^&*]/.test(value),
        digit: /[0-9]/.test(value),
        max: value.length >= 8,
      };

      setValidError({
        reqPass: rules.reqPass,
        upper: rules.upper,
        lower: rules.lower,
        sp: rules.sp,
        digit: rules.digit,
        max: rules.max,
      });

      if (!rules.reqPass) {
        error = "Password is required";
      }

      inputEl?.classList.toggle("input_err", !!error);
    } else if (name === "confirmPassword") {
      if (!value) {
        error = "Please confirm your password";
      } else if (value !== formData.password) {
        error = "Passwords do not match";
      }
      inputEl?.classList.toggle("input_err", !!error);
    }

    setErrors((prev) => ({
      ...prev,
      [name]: error,
    }));
  };
  const handleView = () => {
    setIsView((prev) => ({
      ...prev,
      pass: !prev.pass, // toggle pass value
    }));
  };

  const handleViewConfirm = () => {
    setIsView((prev) => ({
      ...prev,
      confirmPass: !prev.confirmPass,
    }));
  };
  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = { ...errors };
    Object.keys(formData).forEach((field) => {
      validateField(field, formData[field]);
    });

    const isValid = Object.values(newErrors).every((error) => !error);

    // Check if required fields are filled (ignoring userRole if it's optional, but it has a default now)
    const requiredFields = { ...formData };
    delete requiredFields.userRole; // it has a default, but we check others

    if (isValid && Object.values(requiredFields).every((val) => val)) {
      try {
        const { response, error } = await RegisterApi(formData);
        if (response) {
          if (response.status == 200 || response.status == 201) {
            toast.success(response.data.message);
            const planId = searchParams.get('plan');
            // Registration never grants ACTIVE entitlement (D8). Always continue verify / planlist path.
            if (planId) {
              setValid(true);
            } else {
              setValid(true);
            }
          }
        }
        if (error) {
          // if(error) {
          setApiErrorMsg(error?.response?.data?.message);
          toast.error(error?.response?.data?.message);
          // }
        }
      } catch (error) {
        return null;
      }
    } else {
      setErrors(newErrors);
    }
  };

  const handleGoogleLogin = (e) => {
    e.preventDefault();
    const callbackParam = searchParams.get("callbackUrl");
    const planId = searchParams.get("plan");
    const roleParam = searchParams.get("role");

    const selectedRole = roleParam || formData.userRole || "TAXSIMBA";
    document.cookie = `register-role=${selectedRole}; path=/; max-age=3600`;

    let callbackUrl = "/login";

    if (planId) {
      callbackUrl = `/planlist/${planId}`;
    } else if (callbackParam && callbackParam !== "/") {
      callbackUrl = callbackParam;
    } else if (selectedRole) {
      callbackUrl = `/login?role=${selectedRole}`;
    }

    signIn("google", {
      redirect: true,
      callbackUrl: callbackUrl,
    });
  };

  return (

    <>
      {!valid && (<div className="registration_login_full">
        <div className="container">
          <div className="row">
            <div className="col-lg-6 col-md-5 pe-0">
              <div className="register_img text-center">
                <img src="/images/login-img.png" alt="" className="img-fluid" />
              </div>
            </div>
            <div className="col-lg-6 col-md-7 ps-md-0 ps-3 pe-3">
              <div className="registration_part_inner">
                <div className="global_login_holdr registration h-100">
                  <div className="sign_in_form_part mb-2">
                    <h1 className="mb-2 fw-bold fs-3">Registration</h1>
                    <p className="text-center text-muted mb-4">
                      Complete your registration to create  a  secure account.
                    </p>
                    <form onSubmit={handleSubmit}>
                      <div className="sign_in_form">
                        <div className="row">
                          <div className="col-lg-6">
                            <div className="form_row mb-3 position-relative">
                              <TextInputField
                                type="text"
                                name="name"
                                value={formData.name}
                                handleFunction={handleChange}
                                className="user_name"
                                err={errors.name}
                                placeholder="Your name"
                                autoComplete="given-name"
                              />
                              <span className="mail-icon"><FaUser /></span>
                            </div>
                          </div>
                          <div className="col-lg-6">
                            <div className="form_row mb-3 position-relative">
                              <TextInputField
                                type="text"
                                name="surname"
                                value={formData.surname}
                                handleFunction={handleChange}
                                className="user_name"
                                err={errors.surname}
                                placeholder="Your Surname"
                                autoComplete="family-name"
                              />
                              <span className="mail-icon"><FaUser /></span>
                            </div>
                          </div>
                          <div className="col-lg-6">
                            <div className="form_row mb-3 position-relative">
                              <TextInputField
                                type="email"
                                name="email"
                                value={formData.email}
                                handleFunction={handleChange}
                                className="email_field"
                                err={errors.email}
                                placeholder="Your Email Address"
                                autoComplete="email"
                              />
                              <span className="mail-icon">
                                <IoMdMail />
                              </span>
                            </div>
                          </div>
                          <div className="col-lg-6">
                            <div className="form_row mb-3 position-relative">
                              <TextInputField
                                type="tel"
                                name="mobile"
                                value={formData.mobile}
                                handleFunction={handleChange}
                                className="phone_field"
                                err={errors.mobile}
                                placeholder="Your Phone Number"
                                autoComplete="tel"
                              />
                              <span className="mail-icon"><FaPhone /></span>
                            </div></div>
                          <div className="col-lg-12">
                            <div className="form_row mb-3 position-relative">
                              <TextInputField
                                type={!isView.pass ? "password" : "text"}
                                name="password"
                                value={formData.password}
                                handleFunction={handleChange}
                                className="password_field"
                                err={errors.password}
                                validError={validError}
                                spanErrors={spanErrors}
                                placeholder="Enter Password"
                                autoComplete="new-password"
                                eyeIcon={
                                  !isView.pass ? (
                                    <FontAwesomeIcon
                                      icon={faEyeSlash}
                                      onClick={handleView}
                                    />
                                  ) : (
                                    <FontAwesomeIcon icon={faEye} onClick={handleView} />
                                  )
                                }
                              />
                              <span className="mail-icon"><FaLock /></span>
                            </div></div>
                          <div className="col-lg-12">
                            <div className="form_row mb-3 position-relative">

                              <TextInputField
                                type={!isView.confirmPass ? "password" : "text"}
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                handleFunction={handleChange}
                                className="password_field confirm"
                                err={errors.confirmPassword}
                                placeholder="Confirm Password"
                                autoComplete="new-password"
                                eyeIcon={
                                  !isView.confirmPass ? (
                                    <FontAwesomeIcon
                                      icon={faEyeSlash}
                                      onClick={handleViewConfirm}
                                    />
                                  ) : (
                                    <FontAwesomeIcon
                                      icon={faEye}
                                      onClick={handleViewConfirm}
                                    />
                                  )
                                }
                              />
                              <span className="mail-icon"><FaLock /></span>
                            </div></div>
                        </div>
                        {apiErrorMsg && <span className="error_msg error_msg_color">{apiErrorMsg}</span>}
                        <div className="form_btn_row">
                          <TranslatedButton type="submit" className="common-btn w-100 justify-content-center" id="register">Register
                            Now</TranslatedButton>
                        </div>
                        {/* P0 K.3: Google sign-up hidden (D2 / A10) */}
                        {false && (
                          <>
                        <span className="or"><em> <TranslatedText > Or Sign Up with </TranslatedText></em></span>
                        <ul
                          className="social_reg ps-0 mt-3"
                        >
                          <li>
                            <button
                              type="button"
                              className="w-100 gap-1 d-flex align-items-center justify-content-center border-0 bg-transparent"
                              onClick={handleGoogleLogin}
                              aria-label="Sign up with Google"
                            >
                              <FcGoogle size={20} /> Signin With Google
                            </button>
                          </li>
                        </ul>
                          </>
                        )}
                        <div className="resecd_code mb-0">
                          <p> <TranslatedText> Already have any account? </TranslatedText> <TranslatedNextLink href={`/login${searchParams.get('plan') ? `?plan=${searchParams.get('plan')}` : ''}`}>{" "} Sign In</TranslatedNextLink></p>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>)}
      {valid && <CheckYourInbox email={formData.email} />}
    </>
  );
}
