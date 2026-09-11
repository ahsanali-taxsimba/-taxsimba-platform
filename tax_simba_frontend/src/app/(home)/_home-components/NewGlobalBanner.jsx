import React from 'react'
import { Container, Row, Col } from 'react-bootstrap'
import { IoCheckmarkOutline } from 'react-icons/io5'
import { GoArrowUpRight } from 'react-icons/go'
import { FaStar } from 'react-icons/fa'
import Link from 'next/link'

const NewGlobalBanner = () => {
  return (

    <section className='newSiteBanner banner_main'>
      <div className="container">
        <div className="textContent">
          <div>
            <TranslatedHeading>
              Stress Free Self Assessment Tax Returns. Filed Correctly. On Time.
            </TranslatedHeading>
            <TranslatedParagraph>
              Trusted UK tax advisers prepare and submit your Self Assessment tax return online for just
              <span className="neon-text">£120</span> - HMRC-compliant with no hidden fees.
            </TranslatedParagraph>
            <ul className='ul'>
              <li>
                <img className='tick' src="/images/Icon-set.png" alt="" />
                <TranslatedSpan>
                  <TranslatedStrong>HMRC</TranslatedStrong> <TranslatedSpan>Registered Accountants</TranslatedSpan>
                </TranslatedSpan>
              </li>
              <li>
                <img className='tick' src="/images/Icon-set.png" alt="" />
                <TranslatedSpan>
                  Reviewed by certified UK tax advisers
                </TranslatedSpan>
              </li>
              <li>
                <img className='tick' src="/images/Icon-set.png" alt="" />
                <TranslatedSpan>
                  <TranslatedSpan>Average turnaround: </TranslatedSpan> <TranslatedStrong>48 hours</TranslatedStrong>
                </TranslatedSpan>
              </li>
              <li>
                <img className='tick' src="/images/Icon-set.png" alt="" />
                <TranslatedSpan>
                  100% Confidential & Secure
                </TranslatedSpan>
              </li>
            </ul>
          </div>
          <img className='siteBannerBgImg' src="/images/siteBannerBg.png" alt="" />
        </div>
      </div>
    </section>
  )
}

export default NewGlobalBanner
