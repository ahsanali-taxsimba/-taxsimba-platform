'use client'
import React, { useState } from 'react'
import RegistrationLoginLayout from '../_authLayout/RegistrationLoginLayout'
import TextInputField from "../../../components/default/TextInputField";
import axios from 'axios';
import H2component from '../../utils/typography/H2component';
import Pcomponent from '../../utils/typography/Pcomponent';
import toast from 'react-hot-toast';
import { TranslatedHeading, TranslatedHeadingTwo, TranslatedHeadingThree, TranslatedHeadingFour, TranslatedHeadingFive, TranslatedParagraph, TranslatedButton, TranslatedSpan, TranslatedNextLink, TranslatedInput } from "@/components/TranslatedContent";
import TranslatedText from "@/components/TranslatedText";
import { IoIosArrowBack, IoIosMail, IoMdMail } from 'react-icons/io';
import { IoArrowBackCircleSharp } from 'react-icons/io5';
import Link from 'next/link';
const ForgotPasswordClientPage = () => {
  const [isResetLink, setIsResetLink] = useState(false)
  const [isFormlValidate, setIsFormValidate] = useState({ email: "" })
  const [isFormError, setIsFormError] = useState({ email: "" })


  const handleChange = (e) => {
    const { name, value } = e.target
    setIsFormValidate(prev => ({ ...prev, [name]: value }))
    validateForm(name, value)
  }

  const validateForm = (name, value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    let error = ""
    if (name === "email") {
      if (!value) {
        error = "Email is required"
      } else if (!emailRegex.test(value)) {
        error = "Invalid Email"
      } else {
        error = ""
      }
    }
    setIsFormError(prev => ({ ...prev, [name]: error }))

  }
  const handleResetLinkRequest = async (e) => {
    e.preventDefault()
    try {
      const res = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}auth/forget-password`, {
        email: isFormlValidate.email
      })
      toast.success(res?.data?.message || "check your inbox");
      setIsResetLink(true)
    }
    catch (err) {
      toast.error(err?.response?.data?.message || "Invalid Email");
    }

  }
  return (
    <>
      <RegistrationLoginLayout>
        <div className='for_forgot_page'>
          {!isResetLink && <div className="global_login_holdr login" >
            <div className="login_head">
              <H2component contentText='Welcome' />
              <Pcomponent contentText='Forgot your password?' />
            </div>
            <div className='row'>
              <div className='col-lg-6 col-md-5 pe-0'>
                <div className="register_img text-center">
                  <img src="/images/login-img.png" alt="" className="img-fluid" />
                </div>
              </div>
              <div className='col-lg-6 col-md-7 ps-md-0 ps-3'>
                <div className='registration_part_inner'>
                  <div className="sign_in_form_part">

                    <div className='back-btn'>
                      <Link href='/'> <span className='me-0'> <IoIosArrowBack /></span> Back </Link>
                    </div>
                    <h4 className='fw-bold text-center mb-2'>Forgot Password</h4>
                    <p className='text-muted'>Enter your email to reset your password and regain <br /> access to your account.</p>
                    <form>
                      <div className="                                                 position-relative">

                        <TextInputField
                          type={"email"}
                          name={"email"}
                          value={isFormlValidate.email}
                          className={"email_field"}
                          placeholder={"Your Email Address"}
                          handleFunction={(e) => handleChange(e)}
                        />
                        {isFormError && <span className='error_msg error_msg_color'>{isFormError.email}</span>}
                        <span className="mail-icon">
                          <IoMdMail />
                        </span>
                      </div>
                      <div className="form_btn_row">
                        <button
                          className="common-btn w-100 justify-content-center"
                          onClick={(e) => handleResetLinkRequest(e)}
                        > <TranslatedText> Request Password Link </TranslatedText>
                        </button>
                      </div>
                      <div className="resecd_code mb-0">
                        <p> <TranslatedText>Don’t have any account? </TranslatedText><TranslatedNextLink href="/register">{" "}Sign Up</TranslatedNextLink></p>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>

          </div>}
          {isResetLink && <div className="global_login_holdr login">
            <div className="login_head">
              <H2component>Welcome</H2component>

            </div>
            <div className="sign_in_form_part ">
              <Pcomponent>Password reset link has been sent successfully. Please check your email.</Pcomponent>


            </div>
          </div>}
        </div>
      </RegistrationLoginLayout>
    </>
  )
}

export default ForgotPasswordClientPage
