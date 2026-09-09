'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { TranslatedHeadingTwo, TranslatedLi, TranslatedLink } from '@/components/TranslatedContent';
import GetStartedButton from '@/components/re-used/GetStartedButton';

export default function WhatYouGetSectionDetails({benefitsSection}){
  const items = [
    {spanText:"Expert guidance tailored to your situation"},
    {spanText:"Maximum eligible deductions"},
    {spanText:"Accurate calculations"},
    {spanText:"Transparent pricing"},
    {spanText:"Fast and reliable communication"},
    {spanText:"HMRC-compliant filing done for you"}
  ]
  console.log("benefitsSection",benefitsSection)
    return (
        <section className="cost_sec">
    <div className="container">
      <div className="row">
        <div className="col-md-7">
          <div className="cost_inner whats_include">
            <TranslatedHeadingTwo>{benefitsSection.title}</TranslatedHeadingTwo>
            <ul>
              {benefitsSection.items.map((item, index) => (
                <TranslatedLi
                  key={index}
                  prefix={
                    <span>
                      <FontAwesomeIcon icon={faCheck} />
                    </span>
                  }
                >
                  {item}
                </TranslatedLi>
              ))}
            </ul>
          </div>
        </div>
        <div className="col-md-5">
          <div className="cost_image">
            <img src="/images/srvc_dtls_img.png" alt="" />
          </div>
        </div>
        
      </div>
    </div>
    <div className='get_started_centered'><GetStartedButton text="Get started" href="/tax-return-form" variant="pro-blue"/></div>
  </section>
    )
}
