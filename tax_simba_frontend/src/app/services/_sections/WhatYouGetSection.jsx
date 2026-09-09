'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { TranslatedHeadingTwo, TranslatedLi } from '@/components/TranslatedContent';
import { FaCheckDouble } from "react-icons/fa6";

export default function WhatYouGetSection() {
  const items = [
    { spanText: "Expert advice tailored to your needs" },
    { spanText: "Maximum eligible deductions" },
    { spanText: "Precise calculations" },
    { spanText: "Price transparency" },
    { spanText: "Fast and reliable communication" },
    { spanText: "HMRC compliance" }
  ]
  return (
    <section className="cost_sec ptb-80">
      <div className="container">
        <div className="row flex-lg-row flex-column-reverse">
          <div className="col-lg-7 mb-lg-0 mb-4">
            <div className="cost_inner pe-lg-5 pe-0">
              <h2>What You Get with <span className='text-theme'>TaxSimba</span></h2>
              <p className='mb-0'>We help you finish your taxes quickly and save more of your money.</p>
              <ul className="list-unstyled mt-4">
                <li className='d-flex align-items-center gap-2 mb-3'><span className='feature-icon'> <FaCheckDouble /> </span> Friendly help for all your questions</li>
                <li className='d-flex align-items-center gap-2 mb-3'><span className='feature-icon'> <FaCheckDouble /> </span> Easy ways to save more of your money</li>
                <li className='d-flex align-items-center gap-2 mb-3'><span className='feature-icon'> <FaCheckDouble /> </span> Everything is checked and done the right way</li>
                <li className='d-flex align-items-center gap-2 mb-3'><span className='feature-icon'> <FaCheckDouble /> </span> Fast and simple tools to use</li>
                <li className='d-flex align-items-center gap-2 mb-3'><span className='feature-icon'> <FaCheckDouble /> </span> Clear prices with no surprises</li>
                <li className='d-flex align-items-center gap-2 mb-3'><span className='feature-icon'> <FaCheckDouble /> </span> Your info is always safe with us</li>
              </ul>
            </div>
          </div>
          <div className="col-lg-5 mb-lg-0 mb-4">
            <div className="cost_image">
              <img src="/images/auth.jpg" alt="" className='img-fluid' />
            </div>
          </div>

        </div>
      </div>
    </section >
  )
}
