'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { TranslatedHeadingTwo, TranslatedLi, TranslatedParagraph } from '@/components/TranslatedContent';
import { FaCheckDouble } from "react-icons/fa6";


export default function WhyChooseSection() {
  const items = [
    { spanText: "Fast, hassle-free and paper-free tax filing" },
    { spanText: "Dedicated tax professional" },
    { spanText: "24-hour response time" },
    { spanText: "Response within 24 hours" },
    { spanText: "100% accurate and error-free filing guarantee" },
    { spanText: "48-hours tax return filing" },
    { spanText: "Ideal for last-minute filing" },
    { spanText: "Totally secure and compliant" }
  ]
  return (
    <section className="cost_sec why_choose_taxsimba ptb-80">
      <div className="container">
        <div className="row flex-lg-row flex-column-reverse">
          <div className="col-lg-5">
            <div className="cost_image">
              <img src="/images/auth.jpg" alt="" className='img-fluid' />
            </div>
          </div>
          <div className="col-lg-7 mb-lg-0 mb-4">
            <div className="cost_inner ps-lg-5 ps-0">
              <h2>Why choose <span className='text-theme'>TaxSimba?</span></h2>
              <p className="mb-0">We make doing your taxes easy, fast, and happy.</p>
              <ul className="list-unstyled mt-4">
                <li className='d-flex align-items-center gap-2 mb-3'><span className='feature-icon'> <FaCheckDouble /> </span> Fast and simple filing</li>
                <li className='d-flex align-items-center gap-2 mb-3'><span className='feature-icon'> <FaCheckDouble /> </span> 100% accurate and error-free filing guarantee</li>
                <li className='d-flex align-items-center gap-2 mb-3'><span className='feature-icon'> <FaCheckDouble /> </span> 48-hours tax return filing</li>
                <li className='d-flex align-items-center gap-2 mb-3'><span className='feature-icon'> <FaCheckDouble /> </span> Ideal for last-minute filing</li>
                <li className='d-flex align-items-center gap-2 mb-3'><span className='feature-icon'> <FaCheckDouble /> </span> Totally secure and compliant</li>
                <li className='d-flex align-items-center gap-2 mb-3'><span className='feature-icon'> <FaCheckDouble /> </span> Dedicated tax professional</li>
              </ul>

            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
