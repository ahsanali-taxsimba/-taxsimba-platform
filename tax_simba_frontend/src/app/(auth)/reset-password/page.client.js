'use client'
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import TextInputField from '../../../components/default/TextInputField'
import RegistrationLoginLayout from '../_authLayout/RegistrationLoginLayout'
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEye,
  faEyeSlash,
} from "@fortawesome/free-solid-svg-icons";
import axios from 'axios';
import toast from 'react-hot-toast';
import { TranslatedText } from "@/components/TranslatedContent";
import { IoMdMail } from 'react-icons/io';
import CheckInbox from '../../../components/default/CheckInbox';

const INVALID_TOKEN_MESSAGE = "Invalid or expired password reset link.";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = (searchParams.get('token') || "").trim();
  const [tokenError, setTokenError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [formError, setFormError] = useState({
    password: "",
    confirmPassword: "",
  });
  const [isView, setIsView] = useState({
    pass: false,
    confirmPass: false,
  });

  useEffect(() => {
    if (!token) {
      setTokenError(INVALID_TOKEN_MESSAGE);
    } else {
      setTokenError("");
    }
  }, [token]);

  const handleView = () => {
    setIsView((prev) => ({
      ...prev,
      pass: !prev.pass,
    }));
  };
  const handleViewConfirm = () => {
    setIsView((prev) => ({
      ...prev,
      confirmPass: !prev.confirmPass,
    }));
  };
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    setFormError((prev) => {
      const errors = { ...prev };

      if (name === "password") {
        const isValid = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[A-Za-z\d\S]{8,}$/.test(value);
        errors.password = isValid ? "" : "Password must be 8+ chars, include uppercase, lowercase, number & special character";

        if (formData.confirmPassword && formData.confirmPassword !== value) {
          errors.confirmPassword = "Passwords do not match";
        } else {
          errors.confirmPassword = "";
        }

      } else if (name === "confirmPassword") {
        errors.confirmPassword = value !== formData.password ? "Passwords do not match" : "";
      }

      return errors;
    });

  };
  const handleClick = async (e) => {
    e.preventDefault();
    if (!token) {
      setTokenError(INVALID_TOKEN_MESSAGE);
      toast.error(INVALID_TOKEN_MESSAGE);
      return;
    }
    if (formError.password || formError.confirmPassword || !formData.password || !formData.confirmPassword) {
      toast.error("Please fill the passwords correctly");
      return;
    }
    setSubmitting(true);
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}auth/reset-password`, {
        token: token,
        password: formData.password,
        confirmPassword: formData.confirmPassword
      })

      if (res.status === 200) {
        toast.success("Password reset successful. Please log in.");
        router.push('/login')
      } else {
        const msg = res?.data?.message || "Password reset failed.";
        setTokenError(msg);
        toast.error(msg);
      }
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        INVALID_TOKEN_MESSAGE;
      setTokenError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (tokenError && !token) {
    return (
      <RegistrationLoginLayout>
        <CheckInbox
          h3Text={tokenError}
          button={
            <button
              className="common-btn w-100 justify-content-center text-center"
              onClick={() => router.push('/login')}
            >
              Go To Login
            </button>
          }
        />
      </RegistrationLoginLayout>
    );
  }

  return (
    <>
      <RegistrationLoginLayout>

        <div className="global_login_holdr login">

          <div className='row'>
            <div className='col-lg-6 col-md-5 pe-0'>
              <div className="register_img text-center">
                <img src="/images/login-img.png" alt="" className="img-fluid" />
              </div>
            </div>
            <div className='col-lg-6 col-md-7 ps-0'>
              <div className='registration_part_inner'>

                <div className="sign_in_form_part ">
                  <h5 className='fw-bold mb-4 text-center'>Reset your password</h5>
                  {tokenError ? (
                    <p className="text-danger text-center mb-3" role="alert">{tokenError}</p>
                  ) : null}
                  <form>
                    <div className="sign_in_form">
                      <div className='mb-3 position-relative'>
                        <TextInputField
                          type={!isView.pass ? "password" : "text"}
                          name="password"
                          value={formData.password}
                          handleFunction={handleChange}
                          className="password_field"
                          err={formError.password}
                          placeholder="Enter New Password"
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
                        <span className="mail-icon">
                          <IoMdMail />
                        </span>
                      </div>
                      <div className='mb-3 position-relative'>
                        <TextInputField
                          type={!isView.confirmPass ? "password" : "text"}
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          handleFunction={handleChange}
                          className="password_field confirm"
                          err={formError.confirmPassword}
                          placeholder="Confirm New Password"
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
                        <span className="mail-icon">
                          <IoMdMail />
                        </span>
                      </div>
                    </div>
                    <div className="form_btn_row">
                      <button
                        className="common-btn w-100 justify-content-center"
                        disabled={submitting || !token}
                        onClick={(e) => handleClick(e)}
                      > <TranslatedText> {submitting ? "Resetting…" : "Reset Password"} </TranslatedText>
                      </button>
                    </div>


                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </RegistrationLoginLayout>

    </>
  )
}
