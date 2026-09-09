import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import GetStarted from "./GetStarted";
import TaxReturnFormButton from "./TaxReturnFormButton";
import { TranslatedHeading, TranslatedHeadingTwo, TranslatedHeadingFour, TranslatedHeadingFive, TranslatedParagraph, TranslatedButton, TranslatedSpan,TranslatedText } from "@/components/TranslatedContent";
import { faArrowRight, faCircleCheck ,faCheck } from "@fortawesome/free-solid-svg-icons";
export default function GlobalBannerSection({title="Self Assessment Tax Returns for £120"}){
    return (
        <section className="banner_main">
    <div className="back_round">
      {" "}
      <img src="/images/bg_round.png" alt="" />{" "}
    </div>
    <div className="container">
      <div className="banner_inner">
        <div className="row">
          <div className="col-lg-6">
            <div className="banner_details_part">
                        <TranslatedHeading>{title}</TranslatedHeading>
              <ul className="banner_sub">
                {/* faCheck faCircleCheck  */}
                <li><span><FontAwesomeIcon icon={faCircleCheck} width={18} /></span><TranslatedSpan>Simple</TranslatedSpan></li>
                <li><span><FontAwesomeIcon icon={faCircleCheck} width={18} /></span><TranslatedSpan>Fast</TranslatedSpan></li>
                <li><span><FontAwesomeIcon icon={faCircleCheck} width={18} /></span><TranslatedSpan>Affordable</TranslatedSpan></li>
              </ul>
              <TaxReturnFormButton />
            </div>
          </div>
          <div className="col-lg-6">
            <div className="banner_image_part">
              <div className="banner_rt_bg">
                <img src="/images/banner_rt_bg.png" alt="banner_rt_bg" />
              </div>
              <div className="banner_standing">
                <img src="/images/standing.png" alt="Standing_image" />
              </div>
              <GetStarted />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
    )
}