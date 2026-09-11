import TextInputField from "../../../../components/default/TextInputField"
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
// import { getSystemErrorMessage } from "util";
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import Link from "next/link";
import { TranslatedHeading, TranslatedHeadingTwo, TranslatedHeadingThree, TranslatedHeadingFour, TranslatedHeadingFive, TranslatedParagraph, TranslatedButton, TranslatedSpan, TranslatedNextLink, TranslatedInput } from "@/components/TranslatedContent";
import TranslatedText from "@/components/TranslatedText";
import { IoMdMail, IoIosCloseCircle } from "react-icons/io";
import { FaLock } from "react-icons/fa";
export default function UsePasswordSection({ isView, loginFormValidation, handleChange, loginFormError, validError, spanErrors, handleView, loginFormHandler, unverifiedEmail, resending, handleResendVerification }) {
    return (
        <>
            <div className="registration_login_full">
                <div className="container">
                    <div className="row">
                        <div className='col-lg-6 col-md-5 pe-0'>
                            <div className="register_img text-center">
                                <img src="/images/login-img.png" alt="" className="img-fluid" />
                            </div>
                        </div>
                        <div className="col-lg-6 col-md-7 ps-0">
                            <div className="registration_part_inner">
                                <div className="global_login_holdr login h-100">
                                    <div className="sign_in_form_part ">
                                        <div className="mb-4">
                                            <h3 className="text-center mb-2 ">Login to your account</h3>
                                            <p className="text-center text-muted">Sign in to your account to continue securely and manage <br /> your information with ease.</p>
                                        </div>
                                        <form>
                                            <div className="sign_in_form">
                                                <div className="form_row position-relative">
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
                                                <div className="form_row position-relative">
                                                    <TextInputField
                                                        type={!isView ? "password" : "text"}
                                                        name={"password"}
                                                        value={loginFormValidation.password}
                                                        handleFunction={handleChange}
                                                        className={"password_field"}
                                                        placeholder={"Password"}
                                                        err={loginFormError.password}
                                                        validError={validError}
                                                        spanErrors={spanErrors}
                                                        autoComplete="current-password"
                                                        eyeIcon={!isView ? <FontAwesomeIcon icon={faEyeSlash} onClick={handleView} />
                                                            : <FontAwesomeIcon icon={faEye} onClick={handleView} />}
                                                    />
                                                    <span className="mail-icon"><FaLock /></span>
                                                </div>
                                                {unverifiedEmail && (
                                                    <div className="alert alert-danger d-flex align-items-start gap-2 p-3 rounded mb-3 text-start" style={{ backgroundColor: '#FDF2F2', borderColor: '#FDE8E8', color: '#9B1C1C', border: '1px solid' }}>
                                                        <span style={{ fontSize: '1.25rem', color: '#F05252', display: 'inline-flex', marginTop: '2px' }}>
                                                            <IoIosCloseCircle />
                                                        </span>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}><TranslatedText>Email not verified.</TranslatedText></div>
                                                            <div style={{ fontSize: '0.875rem', marginTop: '4px' }}>
                                                                <TranslatedText>Please verify your email using the link we sent before signing in.</TranslatedText>
                                                            </div>
                                                            <div style={{ marginTop: '8px' }}>
                                                                <button
                                                                    type="button"
                                                                    onClick={handleResendVerification}
                                                                    disabled={resending}
                                                                    className="btn btn-link p-0 text-decoration-underline"
                                                                    style={{ color: '#2D9C75', fontWeight: '600', fontSize: '0.875rem', border: 'none', background: 'none', cursor: 'pointer' }}
                                                                >
                                                                    {resending ? <TranslatedText>Resending...</TranslatedText> : <TranslatedText>Resend verification link</TranslatedText>}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="form_btn_row ">
                                                    <button className="common-btn w-100"
                                                        type="submit"
                                                        onClick={(e) => loginFormHandler(e)}> <TranslatedText>Sign In</TranslatedText></button>
                                                </div>
                                                <div className="d-flex align-items-center justify-content-between flex-wrap">
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
                                                    <p> <TranslatedText>Don’t have any account? </TranslatedText><TranslatedNextLink href="/register">{" "}Sign Up</TranslatedNextLink></p>
                                                </div>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}