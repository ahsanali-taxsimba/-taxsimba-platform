'use client'
// import TextInputField from '../../../components/default/TextInputField'
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import TextInputField from '../../../components/default/TextInputField'
import RegistrationLoginLayout from '../_authLayout/RegistrationLoginLayout'
// import RegistrationLoginLayout from '../_authLayout/RegistrationLoginLayout'
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEye,
  faEyeSlash,
  faParagraph,
} from "@fortawesome/free-solid-svg-icons";
import axios from 'axios';
import { useSearchParams } from 'next/navigation'
import Pcomponent from '../../utils/typography/Pcomponent';
import H2component from '../../utils/typography/H2component';
import toast from 'react-hot-toast';
import { TranslatedHeading, TranslatedHeadingTwo, TranslatedHeadingThree, TranslatedHeadingFour, TranslatedHeadingFive, TranslatedParagraph, TranslatedButton, TranslatedSpan, TranslatedNextLink, TranslatedInput } from "@/components/TranslatedContent";
import TranslatedText from "@/components/TranslatedText";
import { IoIosMail, IoMdMail } from 'react-icons/io';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token');
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
    if (formError.password || formError.confirmPassword || !formData.password || !formData.confirmPassword) {
      toast.error("Please fill the passwords correctly");
      return;
    }
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}auth/reset-password`, {
        token: token,
        password: formData.password,
        confirmPassword: formData.confirmPassword
      })

      if (res.status === 200) {
        toast.success("reset-password successful");
        router.push('/login')
      }
      else {
      }
    } catch (error) {
      toast.error(error?.response?.data?.message)
    }
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
                  <h5 className='fw-bold mb-4 text-center'>Forgot your password</h5>
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
                          // validError={validError}
                          // spanErrors={spanErrors}
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
                        onClick={(e) => handleClick(e)}
                      > <TranslatedText> Reset Password </TranslatedText>
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