'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { TranslatedHeadingTwo, TranslatedLi,TranslatedLink,TranslatedSpan } from '@/components/TranslatedContent';
import GetStartedButton from '@/components/re-used/GetStartedButton';

export default function ServiceDetailsWhyChooseSection({service,whyChoseUsSection}) {
  const items = [
    { spanText: "Affordable pricing with no hidden fees" },
    { spanText: "Dedicated tax expert for every client" },
    { spanText: "24-hour response time" },
    { spanText: "Filing completed within 48 hours" },
    { spanText: "100% accuracy assurance" },
    { spanText: "Ideal for last-minute HMRC deadlines" },
    { spanText: "Friendly, simple guidance on every step" }
  ]
  return (
    <section className="cost_sec why_choose_taxsection">
      <div className="container">
                        <div className="global_heading text-center">
                            <TranslatedHeadingTwo>
                              <TranslatedSpan className="blue_txt">{whyChoseUsSection?.title1}</TranslatedSpan>
                             {whyChoseUsSection?.title2}
                            </TranslatedHeadingTwo>
                        </div>
        <div className="row">
          <div className="col-md-5">
            <div className="cost_image">
              <img src="/images/srvc_dtls_img.png" alt="" />
            </div>
          </div>
          <div className="col-md-7">
            <div className="cost_inner whats_include choose_taximba">
              <TranslatedHeadingTwo>{whyChoseUsSection?.itemsListing?.title}</TranslatedHeadingTwo>
              <ul>
                {whyChoseUsSection?.itemsListing?.lists.map((item, index) => (
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
        </div>
      </div>
      <div className='get_started_centered'><GetStartedButton text="Get started" href="/tax-return-form" variant="pro-blue"/></div>
    </section>
  )
}
