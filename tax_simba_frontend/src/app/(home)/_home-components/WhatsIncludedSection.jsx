'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { TranslatedHeadingTwo, TranslatedLi, TranslatedLink } from '@/components/TranslatedContent';

export default function WhatsIncludedSection(){
  const items = [
    {spanText:"Complete HMRC Tax Return Submission"},
    {spanText:"Professional Review by Certified Accountants"},
    {spanText:"Customised Tax Consultancy"},
    {spanText:"Breakdown of Income & Expenses"},
    {spanText:"Guidance and support to reduce tax burden"},
    {spanText:"Personal Support by Phone, Email & Chat"}
  ]
    return (
        <section className="cost_sec">
    <div className="container">
      <div className="row">
        <div className="col-md-5">
          <div className="cost_image">
            <img src="/images/whats_image.png" alt="whats_image" />
          </div>
        </div>
        <div className="col-md-7">
          <div className="cost_inner whats_include">
            <TranslatedHeadingTwo>What’s included?</TranslatedHeadingTwo>
            <ul>
              {items.map((item, index) => (
                <TranslatedLi
                  key={index}
                  prefix={
                    <span>
                      <FontAwesomeIcon icon={faCheck} />
                    </span>
                  }
                >
                  {item.spanText}
                </TranslatedLi>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  </section>
    )
}

