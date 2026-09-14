import { usePathname, useRouter } from "next/navigation";
import React from "react";
import Link from "next/link";
import Pcomponent from "../../app/utils/typography/Pcomponent";
import H3component from "../../app/utils/typography/H3component";
import { FaCircleExclamation } from "react-icons/fa6";
const CheckInbox = ({ paragraph, h3Text, button, inputBox = "" }) => {
  const router = useRouter();
  const pathName = usePathname();

  return (
    <div className="row">
      <div className="col-lg-6 col-md-5 pe-0">
        <div className="register_img text-center">
          <img src="/images/login-img.png" alt="" className="img-fluid" />
        </div>
      </div>
      <div className="col-lg-6 col-md-7 ps-0">
        <div className="registration_part_inner">
          <div className="sign_in_form_part">
            <span className="email_bg">
              <FaCircleExclamation />
            </span>

            <H3component>{h3Text}</H3component>
            <Pcomponent>{paragraph}</Pcomponent>

            {
              inputBox &&
              <div className="form_btn_row">
                {inputBox}
              </div>
            }
            <div className="form_btn_row">

              {button}
            </div>
            <div className="resecd_code mb-0">
              {pathName !== "/verify-email" ? (
                <Pcomponent>
                  Didn’t get e-mail ?<Link href="#">Send it again</Link>
                </Pcomponent>
              ) : (
                <Pcomponent></Pcomponent>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckInbox;
