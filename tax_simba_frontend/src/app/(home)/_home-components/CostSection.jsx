'use client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { TranslatedHeading, TranslatedHeadingTwo, TranslatedParagraph, TranslatedButton, TranslatedSpan, TranslatedLink } from "@/components/TranslatedContent";
import { useTranslate } from "@/hooks/useTranslate";
import { text } from '@fortawesome/fontawesome-svg-core';
import GetStartedButton from '@/components/re-used/GetStartedButton';
export default function CostSection() {
  const items = [
    { spanText: "HMRC submission" },
    { spanText: "Expert review" },
    { spanText: "Email/chat support" }]
  return (
    <section className="cost_sec">
      <div className="container">
        <div className="row">
          <div className="col-md-7">
            <div className="cost_inner">
              <TranslatedHeadingTwo>What's the cost ?</TranslatedHeadingTwo>
              <TranslatedParagraph strongpref="Each tax return costs a " strong="fixed £120" strongSuf=", all-inclusive."></TranslatedParagraph>

              <ul>
                {items.map((items, index) => {
                  const text = useTranslate(items?.spanText);
                  return (
                    <li key={index}>
                      <span>
                        <FontAwesomeIcon icon={faCheck} />
                      </span>
                      {text}
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
          <div className="col-md-5">
            <div className="cost_image">
              <img src="/images/cost_image.png" alt="" />
            </div>
          </div>
        </div>
        <GetStartedButton text="Get started" href="/tax-return-form" variant="pro-blue" />
      </div>
    </section>
  )
}