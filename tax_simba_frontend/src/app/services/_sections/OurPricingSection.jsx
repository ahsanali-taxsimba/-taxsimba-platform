'use client';
import React from 'react'
import Accordion from 'react-bootstrap/Accordion';
import { TranslatedHeading, TranslatedHeadingTwo, TranslatedHeadingFour, TranslatedHeadingFive, TranslatedParagraph, TranslatedButton, TranslatedSpan, TranslatedLink } from "@/components/TranslatedContent";
import TranslatedText from "@/components/TranslatedText";
import { Link } from 'next/link';
const OurPricingSection = () => {
  return (
    <>
      <section className="faq">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-7 col-md-5">
              <div className="srvc_image">
                <img src="/images/cost_image.png" alt="cost_image" />
              </div>
            </div>
            <div className="col-lg-5 col-md-7">
              <div className="global_heading cst_srvc">
                <TranslatedHeadingTwo prefix={<TranslatedSpan className="blue_txt">Our Services</TranslatedSpan>}>Simple, transparent pricing Only £120 per tax return No hidden fees. No Surprises.</TranslatedHeadingTwo>
                <div className='get_started_centered'><TranslatedLink href="/contact-us" className="basic_btn cean_btn">Contact Us</TranslatedLink></div>
                <TranslatedParagraph className="small_txt">making UK tax filing simple, accurate and stress-free.</TranslatedParagraph>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

export default OurPricingSection
