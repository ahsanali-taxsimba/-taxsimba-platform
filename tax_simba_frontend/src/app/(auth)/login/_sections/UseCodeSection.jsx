'use client'

import { useState, useEffect } from "react";
import TextInputField from "../../../../components/default/TextInputField"
import Pcomponent from "../../../utils/typography/Pcomponent";
import Link from "next/link";
export default function UseCodeSection({loginFormValidation,handleChange,isSendCode,handleSendCode,codeDigits,handleCodeDigitChange,code,setCode,loginFormHandler2,loginFormError,handleKeyDown,inputRefs,setCodeDigits}) {
    const [counter,setCounter] = useState(30)
    useEffect(() => {
    
        if (!isSendCode || counter <= 0) return;
    
        const interval = setInterval(() => {
          setCounter((prevCounter) => prevCounter - 1); // use functional update
        }, 1000);
    
        return () => clearInterval(interval); // clear interval on cleanup
      
      }, [counter,isSendCode]);
      const handleTryAgain = ()=>{
        if(counter === 0){
          handleSendCode()
          setCodeDigits(['','','','']);
          setCode(0);
        }
        setCounter(30)
      }
    return (
        <>
           <div className="registration_login_full" style={{backgroundImage: 'url("/images/reg_back.png")'}}> 
        <div className="container">
            <div className="row">
                <div className="col-lg-6 col-md-5">
                    <div className="register_img">
                        <img src="/images/login-with-code.png" alt="" />
                    </div>
                </div>
                <div className="col-lg-6 col-md-7">
                    <div className="registration_part_inner">
                        <div className="global_login_holdr login">
                        <div className="sign_in_form_part ">
                            <h3>Log In below</h3>
                            <form>
                                <div className="sign_in_form">
                                    <div className="form_row">
                                        
                                        <input 
                                        type="email" 
                                        name="email"
                                        placeholder="Your Email Address"
                                        className="email_field"
                                        disabled={isSendCode} 
                                        value={loginFormValidation.email}  
                                        />
                                    </div>
                                        <div className="form_row">
                                            <div className="code_wrapper">
                                                                                                        {codeDigits.map((digit, index) => (
                                                            <div className="code_box" key={index}>
                                                                <input
                                                                type="text"
                                                                inputMode="numeric"
                                                                maxLength={1}
                                                                className="otp-input"
                                                                value={digit}
                                                                onChange={(e) => handleCodeDigitChange(e, index)}
                                                                onKeyDown={(e) => handleKeyDown(e, index)}
                                                                ref={(el) => (inputRefs.current[index] = el)}
                                                                />
                                                            </div>
                                                        ))}
                                            </div>
                                        </div>
                                        <div className="form_row">
                                            <div className="resecd_code code_part">
                                                        <Pcomponent>
                                                            Resend in {counter}s
                                                            <br />
                                                            Can’t received code? 
                                                            {
                                                                (counter>0)?
                                                                <span href="#" disabled ><i> Try Again</i></span>
                                                                :
                                                                <Link href="#" onClick={handleTryAgain}>Try Again</Link>
                                                            }
                                                        </Pcomponent>
                                            </div>
                                        </div>
                                       <div className="form_btn_row mt-60">
                                            <button onClick={(e) => loginFormHandler2(e)} className="basic_btn cean_btn ">Sign In</button>
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